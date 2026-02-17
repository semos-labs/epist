import { atom } from "jotai";
import { groupIntoThreads, type Email, type LabelId } from "../domain/email.ts";
import { type EpistConfig, type AccountConfig, getDefaultConfig } from "../utils/config.ts";

import type { AccountInfo } from "../auth/tokens.ts";

// ===== Focus Context =====
export type FocusContext =
  | "list"      // Email list sidebar
  | "view"      // Email view panel
  | "folders"   // Folder sidebar
  | "command"   // Command bar
  | "search"    // Search mode
  | "compose"   // Compose email (future)
  | "reply";    // Reply to email

// ===== Overlay Types =====
export type OverlayKind = "help" | "compose" | "confirm" | "moveToFolder" | "accounts" | "addAccount";

export interface Overlay {
  kind: OverlayKind;
  payload?: any;
  prevFocus?: FocusContext;
}

// ===== Core Atoms =====

// All emails
export const emailsAtom = atom<Email[]>([]);

// Application configuration (loaded from ~/.config/epist/config.toml)
export const configAtom = atom<EpistConfig>(getDefaultConfig());

// ===== Multi-Account =====

// All accounts — merges Google OAuth accounts with IMAP accounts from config
export const accountsAtom = atom<AccountConfig[]>((get) => {
  const result: AccountConfig[] = [];
  const seen = new Set<string>();

  // 1. Google OAuth accounts (always included when logged in)
  const googleAccounts = get(googleAccountsAtom);
  for (let i = 0; i < googleAccounts.length; i++) {
    const ga = googleAccounts[i]!;
    result.push({
      name: ga.name || ga.email.split("@")[0] || "Account",
      email: ga.email,
      provider: "gmail" as const,
      is_default: i === 0 && result.length === 0,
    });
    seen.add(ga.email.toLowerCase());
  }

  // 2. IMAP accounts from config (always included)
  const config = get(configAtom);
  for (const acc of config.accounts) {
    if (acc.provider === "imap" && !seen.has(acc.email.toLowerCase())) {
      result.push(acc);
      seen.add(acc.email.toLowerCase());
    }
  }

  // 3. If no OAuth accounts, also include Gmail config accounts as fallback
  if (googleAccounts.length === 0) {
    for (const acc of config.accounts) {
      if (acc.provider === "gmail" && !seen.has(acc.email.toLowerCase())) {
        result.push(acc);
        seen.add(acc.email.toLowerCase());
      }
    }
  }

  return result;
});

// Active account index for the global app context
export const activeAccountIndexAtom = atom<number>(0);

// Active account (derived)
export const activeAccountAtom = atom<AccountConfig | null>((get) => {
  const accounts = get(accountsAtom);
  const index = get(activeAccountIndexAtom);
  return accounts[index] ?? accounts[0] ?? null;
});

// Account selected for the current reply/compose (can differ from active)
export const replyFromAccountIndexAtom = atom<number>(0);

// Derived: reply "from" account
export const replyFromAccountAtom = atom<AccountConfig | null>((get) => {
  const accounts = get(accountsAtom);
  const index = get(replyFromAccountIndexAtom);
  return accounts[index] ?? accounts[0] ?? null;
});

// ===== Auth State =====

// Whether user is logged in to Google
export const isLoggedInAtom = atom<boolean>(false);

// Whether an auth operation is in progress
export const isAuthLoadingAtom = atom<boolean>(false);

// Connected Google accounts (from OAuth tokens, not config)
export const googleAccountsAtom = atom<AccountInfo[]>([]);

// ===== Sync State =====

// Gmail label counts from the server (fetched via API, not derived from local emails)
export const gmailLabelCountsAtom = atom<Record<string, { total: number; unread: number }>>({});

// Whether more emails can be loaded (pagination)
export const hasMoreEmailsAtom = atom<boolean>(false);

// Whether a sync operation is currently in progress
export const isSyncingAtom = atom<boolean>(false);

// Current label/folder view (system or custom label ID)
export const currentLabelAtom = atom<LabelId>("INBOX");

// User/custom labels fetched from Gmail (per account)
export interface UserLabel {
  id: string;
  name: string;
  color?: string; // terminal color name
  accountEmail: string;
}
export const userLabelsAtom = atom<UserLabel[]>([]);

// Whether the categories section in the folder sidebar is expanded
export const categoriesExpandedAtom = atom<boolean>(false);

// Account filter for inbox (null = all accounts / combined inbox)
export const accountFilterAtom = atom<string | null>(null);

// Currently selected email ID
// Keep for backward compat — actions use this for individual email operations
export const selectedEmailIdAtom = atom<string | null>(null);

// Current focus context
export const focusAtom = atom<FocusContext>("list");

// Search query
export const searchQueryAtom = atom<string>("");

// Search results (email IDs)
export const searchResultsAtom = atom<string[]>([]);

// Local FTS5 search results (from SQLite full-text index)
export const searchLocalResultsAtom = atom<Email[]>([]);

// Remote search results (emails fetched from Gmail API)
export const searchRemoteResultsAtom = atom<Email[]>([]);

// Whether a remote Gmail search is in progress
export const isSearchingRemoteAtom = atom<boolean>(false);

// Search selected index
export const searchSelectedIndexAtom = atom<number>(0);

// Overlay stack
export const overlayStackAtom = atom<Overlay[]>([]);

// Undo stack — stores previous email states for reversible actions
export interface UndoEntry {
  description: string;
  emails: Email[];
  selectedThreadId: string | null;
  timestamp: number;
}
export const undoStackAtom = atom<UndoEntry[]>([]);

// Scroll offset for email list
export const listScrollOffsetAtom = atom<number>(0);

// How many threads are visible in the list (set by EmailList on layout)
export const listVisibleCountAtom = atom<number>(10);

// Snapshot of which threads are "unread" for list sorting purposes.
// Prevents the list from reordering mid-read — only refreshes on navigation events.
// Key: threadId, Value: hasUnread at snapshot time. Empty map = use live data.
export const unreadSortSnapshotAtom = atom<Map<string, boolean>>(new Map());

// Scroll offset for email view (ScrollView clamps internally)
export const viewScrollOffsetAtom = atom<number>(0);

// Header visibility in email view — tracks which message IDs have expanded headers
export const expandedHeadersAtom = atom<Record<string, boolean>>({});
// Debug: show raw HTML for a specific message (toggled per-message)
export const debugHtmlAtom = atom<Record<string, boolean>>({});
// Backward compat alias — true if ANY header is expanded
export const headersExpandedAtom = atom(
  (get) => Object.keys(get(expandedHeadersAtom)).length > 0
);

// Focused message index within a conversation thread (-1 = latest)
export const focusedMessageIndexAtom = atom<number>(-1);

// Attachment viewer state
export const selectedAttachmentIndexAtom = atom<number>(-1); // -1 means no attachment selected
export const attachmentsFocusedAtom = atom<boolean>(false); // Whether attachment section has focus

// Downloads directory (default to ~/Downloads)
export const downloadsPathAtom = atom<string>(
  process.env.HOME ? `${process.env.HOME}/Downloads` : "/tmp"
);

// ===== Reply State =====

// Reply mode: null = not replying, 'reply' = reply to sender, 'replyAll' = reply to all, 'compose' = new email, 'forward' = forward
export type ReplyMode = null | "reply" | "replyAll" | "compose" | "forward";
export const replyModeAtom = atom<ReplyMode>(null);

// Reply fields
export const replyToAtom = atom<string>("");
export const replyCcAtom = atom<string>("");
export const replyBccAtom = atom<string>("");
export const replySubjectAtom = atom<string>("");
export const replyContentAtom = atom<string>("");
export const draftIdAtom = atom<string | null>(null);

// Email signature (local/config fallback)
export const signatureAtom = atom<string>("\n--\nSent from Epist");

// Gmail signatures fetched from the server (accountEmail → plain text signature)
export const gmailSignaturesAtom = atom<Record<string, string>>({});

// The signature block currently inserted in the compose body (for swapping on account toggle)
export const currentComposeSigAtom = atom<string>("");

// Quick inline reply (in email view, without full compose modal)
export const inlineReplyOpenAtom = atom<boolean>(false);
export const inlineReplyContentAtom = atom<string>("");

// Contacts derived from all emails (from + to addresses)
export const contactsAtom = atom((get) => {
  const emails = get(emailsAtom);
  const accounts = get(accountsAtom);
  const ownEmails = new Set(accounts.map(a => a.email.toLowerCase()));
  const seen = new Map<string, { email: string; name?: string; count: number }>();
  
  for (const e of emails) {
    const addrs = [e.from, ...e.to, ...(e.cc || []), ...(e.bcc || [])];
    for (const addr of addrs) {
      if (ownEmails.has(addr.email.toLowerCase())) continue; // skip own accounts
      const key = addr.email.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.count++;
        if (addr.name && !existing.name) existing.name = addr.name;
      } else {
        seen.set(key, { email: addr.email, name: addr.name, count: 1 });
      }
    }
  }
  
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
});

// Contact suggestions for current input
export const contactSuggestionsAtom = atom<Array<{ email: string; name?: string }>>([]);
export const contactSuggestionIndexAtom = atom<number>(0);
export type ContactField = "to" | "cc" | "bcc";
export const activeContactFieldAtom = atom<ContactField>("to");
export const replyAttachmentsAtom = atom<string[]>([]);

// Reply view mode: compact (bottom-right popup) or fullscreen
export const replyFullscreenAtom = atom<boolean>(false);

// Show CC/BCC fields (collapsed by default)
export const replyShowCcBccAtom = atom<boolean>(false);

// Compose attachment management
export const composeAttachmentIndexAtom = atom<number>(-1); // -1 = not in attachment mode
export const composeAttachmentModeAtom = atom<boolean>(false); // Whether in attachment selection mode

// ===== Email Body / Image State =====

// Focused image index in the email body (-1 = no image focused)
export const focusedImageIndexAtom = atom<number>(-1);

// Whether we're in "image navigation" mode in the body
export const imageNavModeAtom = atom<boolean>(false);

// Link navigation in the email body
export const emailLinksAtom = atom<{ href: string; lineIndex: number }[]>([]);
export const activeLinkIndexAtom = atom<number>(-1); // -1 = not navigating links

// Bulk selection
export const selectedThreadIdsAtom = atom<Set<string>>(new Set<string>());
export const bulkModeAtom = atom<boolean>(false);

// Layout mode — driven by terminal width via useMediaQuery in App.tsx
export type LayoutMode = "wide" | "narrow" | "compact";
export const layoutModeAtom = atom<LayoutMode>("wide");

// Folder sidebar state
export const folderSidebarOpenAtom = atom<boolean>(false);
export const selectedFolderIndexAtom = atom<number>(0);

// Attachment picker state
export const attachmentPickerOpenAtom = atom<boolean>(false);
export const attachmentPickerQueryAtom = atom<string>("");
export const attachmentPickerResultsAtom = atom<string[]>([]);
export const attachmentPickerSelectedIndexAtom = atom<number>(0);
export const attachmentPickerSelectedFilesAtom = atom<Set<string>>(new Set<string>()); // Multi-select
export const attachmentPickerLoadingAtom = atom<boolean>(false);
export const attachmentPickerCwdAtom = atom<string>(`${process.env.HOME || ""}/Documents`);

// Derived: check if in reply mode
export const isReplyingAtom = atom((get) => get(replyModeAtom) !== null);

// ===== Derived Atoms =====

// Get emails filtered by current label and account
export const filteredEmailsAtom = atom((get) => {
  const emails = get(emailsAtom);
  const label = get(currentLabelAtom);
  const focus = get(focusAtom);
  const accountFilter = get(accountFilterAtom);
  
  // In search mode: combine local FTS5 results + remote results (ignore label filter)
  // NOTE: we intentionally do NOT depend on searchQueryAtom here — that would cause
  // the entire email list to re-render on every keystroke. Instead we check whether
  // any search results exist, which only changes when the debounced FTS/remote
  // searches actually produce new data.
  if (focus === "search") {
    const localResults = get(searchLocalResultsAtom);
    const remoteResults = get(searchRemoteResultsAtom);
    
    if (localResults.length > 0 || remoteResults.length > 0) {
      // Combine local + remote, dedup by ID (local first — they're ranked by relevance)
      const seen = new Set<string>();
      const combined: Email[] = [];
      
      for (const e of localResults) {
        if (!seen.has(e.id)) {
          if (accountFilter && e.accountEmail !== accountFilter) continue;
          seen.add(e.id);
          combined.push(e);
        }
      }
      
      for (const e of remoteResults) {
        if (!seen.has(e.id)) {
          if (accountFilter && e.accountEmail !== accountFilter) continue;
          seen.add(e.id);
          combined.push(e);
        }
      }
      
      return combined;
    }
  }
  
  let filtered = emails.filter(e => e.labelIds.includes(label));
  
  // Apply account filter
  if (accountFilter) {
    filtered = filtered.filter(e => e.accountEmail === accountFilter);
  }
  
  // Sort by date, newest first
  return filtered.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
});

// Threads grouped from filtered emails.
// In normal (non-search) mode: unread threads first, then read — both groups sorted by recency.
// Uses a snapshot for the unread/read partition so the list doesn't reorder while the user
// reads an email. The snapshot is refreshed on navigation (moveSelectionAtom) and label switches.
// In search mode: preserve FTS relevance ranking as-is.
export const filteredThreadsAtom = atom((get) => {
  const emails = get(filteredEmailsAtom);
  const threads = groupIntoThreads(emails);
  const focus = get(focusAtom);

  // In search mode, keep FTS ranking order
  if (focus === "search") return threads;

  const snapshot = get(unreadSortSnapshotAtom);

  // Partition into unread-first, then read — both sorted by date (already are from groupIntoThreads)
  const unread: typeof threads = [];
  const read: typeof threads = [];
  for (const t of threads) {
    // Use snapshot for known threads; live hasUnread for new threads not yet in the snapshot
    const isUnread = snapshot.size > 0 && snapshot.has(t.id) ? snapshot.get(t.id)! : t.hasUnread;
    (isUnread ? unread : read).push(t);
  }
  return [...unread, ...read];
});

// Index of the first "read" thread in the sorted list — used to render the separator.
// Returns -1 if there's no boundary (all unread, all read, or search mode).
export const unreadSeparatorIndexAtom = atom((get) => {
  const threads = get(filteredThreadsAtom);
  const focus = get(focusAtom);
  if (focus === "search") return -1;

  const snapshot = get(unreadSortSnapshotAtom);

  for (let i = 0; i < threads.length; i++) {
    const t = threads[i]!;
    const isUnread = snapshot.size > 0 && snapshot.has(t.id) ? snapshot.get(t.id)! : t.hasUnread;
    if (!isUnread) {
      // Only show separator if there are unread threads above
      return i > 0 ? i : -1;
    }
  }
  return -1; // all unread or empty
});

// Selected thread ID (we select threads, not individual emails)
export const selectedThreadIdAtom = atom<string | null>(null);

// Get currently selected thread
export const selectedThreadAtom = atom((get) => {
  const threads = get(filteredThreadsAtom);
  const threadId = get(selectedThreadIdAtom);
  return threadId ? threads.find(t => t.id === threadId) ?? null : null;
});

// Get currently selected email (latest in selected thread, for compatibility)
export const selectedEmailAtom = atom((get) => {
  const thread = get(selectedThreadAtom);
  return thread ? thread.latest : null;
});

// Get selected index in filtered thread list
export const selectedIndexAtom = atom((get) => {
  const threads = get(filteredThreadsAtom);
  const threadId = get(selectedThreadIdAtom);
  return threads.findIndex(t => t.id === threadId);
});

// Get unread count for current label
export const unreadCountAtom = atom((get) => {
  const filtered = get(filteredEmailsAtom);
  return filtered.filter(e => e.labelIds.includes("UNREAD")).length;
});

// Get total count for current label (thread count)
export const totalCountAtom = atom((get) => {
  const threads = get(filteredThreadsAtom);
  return threads.length;
});

// Get top overlay
export const topOverlayAtom = atom((get) => {
  const stack = get(overlayStackAtom);
  return stack.length > 0 ? stack[stack.length - 1] : null;
});

// Check if any overlay is open
export const hasOverlayAtom = atom((get) => {
  const stack = get(overlayStackAtom);
  return stack.length > 0;
});

// Get label counts — uses Gmail API counts when available, falls back to local count
export const labelCountsAtom = atom((get) => {
  const gmailCounts = get(gmailLabelCountsAtom);
  const isLoggedIn = get(isLoggedInAtom);

  // When logged in, prefer server-side counts (accurate even when we only cache 30 emails)
  if (isLoggedIn && Object.keys(gmailCounts).length > 0) {
    // Ensure all folders have an entry
    const defaults: Record<string, { total: number; unread: number }> = {
      INBOX: { total: 0, unread: 0 },
      SENT: { total: 0, unread: 0 },
      DRAFT: { total: 0, unread: 0 },
      TRASH: { total: 0, unread: 0 },
      SPAM: { total: 0, unread: 0 },
      STARRED: { total: 0, unread: 0 },
      IMPORTANT: { total: 0, unread: 0 },
    };
    return { ...defaults, ...gmailCounts };
  }

  // Fallback: derive counts from locally cached emails
  const emails = get(emailsAtom);
  const accountFilter = get(accountFilterAtom);
  
  const filtered = accountFilter
    ? emails.filter(e => e.accountEmail === accountFilter)
    : emails;
  
  const counts: Record<string, { total: number; unread: number }> = {
    INBOX: { total: 0, unread: 0 },
    SENT: { total: 0, unread: 0 },
    DRAFT: { total: 0, unread: 0 },
    TRASH: { total: 0, unread: 0 },
    SPAM: { total: 0, unread: 0 },
    STARRED: { total: 0, unread: 0 },
    IMPORTANT: { total: 0, unread: 0 },
  };
  
  for (const email of filtered) {
    for (const label of email.labelIds) {
      if (counts[label]) {
        counts[label].total++;
        if (email.labelIds.includes("UNREAD")) {
          counts[label].unread++;
        }
      }
    }
  }
  
  return counts;
});
