/**
 * MailProvider — unified interface for email backends.
 *
 * Gmail and IMAP/SMTP both implement this interface so the rest of the app
 * (sync engine, actions, UI) never talks to a specific backend directly.
 *
 * Design notes:
 *   • Gmail labels are mapped onto a virtual label model.
 *     IMAP folders + flags are also mapped onto the same model:
 *       IMAP \Seen      → absence of "UNREAD"
 *       IMAP \Flagged   → "STARRED"
 *       IMAP \Draft      → "DRAFT"
 *       IMAP \Deleted    → "TRASH"
 *       IMAP folder name → label ID  (e.g. "INBOX", "Sent", custom folders)
 *   • Threading: Gmail provides threadId natively.
 *     IMAP providers synthesize one from the References / In-Reply-To chain.
 *   • Connection lifecycle: Gmail is stateless REST (connect/disconnect are no-ops).
 *     IMAP maintains a TCP connection that can drop and needs reconnection.
 */

import type { Email, LabelId } from "../domain/email.ts";
import type { AccountConfig } from "../utils/config.ts";

// ===== Shared types =====

export interface MessageListingItem {
  id: string;
  threadId: string;
}

export interface MessageListing {
  messages: MessageListingItem[];
  nextPageToken?: string;
}

export interface FolderInfo {
  /** Canonical folder ID — matches LabelId for system folders */
  id: string;
  /** Human-readable name */
  name: string;
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
  /** Terminal color name (for user labels) */
  color?: string;
}

export interface SendOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  /** RFC 2822 Message-ID of the message being replied to */
  inReplyTo?: string;
  /** RFC 2822 References header chain */
  references?: string[];
  /** Thread ID (Gmail-native; ignored by IMAP) */
  threadId?: string;
}

export interface SendAsAlias {
  email: string;
  name: string;
  signature?: string;
  isPrimary?: boolean;
}

// ===== Sync types =====

/** Provider-specific opaque sync cursor */
export interface SyncCursor {
  /** Gmail: historyId.  IMAP: JSON-encoded {uidValidity, uidNext} */
  value: string;
  /** For paginated initial loads */
  nextPageToken?: string;
}

export interface SyncDelta {
  /** Fully parsed new/modified emails to upsert */
  upsert: Email[];
  /** Message IDs that were deleted server-side */
  deleted: string[];
  /** Updated sync cursor for the next poll */
  cursor: SyncCursor;
}

// ===== The interface =====

export interface MailProvider {
  /** "gmail" | "imap" — useful for conditional logic */
  readonly type: string;
  /** The email address this provider instance serves */
  readonly accountEmail: string;

  // ----- Lifecycle -----

  /** Establish connection (IMAP) or validate credentials (Gmail). */
  connect(): Promise<void>;
  /** Tear down the connection gracefully. */
  disconnect(): Promise<void>;

  // ----- Reading -----

  /** List message stubs (id + threadId) in a folder, paginated. */
  listMessages(options?: {
    folder?: LabelId;
    query?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<MessageListing>;

  /** Fetch a single message by ID, fully parsed. */
  getMessage(messageId: string): Promise<Email>;

  /** Batch-fetch messages by IDs (provider may parallelise). */
  getMessages(messageIds: string[]): Promise<Email[]>;

  /**
   * Get all messages in a thread.
   * Gmail: calls threads.get.
   * IMAP: returns the single message (threading is done client-side).
   */
  getThread(threadId: string): Promise<Email[]>;

  /** Full-text search. Returns fully parsed emails. */
  searchMessages(query: string, maxResults?: number): Promise<Email[]>;

  // ----- Mutations -----

  markRead(messageId: string): Promise<void>;
  markUnread(messageId: string): Promise<void>;
  star(messageId: string): Promise<void>;
  unstar(messageId: string): Promise<void>;
  archive(messageId: string): Promise<void>;
  trash(messageId: string): Promise<void>;
  untrash(messageId: string): Promise<void>;
  moveToFolder(messageId: string, targetFolder: string, sourceFolder?: string): Promise<void>;

  // ----- Sending -----

  sendMessage(options: SendOptions): Promise<void>;

  // ----- Folders / Labels -----

  /** List all folders (system + user/custom). */
  listFolders(): Promise<FolderInfo[]>;

  /**
   * Fetch unread/total counts per folder.
   * @param folderIds — which folders to query (defaults to standard set)
   */
  getFolderCounts(folderIds?: string[]): Promise<Record<string, { total: number; unread: number }>>;

  // ----- Attachments -----

  /** Download a single attachment by its provider-specific ID. */
  getAttachment(messageId: string, attachmentId: string): Promise<Uint8Array>;

  // ----- Sync -----

  /**
   * Get the initial sync cursor (e.g. Gmail historyId from profile,
   * or IMAP UIDVALIDITY + UIDNEXT).
   */
  getInitialSyncCursor(): Promise<SyncCursor>;

  /**
   * Fetch changes since a previous cursor — the core of incremental sync.
   * Returns new/modified/deleted messages + updated cursor.
   */
  getChangesSince(cursor: SyncCursor): Promise<SyncDelta>;

  // ----- Optional -----

  /** List send-as aliases with signatures (Gmail only for now). */
  getSendAsAliases?(): Promise<SendAsAlias[]>;
}

// ===== Provider registry =====

const _providers = new Map<string, MailProvider>();

/**
 * Register a provider instance for an account.
 * Call after creating + connecting the provider.
 */
export function registerProvider(provider: MailProvider): void {
  _providers.set(provider.accountEmail, provider);
}

/**
 * Get the provider for a given account email.
 * Throws if not found — callers should ensure the account is initialised.
 */
export function getProvider(accountEmail: string): MailProvider {
  const p = _providers.get(accountEmail);
  if (!p) throw new Error(`No mail provider registered for ${accountEmail}`);
  return p;
}

/**
 * Get provider if it exists, or null. Useful for optional/fire-and-forget calls.
 */
export function getProviderOrNull(accountEmail: string): MailProvider | null {
  return _providers.get(accountEmail) ?? null;
}

/** Remove a provider (e.g. on logout). Does NOT call disconnect — caller should. */
export function unregisterProvider(accountEmail: string): void {
  _providers.delete(accountEmail);
}

/** Get all registered providers. */
export function getAllProviders(): MailProvider[] {
  return Array.from(_providers.values());
}

/** Check if a provider is registered for the given account. */
export function hasProvider(accountEmail: string): boolean {
  return _providers.has(accountEmail);
}

// ===== Factory =====

/**
 * Create and register a MailProvider for an account config.
 * Does NOT call connect() — caller should do that when ready.
 */
export async function createProvider(account: AccountConfig): Promise<MailProvider> {
  // Lazy imports to avoid circular deps
  switch (account.provider) {
    case "gmail": {
      const { GmailProvider } = await import("./gmail-provider.ts");
      const provider = new GmailProvider(account.email);
      registerProvider(provider);
      return provider;
    }
    case "imap": {
      if (!account.imap || !account.smtp) {
        throw new Error(
          `Account ${account.email} is configured as "imap" but missing [accounts.imap] or [accounts.smtp] settings in config.toml`
        );
      }
      const { ImapSmtpProvider } = await import("./imap-provider.ts");
      const provider = new ImapSmtpProvider(account.email, account.imap, account.smtp);
      registerProvider(provider);
      return provider;
    }
    default:
      throw new Error(`Unknown provider "${account.provider}" for account ${account.email}`);
  }
}

/**
 * Create and connect providers for a list of accounts.
 * Returns only the ones that connected successfully.
 */
export async function initProviders(accounts: AccountConfig[]): Promise<MailProvider[]> {
  const connected: MailProvider[] = [];

  for (const account of accounts) {
    try {
      const provider = await createProvider(account);
      await provider.connect();
      connected.push(provider);
    } catch (err) {
      // Log but don't stop — other accounts might work fine
      console.error(`Failed to init provider for ${account.email}:`, err);
    }
  }

  return connected;
}
