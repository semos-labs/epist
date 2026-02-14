/**
 * Gmail API client
 * 
 * Handles fetching messages, threads, sending mail, labels, etc.
 * Uses the Gmail REST API: https://developers.google.com/gmail/api/reference
 */

import { getValidAccessTokenForAccount } from "../auth/tokens.ts";
import { apiLogger } from "../lib/logger.ts";
import type {
  Email,
  EmailAddress,
  Attachment,
  GmailMessage,
  MessagePart,
  MessageHeader,
  LabelId,
} from "../domain/email.ts";
import { parseICS } from "../utils/icsParser.ts";

const GMAIL_BASE = "https://www.googleapis.com/gmail/v1/users/me";

// ===== Low-level API helpers =====

async function gmailFetch(accountEmail: string, path: string, options?: RequestInit): Promise<Response> {
  const token = await getValidAccessTokenForAccount(accountEmail);
  if (!token) {
    throw new Error(`No valid access token for ${accountEmail}. Please re-login.`);
  }

  const response = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    apiLogger.error(`Gmail API error: ${path}`, { status: response.status, error });
    throw new Error(`Gmail API error (${response.status}): ${error}`);
  }

  return response;
}

// ===== Message Parsing =====

function getHeader(headers: MessageHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function parseEmailAddress(raw: string): EmailAddress {
  // "Display Name <email@example.com>" or "email@example.com"
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1]!.replace(/^"|"$/g, "").trim(), email: match[2]! };
  }
  return { email: raw.trim() };
}

function parseEmailAddresses(raw: string): EmailAddress[] {
  if (!raw) return [];
  // Split on comma, but be careful with quoted strings
  return raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(parseEmailAddress);
}

function extractBody(payload: MessagePart): { text: string; html: string } {
  let text = "";
  let html = "";

  function walk(part: MessagePart) {
    if (part.mimeType === "text/plain" && part.body.data) {
      text += decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body.data) {
      html += decodeBase64Url(part.body.data);
    }

    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return { text, html };
}

function extractAttachments(payload: MessagePart): Attachment[] {
  const attachments: Attachment[] = [];

  function walk(part: MessagePart) {
    if (part.filename && part.body.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        partId: part.partId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size,
      });
    }

    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return attachments;
}

function extractCalendarPart(payload: MessagePart): string | null {
  function walk(part: MessagePart): string | null {
    if (part.mimeType === "text/calendar" && part.body.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        const result = walk(child);
        if (result) return result;
      }
    }
    return null;
  }
  return walk(payload);
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64 encoding (no padding)
  // Must use Buffer for proper UTF-8 decoding — atob() mangles multi-byte chars
  let base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if missing
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";
  try {
    return Buffer.from(base64, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Convert a raw Gmail message into our app-level Email type.
 *
 * Async because it may need to download an ICS attachment from Gmail
 * if no inline text/calendar part is found.
 */
async function gmailMessageToEmail(msg: GmailMessage, accountEmail: string): Promise<Email> {
  const headers = msg.payload.headers;
  const { text, html } = extractBody(msg.payload);
  let attachments = extractAttachments(msg.payload);

  // Try to parse calendar invite from inline text/calendar MIME part
  let calendarEvent = undefined;
  const icsData = extractCalendarPart(msg.payload);
  if (icsData) {
    try {
      calendarEvent = parseICS(icsData);
    } catch {
      apiLogger.warn("Failed to parse calendar invite", { messageId: msg.id });
    }
  }

  // If no inline calendar part, check for .ics attachments and auto-download+parse
  if (!calendarEvent) {
    const icsAttachment = attachments.find(
      a => a.mimeType === "text/calendar" ||
           a.mimeType === "application/ics" ||
           a.filename.toLowerCase().endsWith(".ics")
    );

    if (icsAttachment) {
      try {
        const icsBytes = await getAttachment(accountEmail, msg.id, icsAttachment.attachmentId);
        const icsText = new TextDecoder().decode(icsBytes);
        calendarEvent = parseICS(icsText, accountEmail) ?? undefined;

        if (calendarEvent) {
          // Remove the ICS from the visible attachment list — it's shown as calendar UI instead
          attachments = attachments.filter(a => a.attachmentId !== icsAttachment.attachmentId);
        }
      } catch {
        apiLogger.warn("Failed to download/parse ICS attachment", {
          messageId: msg.id,
          filename: icsAttachment.filename,
        });
      }
    }
  }

  const from = parseEmailAddress(getHeader(headers, "From"));
  const to = parseEmailAddresses(getHeader(headers, "To"));
  const cc = parseEmailAddresses(getHeader(headers, "Cc"));
  const bcc = parseEmailAddresses(getHeader(headers, "Bcc"));
  const replyToRaw = getHeader(headers, "Reply-To");
  const replyTo = replyToRaw ? parseEmailAddress(replyToRaw) : undefined;
  const references = getHeader(headers, "References").split(/\s+/).filter(Boolean);

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getHeader(headers, "Subject") || "(no subject)",
    from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    replyTo,
    messageId: getHeader(headers, "Message-ID") || undefined,
    inReplyTo: getHeader(headers, "In-Reply-To") || undefined,
    references: references.length > 0 ? references : undefined,
    date: new Date(parseInt(msg.internalDate)).toISOString(),
    body: text,
    bodyHtml: html || undefined,
    snippet: msg.snippet,
    labelIds: msg.labelIds,
    attachments,
    calendarEvent: calendarEvent ?? undefined,
    sizeEstimate: msg.sizeEstimate,
    accountEmail,
  };
}

// ===== Public API =====

/**
 * List message IDs in a label/folder (paginated)
 */
export async function listMessages(
  accountEmail: string,
  options: {
    labelIds?: LabelId[];
    q?: string; // Gmail search query
    maxResults?: number;
    pageToken?: string;
  } = {}
): Promise<{ messages: { id: string; threadId: string }[]; nextPageToken?: string }> {
  const params = new URLSearchParams();
  if (options.labelIds) {
    for (const label of options.labelIds) {
      params.append("labelIds", label);
    }
  }
  if (options.q) params.set("q", options.q);
  params.set("maxResults", String(options.maxResults || 50));
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await gmailFetch(accountEmail, `/messages?${params}`);
  const data = await res.json() as {
    messages?: { id: string; threadId: string }[];
    nextPageToken?: string;
  };

  return {
    messages: data.messages || [],
    nextPageToken: data.nextPageToken,
  };
}

/**
 * Get a full message by ID
 */
export async function getMessage(accountEmail: string, messageId: string): Promise<Email> {
  const res = await gmailFetch(accountEmail, `/messages/${messageId}?format=full`);
  const msg = await res.json() as GmailMessage;
  return await gmailMessageToEmail(msg, accountEmail);
}

/**
 * Get a full thread (all messages)
 */
export async function getThread(
  accountEmail: string,
  threadId: string
): Promise<Email[]> {
  const res = await gmailFetch(accountEmail, `/threads/${threadId}?format=full`);
  const data = await res.json() as { messages: GmailMessage[] };
  return await Promise.all((data.messages || []).map(msg => gmailMessageToEmail(msg, accountEmail)));
}

/**
 * Batch get messages by IDs
 */
export async function getMessages(
  accountEmail: string,
  messageIds: string[]
): Promise<Email[]> {
  // Gmail doesn't have a real batch endpoint for messages.get,
  // so we do concurrent fetches (limited to avoid rate limits)
  const BATCH_SIZE = 10;
  const results: Email[] = [];

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(id => getMessage(accountEmail, id))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Fetch emails for a label, fully parsed
 */
export async function fetchEmailsForLabel(
  accountEmail: string,
  labelId: LabelId,
  maxResults = 50,
  pageToken?: string
): Promise<{ emails: Email[]; nextPageToken?: string }> {
  const listing = await listMessages(accountEmail, {
    labelIds: [labelId],
    maxResults,
    pageToken,
  });

  if (listing.messages.length === 0) {
    return { emails: [], nextPageToken: listing.nextPageToken };
  }

  const emails = await getMessages(
    accountEmail,
    listing.messages.map(m => m.id)
  );

  return { emails, nextPageToken: listing.nextPageToken };
}

/**
 * Fetch all emails from all accounts for a label
 */
export async function fetchAllAccountEmails(
  accounts: string[],
  labelId: LabelId,
  maxResults = 50
): Promise<Email[]> {
  const results = await Promise.all(
    accounts.map(email => fetchEmailsForLabel(email, labelId, maxResults))
  );

  const allEmails = results.flatMap(r => r.emails);
  // Sort by date, newest first
  allEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return allEmails;
}

// ===== Modify operations =====

/**
 * Modify labels on a message (add and/or remove)
 */
export async function modifyMessage(
  accountEmail: string,
  messageId: string,
  addLabels: LabelId[] = [],
  removeLabels: LabelId[] = []
): Promise<void> {
  await gmailFetch(accountEmail, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({
      addLabelIds: addLabels,
      removeLabelIds: removeLabels,
    }),
  });
}

/**
 * Mark message as read
 */
export async function markAsRead(accountEmail: string, messageId: string): Promise<void> {
  await modifyMessage(accountEmail, messageId, [], ["UNREAD"]);
}

/**
 * Mark message as unread
 */
export async function markAsUnread(accountEmail: string, messageId: string): Promise<void> {
  await modifyMessage(accountEmail, messageId, ["UNREAD"], []);
}

/**
 * Star a message
 */
export async function starMessage(accountEmail: string, messageId: string): Promise<void> {
  await modifyMessage(accountEmail, messageId, ["STARRED"], []);
}

/**
 * Unstar a message
 */
export async function unstarMessage(accountEmail: string, messageId: string): Promise<void> {
  await modifyMessage(accountEmail, messageId, [], ["STARRED"]);
}

/**
 * Archive a message (remove INBOX label)
 */
export async function archiveMessage(accountEmail: string, messageId: string): Promise<void> {
  await modifyMessage(accountEmail, messageId, [], ["INBOX"]);
}

/**
 * Trash a message
 */
export async function trashMessage(accountEmail: string, messageId: string): Promise<void> {
  await gmailFetch(accountEmail, `/messages/${messageId}/trash`, { method: "POST" });
}

/**
 * Untrash a message
 */
export async function untrashMessage(accountEmail: string, messageId: string): Promise<void> {
  await gmailFetch(accountEmail, `/messages/${messageId}/untrash`, { method: "POST" });
}

/**
 * Move a message to a label (add new label, remove INBOX)
 */
export async function moveToLabel(
  accountEmail: string,
  messageId: string,
  targetLabel: LabelId,
  removeFromLabel: LabelId = "INBOX"
): Promise<void> {
  await modifyMessage(accountEmail, messageId, [targetLabel], [removeFromLabel]);
}

// ===== Send =====

/**
 * Send an email
 */
export async function sendMessage(
  accountEmail: string,
  options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string[];
    threadId?: string;
  }
): Promise<void> {
  const lines: string[] = [
    `From: ${accountEmail}`,
    `To: ${options.to.join(", ")}`,
  ];

  if (options.cc?.length) lines.push(`Cc: ${options.cc.join(", ")}`);
  if (options.bcc?.length) lines.push(`Bcc: ${options.bcc.join(", ")}`);
  lines.push(`Subject: ${options.subject}`);
  if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references?.length) lines.push(`References: ${options.references.join(" ")}`);
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("");
  lines.push(options.body);

  const raw = lines.join("\r\n");
  const encoded = btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendBody: Record<string, string> = { raw: encoded };
  if (options.threadId) sendBody.threadId = options.threadId;

  await gmailFetch(accountEmail, "/messages/send", {
    method: "POST",
    body: JSON.stringify(sendBody),
  });
}

// ===== Attachments =====

/**
 * Download an attachment
 */
export async function getAttachment(
  accountEmail: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array> {
  const res = await gmailFetch(
    accountEmail,
    `/messages/${messageId}/attachments/${attachmentId}`
  );
  const data = await res.json() as { data: string; size: number };

  // Decode base64url
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ===== Labels =====

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

/**
 * List all labels (basic info only — no counters)
 */
export async function listLabels(accountEmail: string): Promise<GmailLabel[]> {
  const res = await gmailFetch(accountEmail, "/labels");
  const data = await res.json() as { labels: GmailLabel[] };
  return data.labels || [];
}

/**
 * Get detailed label info (includes messagesTotal and messagesUnread)
 */
export async function getLabelDetail(accountEmail: string, labelId: string): Promise<GmailLabel> {
  const res = await gmailFetch(accountEmail, `/labels/${labelId}`);
  return await res.json() as GmailLabel;
}

/**
 * Fetch counts for all folder labels in one go.
 * Returns { labelId: { total, unread } }.
 */
export async function fetchLabelCounts(
  accountEmail: string,
  labelIds: string[] = ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT"],
): Promise<Record<string, { total: number; unread: number }>> {
  const results = await Promise.all(
    labelIds.map(id => getLabelDetail(accountEmail, id).catch(() => null))
  );

  const counts: Record<string, { total: number; unread: number }> = {};
  for (let i = 0; i < labelIds.length; i++) {
    const label = results[i];
    if (label) {
      counts[labelIds[i]!] = {
        total: label.messagesTotal ?? 0,
        unread: label.messagesUnread ?? 0,
      };
    }
  }
  return counts;
}

// ===== History (Incremental Sync) =====

export interface HistoryRecord {
  id: string;
  messagesAdded?: { message: { id: string; threadId: string; labelIds: LabelId[] } }[];
  messagesDeleted?: { message: { id: string; threadId: string; labelIds: LabelId[] } }[];
  labelsAdded?: { message: { id: string; threadId: string; labelIds: LabelId[] }; labelIds: LabelId[] }[];
  labelsRemoved?: { message: { id: string; threadId: string; labelIds: LabelId[] }; labelIds: LabelId[] }[];
}

export interface HistoryResponse {
  history?: HistoryRecord[];
  historyId: string;
  nextPageToken?: string;
}

/**
 * Fetch history since a given historyId.
 * Returns changes (added/deleted/label-modified messages) plus the new historyId.
 */
export async function listHistory(
  accountEmail: string,
  startHistoryId: string,
  options: {
    labelId?: string;
    maxResults?: number;
    pageToken?: string;
  } = {},
): Promise<HistoryResponse> {
  const params = new URLSearchParams({
    startHistoryId,
    maxResults: String(options.maxResults || 100),
  });
  if (options.labelId) params.set("labelId", options.labelId);
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await gmailFetch(accountEmail, `/history?${params}`);
  return await res.json() as HistoryResponse;
}

// ===== Profile =====

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

/**
 * Get Gmail profile (useful for checking permissions and getting initial historyId)
 */
export async function getProfile(accountEmail: string): Promise<GmailProfile> {
  const res = await gmailFetch(accountEmail, "/profile");
  return await res.json() as GmailProfile;
}

// ===== Search =====

/**
 * Search messages using Gmail search syntax
 */
export async function searchMessages(
  accountEmail: string,
  query: string,
  maxResults = 50
): Promise<Email[]> {
  const listing = await listMessages(accountEmail, { q: query, maxResults });

  if (listing.messages.length === 0) return [];

  return getMessages(accountEmail, listing.messages.map(m => m.id));
}
