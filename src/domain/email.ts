import { z } from "zod";

// ===== Gmail-compatible types =====
// These types mirror the Gmail API resource format.
// See: https://developers.google.com/gmail/api/reference/rest/v1/users.messages

// Email address with optional display name
// Parsed from RFC 2822 header format: "Display Name <email@example.com>"
export interface EmailAddress {
  email: string;
  name?: string;
}

// Gmail system labels (uppercase to match Gmail API labelIds)
export type SystemLabel =
  | "INBOX"
  | "SENT"
  | "DRAFT"
  | "TRASH"
  | "SPAM"
  | "STARRED"
  | "IMPORTANT"
  | "UNREAD"
  | "CATEGORY_PERSONAL"
  | "CATEGORY_SOCIAL"
  | "CATEGORY_PROMOTIONS"
  | "CATEGORY_UPDATES"
  | "CATEGORY_FORUMS";

// A label can be a system label or a custom label ID
export type LabelId = SystemLabel | string;

// Gmail message part body
export interface MessagePartBody {
  /** Attachment ID — use with messages.attachments.get to fetch */
  attachmentId?: string;
  /** Size in bytes */
  size: number;
  /** Base64url-encoded body data (only for non-attachment parts) */
  data?: string;
}

// Gmail message part (recursive MIME structure)
export interface MessagePart {
  partId: string;
  mimeType: string;
  filename: string;
  headers: MessageHeader[];
  body: MessagePartBody;
  parts?: MessagePart[];
}

// Gmail message header
export interface MessageHeader {
  name: string;
  value: string;
}

// Gmail message resource
// This is the raw shape returned by the Gmail API messages.get
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: LabelId[];
  snippet: string;
  /** Epoch milliseconds as string */
  internalDate: string;
  /** Estimated total message size in bytes */
  sizeEstimate: number;
  payload: MessagePart;
  /** History ID for incremental sync */
  historyId?: string;
}

// ===== Calendar Invite types =====
// Gmail identifies calendar invites via text/calendar MIME parts in the payload.
// The iCalendar data (RFC 5545) contains VCALENDAR/VEVENT with a METHOD property.

export type CalendarMethod = "REQUEST" | "REPLY" | "CANCEL" | "PUBLISH";

export type AttendeeStatus = "NEEDS-ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

export type AttendeeRole = "REQ-PARTICIPANT" | "OPT-PARTICIPANT" | "CHAIR" | "NON-PARTICIPANT";

export interface CalendarAttendee {
  email: string;
  name?: string;
  status: AttendeeStatus;
  role?: AttendeeRole;
}

export interface CalendarEvent {
  /** Unique event identifier (UID in iCal) */
  uid: string;
  /** Event title (SUMMARY in iCal) */
  summary: string;
  /** Event description */
  description?: string;
  /** Location or meeting URL */
  location?: string;
  /** Start time as ISO string */
  start: string;
  /** End time as ISO string */
  end: string;
  /** Whether this is an all-day event */
  allDay?: boolean;
  /** Event organizer */
  organizer?: EmailAddress;
  /** List of attendees with their RSVP status */
  attendees?: CalendarAttendee[];
  /** iCalendar method — REQUEST = invite, CANCEL = cancellation */
  method: CalendarMethod;
  /** Event status */
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  /** Recurrence rule (RRULE) */
  recurrence?: string;
  /** Sequence number — incremented when event is updated */
  sequence?: number;
  /** Conference/video call URL (e.g. Google Meet) */
  conferenceUrl?: string;
  /** Your RSVP status (derived from attendees list matching current user) */
  myStatus?: AttendeeStatus;
}

// ===== App-level types (derived from Gmail data) =====
// These are convenience types used by the UI layer.
// They are derived from GmailMessage by parsing headers and payload.

// Email attachment (derived from MessagePart with filename)
export interface Attachment {
  /** Corresponds to MessagePartBody.attachmentId */
  attachmentId: string;
  /** Part ID within the message */
  partId: string;
  filename: string;
  mimeType: string;
  /** Size in bytes */
  size: number;
}

// Parsed email for the UI
export interface Email {
  /** Gmail message ID */
  id: string;
  /** Gmail thread ID */
  threadId: string;
  /** Parsed subject from headers */
  subject: string;
  /** Parsed from header */
  from: EmailAddress;
  /** Parsed to header */
  to: EmailAddress[];
  /** Parsed cc header */
  cc?: EmailAddress[];
  /** Parsed bcc header */
  bcc?: EmailAddress[];
  /** Parsed reply-to header */
  replyTo?: EmailAddress;
  /** Message-ID header (RFC 2822) */
  messageId?: string;
  /** In-Reply-To header (for threading) */
  inReplyTo?: string;
  /** References header (for threading) */
  references?: string[];
  /** ISO date string (converted from internalDate) */
  date: string;
  /** Plain text body (extracted from payload) */
  body: string;
  /** HTML body (extracted from payload) */
  bodyHtml?: string;
  /** Short preview text (from Gmail snippet) */
  snippet: string;
  /** Gmail label IDs */
  labelIds: LabelId[];
  /** Derived attachment list */
  attachments: Attachment[];
  /** Parsed calendar invite (from text/calendar MIME part) */
  calendarEvent?: CalendarEvent;
  /** Estimated total size in bytes */
  sizeEstimate?: number;
  /** Which account this email belongs to (email address) */
  accountEmail?: string;
}

// ===== Derived helpers =====

export function isUnread(email: Email): boolean {
  return email.labelIds.includes("UNREAD");
}

export function isStarred(email: Email): boolean {
  return email.labelIds.includes("STARRED");
}

export function hasLabel(email: Email, label: LabelId): boolean {
  return email.labelIds.includes(label);
}

export function hasAttachments(email: Email): boolean {
  return email.attachments.length > 0;
}

export function hasCalendarInvite(email: Email): boolean {
  return email.calendarEvent != null;
}

// ===== Threading =====

export interface Thread {
  id: string; // threadId
  /** All messages in the thread, sorted oldest→newest */
  messages: Email[];
  /** The latest message (for list display) */
  latest: Email;
  /** Subject (from the first message, stripped of Re:/Fwd:) */
  subject: string;
  /** Number of messages in thread */
  count: number;
  /** Whether any message is unread */
  hasUnread: boolean;
  /** Latest date across all messages */
  date: string;
}

/** Strip Re:/Fwd: prefixes from subject for thread grouping */
export function normalizeSubject(subject: string): string {
  return subject.replace(/^(Re|Fwd|Fw):\s*/gi, "").trim();
}

/** Group emails into threads, sorted by latest message date (newest first) */
export function groupIntoThreads(emails: Email[]): Thread[] {
  const threadMap = new Map<string, Email[]>();

  for (const email of emails) {
    const existing = threadMap.get(email.threadId) || [];
    existing.push(email);
    threadMap.set(email.threadId, existing);
  }

  const threads: Thread[] = [];
  for (const [threadId, messages] of threadMap) {
    // Sort messages oldest → newest within thread
    messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = messages[messages.length - 1]!;
    threads.push({
      id: threadId,
      messages,
      latest,
      subject: normalizeSubject(messages[0]!.subject),
      count: messages.length,
      hasUnread: messages.some(m => m.labelIds.includes("UNREAD")),
      date: latest.date,
    });
  }

  // Sort threads by latest message date, newest first
  threads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return threads;
}

// Format email address for display
export function formatEmailAddress(addr: EmailAddress): string {
  return addr.name || addr.email;
}

// Format multiple addresses
export function formatEmailAddresses(addrs: EmailAddress[]): string {
  return addrs.map(formatEmailAddress).join(", ");
}

// Get initials for avatar
export function getInitials(addr: EmailAddress): string {
  const name = addr.name || addr.email;
  const parts = name.split(/[\s@]/);
  if (parts.length >= 2) {
    return (parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || "").toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

// Get human-readable label
export function getLabelDisplay(label: LabelId): string {
  const labels: Record<string, string> = {
    INBOX: "Inbox",
    SENT: "Sent",
    DRAFT: "Drafts",
    TRASH: "Trash",
    SPAM: "Spam",
    STARRED: "Starred",
    IMPORTANT: "Important",
    UNREAD: "Unread",
    CATEGORY_PERSONAL: "Personal",
    CATEGORY_SOCIAL: "Social",
    CATEGORY_PROMOTIONS: "Promotions",
    CATEGORY_UPDATES: "Updates",
    CATEGORY_FORUMS: "Forums",
  };
  return labels[label] || label;
}

// Label used for folder navigation in the sidebar
export type FolderLabel = "INBOX" | "SENT" | "DRAFT" | "TRASH" | "SPAM" | "STARRED" | "IMPORTANT";

export const FOLDER_LABELS: FolderLabel[] = [
  "INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT",
];

// Gmail category labels (system labels with CATEGORY_ prefix)
export type CategoryLabel = "CATEGORY_PERSONAL" | "CATEGORY_SOCIAL" | "CATEGORY_PROMOTIONS" | "CATEGORY_UPDATES" | "CATEGORY_FORUMS";

export const CATEGORY_LABELS: CategoryLabel[] = [
  "CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS",
];

export const CATEGORY_ICONS: Record<CategoryLabel, string> = {
  CATEGORY_PERSONAL: "👤",
  CATEGORY_SOCIAL: "💬",
  CATEGORY_PROMOTIONS: "🏷️",
  CATEGORY_UPDATES: "🔔",
  CATEGORY_FORUMS: "📢",
};

// ===== Validation schemas =====

export const emailAddressSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const attachmentSchema = z.object({
  attachmentId: z.string(),
  partId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
});

export const calendarAttendeeSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  status: z.enum(["NEEDS-ACTION", "ACCEPTED", "DECLINED", "TENTATIVE"]),
  role: z.enum(["REQ-PARTICIPANT", "OPT-PARTICIPANT", "CHAIR", "NON-PARTICIPANT"]).optional(),
});

export const calendarEventSchema = z.object({
  uid: z.string(),
  summary: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean().optional(),
  organizer: emailAddressSchema.optional(),
  attendees: z.array(calendarAttendeeSchema).optional(),
  method: z.enum(["REQUEST", "REPLY", "CANCEL", "PUBLISH"]),
  status: z.enum(["TENTATIVE", "CONFIRMED", "CANCELLED"]).optional(),
  recurrence: z.string().optional(),
  sequence: z.number().optional(),
  conferenceUrl: z.string().optional(),
  myStatus: z.enum(["NEEDS-ACTION", "ACCEPTED", "DECLINED", "TENTATIVE"]).optional(),
});

export const emailSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: emailAddressSchema,
  to: z.array(emailAddressSchema),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  replyTo: emailAddressSchema.optional(),
  messageId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  date: z.string(),
  body: z.string(),
  bodyHtml: z.string().optional(),
  snippet: z.string(),
  labelIds: z.array(z.string()),
  attachments: z.array(attachmentSchema),
  calendarEvent: calendarEventSchema.optional(),
  sizeEstimate: z.number().optional(),
});
