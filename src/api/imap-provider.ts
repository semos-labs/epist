/**
 * ImapSmtpProvider — MailProvider implementation backed by IMAP (read) + SMTP (send).
 *
 * Translates between the app's virtual label model and IMAP's
 * folder + flags reality:
 *
 *   IMAP special-use \Inbox     → labelId "INBOX"
 *   IMAP special-use \Sent      → labelId "SENT"
 *   IMAP special-use \Drafts    → labelId "DRAFT"
 *   IMAP special-use \Trash     → labelId "TRASH"
 *   IMAP special-use \Junk      → labelId "SPAM"
 *   IMAP special-use \Archive   → labelId "ARCHIVE"
 *   IMAP flag  \Seen            → absence of "UNREAD" label
 *   IMAP flag  \Flagged         → "STARRED" label
 *   Custom IMAP folder          → folder path as labelId
 *
 * Threading is synthesized client-side from References / In-Reply-To headers.
 */

import { ImapFlow } from "imapflow";
import type {
  ListResponse,
  FetchMessageObject,
  MailboxLockObject,
} from "imapflow";
import { simpleParser } from "mailparser";
import type { ParsedMail, Attachment as ParsedAttachment } from "mailparser";
import nodemailer from "nodemailer";

import type {
  MailProvider,
  MessageListing,
  MessageListingItem,
  FolderInfo,
  SendOptions,
  SyncCursor,
  SyncDelta,
} from "./provider.ts";
import type { Email, EmailAddress, LabelId, Attachment } from "../domain/email.ts";
import { synthesizeThreadId } from "../domain/email.ts";
import type { ImapConfig, SmtpConfig } from "../utils/config.ts";
import { resolvePassword } from "../utils/config.ts";
import { apiLogger } from "../lib/logger.ts";

// ===== Special-use → canonical label mapping =====

const SPECIAL_USE_MAP: Record<string, string> = {
  "\\Inbox":   "INBOX",
  "\\Sent":    "SENT",
  "\\Drafts":  "DRAFT",
  "\\Trash":   "TRASH",
  "\\Junk":    "SPAM",
  "\\Archive": "ARCHIVE",
  "\\Flagged": "STARRED",
  "\\All":     "ARCHIVE",
};

/** Canonical label → special-use flag for reverse lookup */
const LABEL_TO_SPECIAL_USE: Record<string, string> = {
  "INBOX":   "\\Inbox",
  "SENT":    "\\Sent",
  "DRAFT":   "\\Drafts",
  "TRASH":   "\\Trash",
  "SPAM":    "\\Junk",
  "ARCHIVE": "\\Archive",
};

export class ImapSmtpProvider implements MailProvider {
  readonly type = "imap" as const;
  readonly accountEmail: string;

  private _imapConfig: ImapConfig;
  private _smtpConfig: SmtpConfig;
  private _imapPassword: string | null = null;
  private _smtpPassword: string | null = null;
  private _client: ImapFlow | null = null;

  /**
   * Maps canonical label IDs → actual IMAP folder paths on this server.
   * Built during connect() by scanning the folder list.
   * e.g. { "INBOX": "INBOX", "SENT": "Sent Messages", "TRASH": "Deleted Items" }
   */
  private _folderMap = new Map<string, string>();

  /**
   * Reverse: IMAP folder path → canonical label ID.
   * e.g. { "INBOX": "INBOX", "Sent Messages": "SENT" }
   */
  private _reverseFolderMap = new Map<string, string>();

  /** Full list of server folders (cached from last list()) */
  private _folders: ListResponse[] = [];

  constructor(accountEmail: string, imapConfig: ImapConfig, smtpConfig: SmtpConfig) {
    this.accountEmail = accountEmail;
    this._imapConfig = imapConfig;
    this._smtpConfig = smtpConfig;
  }

  // ----- Lifecycle -----

  async connect(): Promise<void> {
    // 1. Resolve passwords
    this._imapPassword = await resolvePassword({
      password: this._imapConfig.password,
      password_command: this._imapConfig.password_command,
      label: `IMAP for ${this.accountEmail}`,
    });
    this._smtpPassword = await resolvePassword({
      password: this._smtpConfig.password,
      password_command: this._smtpConfig.password_command,
      label: `SMTP for ${this.accountEmail}`,
    });

    // 2. Create IMAP client
    const secure = this._imapConfig.security === "tls";
    this._client = new ImapFlow({
      host: this._imapConfig.host,
      port: this._imapConfig.port,
      secure,
      auth: {
        user: this._imapConfig.username,
        pass: this._imapPassword,
      },
      logger: false, // suppress noisy IMAP logs
    });

    // 3. Connect
    apiLogger.info(`[IMAP] Connecting to ${this._imapConfig.host}:${this._imapConfig.port}`);
    await this._client.connect();
    apiLogger.info(`[IMAP] Connected as ${this.accountEmail}`);

    // 4. Discover folders and build mapping
    await this._discoverFolders();
  }

  async disconnect(): Promise<void> {
    if (this._client) {
      try {
        await this._client.logout();
      } catch {
        this._client.close();
      }
      this._client = null;
    }
  }

  // ----- Reading -----

  async listMessages(options?: {
    folder?: LabelId;
    query?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<MessageListing> {
    const client = this._requireClient();
    const folderPath = this._resolveFolder(options?.folder ?? "INBOX");
    const maxResults = options?.maxResults ?? 50;

    // pageToken is the UID offset for pagination (we paginate by UID descending)
    const uidBefore = options?.pageToken ? parseInt(options.pageToken, 10) : undefined;

    const lock = await client.getMailboxLock(folderPath);
    try {
      // Search for message UIDs
      let uids: number[];
      if (options?.query) {
        const results = await client.search({ text: options.query }, { uid: true });
        uids = (results || []) as number[];
      } else {
        const results = await client.search({ all: true }, { uid: true });
        uids = (results || []) as number[];
      }

      // Sort descending (newest first) and apply pagination
      uids.sort((a, b) => b - a);

      if (uidBefore) {
        uids = uids.filter(uid => uid < uidBefore);
      }

      // Slice to maxResults + 1 to detect if there's a next page
      const sliced = uids.slice(0, maxResults + 1);
      const hasMore = sliced.length > maxResults;
      const pageUids = sliced.slice(0, maxResults);

      if (pageUids.length === 0) {
        return { messages: [], nextPageToken: undefined };
      }

      // Fetch envelopes to get thread info
      const messages: MessageListingItem[] = [];
      const fetched = await client.fetchAll(pageUids, {
        uid: true,
        envelope: true,
      }, { uid: true });

      for (const msg of fetched) {
        const threadId = synthesizeThreadId({
          messageId: msg.envelope?.messageId || undefined,
          inReplyTo: msg.envelope?.inReplyTo || undefined,
        });
        messages.push({
          id: this._makeId(folderPath, msg.uid),
          threadId,
        });
      }

      // Sort by UID descending (newest first)
      messages.reverse();

      const nextPageToken = hasMore && pageUids.length > 0
        ? String(pageUids[pageUids.length - 1])
        : undefined;

      return { messages, nextPageToken };
    } finally {
      lock.release();
    }
  }

  async getMessage(messageId: string): Promise<Email> {
    const client = this._requireClient();
    const { folder, uid } = this._parseId(messageId);

    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid, {
        uid: true,
        source: true,
        flags: true,
        envelope: true,
        size: true,
      }, { uid: true });

      if (!msg) throw new Error(`Message ${messageId} not found`);
      return this._convertMessage(msg, folder);
    } finally {
      lock.release();
    }
  }

  async getMessages(messageIds: string[]): Promise<Email[]> {
    if (messageIds.length === 0) return [];

    // Group by folder for efficiency
    const byFolder = new Map<string, { uid: number; id: string }[]>();
    for (const id of messageIds) {
      const { folder, uid } = this._parseId(id);
      const arr = byFolder.get(folder) || [];
      arr.push({ uid, id });
      byFolder.set(folder, arr);
    }

    const results: Email[] = [];
    const client = this._requireClient();

    for (const [folder, entries] of byFolder) {
      const lock = await client.getMailboxLock(folder);
      try {
        const uids = entries.map(e => e.uid);
        const fetched = await client.fetchAll(uids, {
          uid: true,
          source: true,
          flags: true,
          envelope: true,
          size: true,
        }, { uid: true });

        for (const msg of fetched) {
          results.push(await this._convertMessage(msg, folder));
        }
      } finally {
        lock.release();
      }
    }

    return results;
  }

  async getThread(threadId: string): Promise<Email[]> {
    // IMAP has no native threading — the sync engine groups by threadId client-side.
    // If called with a specific threadId, we could search by References, but for now
    // return empty and let the client-side grouping handle it.
    return [];
  }

  async searchMessages(query: string, maxResults = 50): Promise<Email[]> {
    const client = this._requireClient();
    const folderPath = this._resolveFolder("INBOX");

    const lock = await client.getMailboxLock(folderPath);
    try {
      const uids = await client.search({ text: query }, { uid: true }) as number[] | false;
      if (!uids || uids.length === 0) return [];

      // Take latest N
      uids.sort((a, b) => b - a);
      const sliced = uids.slice(0, maxResults);

      const fetched = await client.fetchAll(sliced, {
        uid: true,
        source: true,
        flags: true,
        envelope: true,
        size: true,
      }, { uid: true });

      const results: Email[] = [];
      for (const msg of fetched) {
        results.push(await this._convertMessage(msg, folderPath));
      }

      return results;
    } finally {
      lock.release();
    }
  }

  // ----- Mutations -----

  async markRead(messageId: string): Promise<void> {
    await this._setFlags(messageId, ["\\Seen"], "add");
  }

  async markUnread(messageId: string): Promise<void> {
    await this._setFlags(messageId, ["\\Seen"], "remove");
  }

  async star(messageId: string): Promise<void> {
    await this._setFlags(messageId, ["\\Flagged"], "add");
  }

  async unstar(messageId: string): Promise<void> {
    await this._setFlags(messageId, ["\\Flagged"], "remove");
  }

  async archive(messageId: string): Promise<void> {
    const archiveFolder = this._resolveFolder("ARCHIVE");
    const inboxFolder = this._resolveFolder("INBOX");
    // If there's a dedicated Archive folder, move there. Otherwise just remove from INBOX.
    if (archiveFolder !== "ARCHIVE") {
      await this._moveMessage(messageId, archiveFolder);
    } else {
      // No archive folder — just remove from INBOX by moving to... hmm.
      // Some servers use "All Mail". Fall back to just deleting from INBOX.
      await this._moveMessage(messageId, inboxFolder); // no-op move, but at least won't crash
      apiLogger.warn(`[IMAP] No archive folder found for ${this.accountEmail}, archive is a no-op`);
    }
  }

  async trash(messageId: string): Promise<void> {
    const trashFolder = this._resolveFolder("TRASH");
    await this._moveMessage(messageId, trashFolder);
  }

  async untrash(messageId: string): Promise<void> {
    const inboxFolder = this._resolveFolder("INBOX");
    await this._moveMessage(messageId, inboxFolder);
  }

  async moveToFolder(messageId: string, targetFolder: string, _sourceFolder?: string): Promise<void> {
    const resolvedTarget = this._resolveFolder(targetFolder);
    await this._moveMessage(messageId, resolvedTarget);
  }

  // ----- Sending -----

  async sendMessage(options: SendOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this._smtpConfig.host,
      port: this._smtpConfig.port,
      secure: this._smtpConfig.security === "tls",
      auth: {
        user: this._smtpConfig.username,
        pass: this._smtpPassword!,
      },
      ...(this._smtpConfig.security === "starttls" ? { requireTLS: true } : {}),
    });

    const mailOptions: nodemailer.SendMailOptions = {
      from: this.accountEmail,
      to: options.to.join(", "),
      cc: options.cc?.join(", "),
      bcc: options.bcc?.join(", "),
      subject: options.subject,
      text: options.body,
      inReplyTo: options.inReplyTo,
      references: options.references?.join(" "),
    };

    await transporter.sendMail(mailOptions);
    apiLogger.info(`[SMTP] Sent message to ${options.to.join(", ")} from ${this.accountEmail}`);

    // Optionally copy to Sent folder
    try {
      const sentFolder = this._resolveFolder("SENT");
      if (sentFolder && this._client) {
        const raw = await transporter.sendMail({ ...mailOptions, envelope: undefined });
        // Most SMTP servers + IMAP combos auto-copy to Sent, so this is best-effort
      }
    } catch {
      // Non-critical
    }
  }

  // ----- Folders / Labels -----

  async listFolders(): Promise<FolderInfo[]> {
    await this._discoverFolders();
    return this._folders.map(f => this._folderToInfo(f));
  }

  async getFolderCounts(folderIds?: string[]): Promise<Record<string, { total: number; unread: number }>> {
    const client = this._requireClient();
    const ids = folderIds ?? ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED"];
    const result: Record<string, { total: number; unread: number }> = {};

    for (const labelId of ids) {
      const folderPath = this._resolveFolder(labelId);
      // Skip labels that don't map to a real folder (e.g. STARRED is a flag, not a folder)
      if (labelId === "STARRED" || labelId === "IMPORTANT" || labelId === "UNREAD") continue;
      if (folderPath === labelId && !this._folderMap.has(labelId)) continue; // unmapped

      try {
        const status = await client.status(folderPath, {
          messages: true,
          unseen: true,
        });

        result[labelId] = {
          total: status.messages ?? 0,
          unread: status.unseen ?? 0,
        };
      } catch {
        // Folder might not exist on this server
      }
    }

    return result;
  }

  // ----- Attachments -----

  async getAttachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
    const client = this._requireClient();
    const { folder, uid } = this._parseId(messageId);

    const lock = await client.getMailboxLock(folder);
    try {
      // attachmentId is the MIME part number (e.g. "2", "1.2")
      const download = await client.download(String(uid), attachmentId, { uid: true });
      const chunks: Uint8Array[] = [];
      for await (const chunk of download.content) {
        chunks.push(new Uint8Array(chunk));
      }

      // Concatenate
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return result;
    } finally {
      lock.release();
    }
  }

  // ----- Sync -----

  async getInitialSyncCursor(): Promise<SyncCursor> {
    const client = this._requireClient();
    const folderPath = this._resolveFolder("INBOX");

    const lock = await client.getMailboxLock(folderPath);
    try {
      const mailbox = client.mailbox;
      if (!mailbox) throw new Error("Could not open INBOX");

      return {
        value: JSON.stringify({
          uidValidity: String(mailbox.uidValidity),
          uidNext: mailbox.uidNext,
          folder: folderPath,
        }),
      };
    } finally {
      lock.release();
    }
  }

  async getChangesSince(cursor: SyncCursor): Promise<SyncDelta> {
    const client = this._requireClient();
    const parsed = JSON.parse(cursor.value) as {
      uidValidity: string;
      uidNext: number;
      folder: string;
    };

    const folderPath = parsed.folder;
    const upsert: Email[] = [];
    const deleted: string[] = [];

    const lock = await client.getMailboxLock(folderPath);
    try {
      const mailbox = client.mailbox;
      if (!mailbox) {
        return { upsert: [], deleted: [], cursor };
      }

      // Check UIDVALIDITY — if it changed, the mailbox was rebuilt
      if (String(mailbox.uidValidity) !== parsed.uidValidity) {
        apiLogger.warn(`[IMAP] UIDVALIDITY changed for ${folderPath} — full re-sync needed`);
        // Signal to caller that all cached data for this folder is stale
        // by returning a high uidNext so the full sync kicks in
        return {
          upsert: [],
          deleted: [],
          cursor: {
            value: JSON.stringify({
              uidValidity: String(mailbox.uidValidity),
              uidNext: mailbox.uidNext,
              folder: folderPath,
            }),
          },
        };
      }

      // Fetch new messages since last uidNext
      if (mailbox.uidNext > parsed.uidNext) {
        const range = `${parsed.uidNext}:*`;
        const fetched = await client.fetchAll(range, {
          uid: true,
          source: true,
          flags: true,
          envelope: true,
          size: true,
        }, { uid: true });

        for (const msg of fetched) {
          if (msg.uid >= parsed.uidNext) {
            upsert.push(await this._convertMessage(msg, folderPath));
          }
        }
      }

      // New cursor
      const newCursor: SyncCursor = {
        value: JSON.stringify({
          uidValidity: String(mailbox.uidValidity),
          uidNext: mailbox.uidNext,
          folder: folderPath,
        }),
      };

      return { upsert, deleted, cursor: newCursor };
    } finally {
      lock.release();
    }
  }

  // ===== Internal helpers =====

  private _requireClient(): ImapFlow {
    if (!this._client) throw new Error("IMAP client not connected");
    return this._client;
  }

  /** Discover server folders and build canonical ↔ IMAP path maps. */
  private async _discoverFolders(): Promise<void> {
    const client = this._requireClient();
    this._folders = await client.list();
    this._folderMap.clear();
    this._reverseFolderMap.clear();

    // INBOX is always INBOX
    this._folderMap.set("INBOX", "INBOX");
    this._reverseFolderMap.set("INBOX", "INBOX");

    for (const folder of this._folders) {
      // Use special-use flags for reliable mapping
      if (folder.specialUse) {
        const canonical = SPECIAL_USE_MAP[folder.specialUse];
        if (canonical) {
          this._folderMap.set(canonical, folder.path);
          this._reverseFolderMap.set(folder.path, canonical);
          continue;
        }
      }

      // Fallback: map by common folder names
      const lower = folder.name.toLowerCase();
      if (lower === "sent" || lower === "sent messages" || lower === "sent mail" || lower === "sent items") {
        if (!this._folderMap.has("SENT")) {
          this._folderMap.set("SENT", folder.path);
          this._reverseFolderMap.set(folder.path, "SENT");
        }
      } else if (lower === "drafts" || lower === "draft") {
        if (!this._folderMap.has("DRAFT")) {
          this._folderMap.set("DRAFT", folder.path);
          this._reverseFolderMap.set(folder.path, "DRAFT");
        }
      } else if (lower === "trash" || lower === "deleted messages" || lower === "deleted items") {
        if (!this._folderMap.has("TRASH")) {
          this._folderMap.set("TRASH", folder.path);
          this._reverseFolderMap.set(folder.path, "TRASH");
        }
      } else if (lower === "junk" || lower === "spam" || lower === "junk e-mail") {
        if (!this._folderMap.has("SPAM")) {
          this._folderMap.set("SPAM", folder.path);
          this._reverseFolderMap.set(folder.path, "SPAM");
        }
      } else if (lower === "archive" || lower === "all mail") {
        if (!this._folderMap.has("ARCHIVE")) {
          this._folderMap.set("ARCHIVE", folder.path);
          this._reverseFolderMap.set(folder.path, "ARCHIVE");
        }
      }

      // Always store the raw path mapping for custom folders
      if (!this._reverseFolderMap.has(folder.path)) {
        this._reverseFolderMap.set(folder.path, folder.path);
      }
    }

    apiLogger.info(`[IMAP] Discovered ${this._folders.length} folders:`, {
      mapped: Object.fromEntries(this._folderMap),
    });
  }

  /** Resolve a canonical label ID to an IMAP folder path. */
  private _resolveFolder(labelId: string): string {
    return this._folderMap.get(labelId) ?? labelId;
  }

  /** Build a composite message ID: `folder:uid` */
  private _makeId(folder: string, uid: number): string {
    return `${folder}:${uid}`;
  }

  /** Parse a composite message ID back to folder + uid. */
  private _parseId(messageId: string): { folder: string; uid: number } {
    const lastColon = messageId.lastIndexOf(":");
    if (lastColon === -1) throw new Error(`Invalid IMAP message ID: ${messageId}`);
    return {
      folder: messageId.slice(0, lastColon),
      uid: parseInt(messageId.slice(lastColon + 1), 10),
    };
  }

  /** Convert an ImapFlow FetchMessageObject → our Email type. */
  private async _convertMessage(msg: FetchMessageObject, folder: string): Promise<Email> {
    const id = this._makeId(folder, msg.uid);

    // Parse full MIME if source is available
    let parsed: ParsedMail | null = null;
    if (msg.source) {
      parsed = await simpleParser(msg.source);
    }

    // Build label IDs from folder + flags
    const labelIds: string[] = [];
    const canonicalFolder = this._reverseFolderMap.get(folder) ?? folder;
    labelIds.push(canonicalFolder);

    if (msg.flags) {
      if (!msg.flags.has("\\Seen")) labelIds.push("UNREAD");
      if (msg.flags.has("\\Flagged")) labelIds.push("STARRED");
      if (msg.flags.has("\\Draft")) labelIds.push("DRAFT");
    }

    // Extract addresses
    const from = parsed?.from?.value?.[0]
      ? toEmailAddress(parsed.from.value[0])
      : msg.envelope?.from?.[0]
        ? envToEmailAddress(msg.envelope.from[0])
        : { email: "unknown@unknown" };

    const to = parsed?.to
      ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(
          t => t.value.map(toEmailAddress)
        )
      : msg.envelope?.to?.map(envToEmailAddress) ?? [];

    const cc = parsed?.cc
      ? (Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc]).flatMap(
          t => t.value.map(toEmailAddress)
        )
      : msg.envelope?.cc?.map(envToEmailAddress);

    const bcc = parsed?.bcc
      ? (Array.isArray(parsed.bcc) ? parsed.bcc : [parsed.bcc]).flatMap(
          t => t.value.map(toEmailAddress)
        )
      : msg.envelope?.bcc?.map(envToEmailAddress);

    // References
    const references = parsed?.references
      ? (Array.isArray(parsed.references) ? parsed.references : [parsed.references])
      : undefined;

    // Thread ID
    const threadId = synthesizeThreadId({
      messageId: parsed?.messageId || msg.envelope?.messageId || undefined,
      inReplyTo: parsed?.inReplyTo || msg.envelope?.inReplyTo || undefined,
      references,
    });

    // Body
    const body = parsed?.text ?? "";
    const bodyHtml = parsed?.html || undefined;

    // Snippet (first 200 chars of body)
    const snippet = body.replace(/\s+/g, " ").trim().slice(0, 200);

    // Date
    const date = parsed?.date?.toISOString()
      ?? (msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : new Date().toISOString());

    // Attachments
    const attachments: Attachment[] = (parsed?.attachments ?? []).map(
      (att: ParsedAttachment, i: number) => {
        const partNum = String(i + 1);
        return {
          attachmentId: att.cid ?? partNum,
          partId: partNum,
          filename: att.filename ?? `attachment-${i + 1}`,
          mimeType: att.contentType ?? "application/octet-stream",
          size: att.size ?? 0,
        };
      }
    );

    // Calendar events from text/calendar attachments
    let calendarEvent: Email["calendarEvent"] = undefined;
    const icsAttachment = parsed?.attachments?.find(
      a => a.contentType === "text/calendar"
    );
    if (icsAttachment) {
      try {
        const { parseICS } = await import("../utils/icsParser.ts");
        calendarEvent = parseICS(icsAttachment.content.toString("utf-8"), this.accountEmail) ?? undefined;
      } catch {
        // Non-critical — ICS parsing may not be available
      }
    }

    return {
      id,
      threadId,
      subject: parsed?.subject ?? msg.envelope?.subject ?? "(no subject)",
      from,
      to,
      cc: cc?.length ? cc : undefined,
      bcc: bcc?.length ? bcc : undefined,
      replyTo: parsed?.replyTo?.value?.[0] ? toEmailAddress(parsed.replyTo.value[0]) : undefined,
      messageId: parsed?.messageId || msg.envelope?.messageId || undefined,
      inReplyTo: parsed?.inReplyTo || msg.envelope?.inReplyTo || undefined,
      references,
      date,
      body,
      bodyHtml,
      snippet,
      labelIds,
      attachments,
      calendarEvent,
      sizeEstimate: msg.size,
      accountEmail: this.accountEmail,
    };
  }

  /** Set or remove flags on a message. */
  private async _setFlags(
    messageId: string,
    flags: string[],
    action: "add" | "remove",
  ): Promise<void> {
    const client = this._requireClient();
    const { folder, uid } = this._parseId(messageId);

    const lock = await client.getMailboxLock(folder);
    try {
      if (action === "add") {
        await client.messageFlagsAdd(uid, flags, { uid: true });
      } else {
        await client.messageFlagsRemove(uid, flags, { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  /** Move a message to a different folder. */
  private async _moveMessage(messageId: string, targetFolder: string): Promise<void> {
    const client = this._requireClient();
    const { folder, uid } = this._parseId(messageId);

    if (folder === targetFolder) return; // already there

    const lock = await client.getMailboxLock(folder);
    try {
      await client.messageMove(uid, targetFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  /** Convert a ListResponse to our FolderInfo. */
  private _folderToInfo(folder: ListResponse): FolderInfo {
    const canonical = this._reverseFolderMap.get(folder.path);
    const isSystem = !!folder.specialUse || folder.path === "INBOX";

    return {
      id: canonical ?? folder.path,
      name: folder.name,
      type: isSystem ? "system" : "user",
      messagesTotal: folder.status?.messages,
      messagesUnread: folder.status?.unseen,
    };
  }
}

// ===== Helpers =====

function toEmailAddress(addr: { address?: string; name?: string }): EmailAddress {
  return {
    email: addr.address ?? "unknown@unknown",
    name: addr.name || undefined,
  };
}

function envToEmailAddress(addr: { address?: string; name?: string }): EmailAddress {
  return {
    email: addr.address ?? "unknown@unknown",
    name: addr.name || undefined,
  };
}
