import { atom } from "jotai";
import type { Email, LabelId, FolderLabel } from "../domain/email.ts";
import { mockEmails } from "../mock/emails.ts";

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
export type OverlayKind = "help" | "compose" | "confirm";

export interface Overlay {
  kind: OverlayKind;
  payload?: any;
  prevFocus?: FocusContext;
}

// ===== Message System =====
export type MessageType = "info" | "success" | "warning" | "error";

export interface Message {
  id: string;
  text: string;
  type: MessageType;
}

// ===== Core Atoms =====

// All emails
export const emailsAtom = atom<Email[]>(mockEmails);

// Current label/folder view
export const currentLabelAtom = atom<FolderLabel>("INBOX");

// Currently selected email ID
export const selectedEmailIdAtom = atom<string | null>(mockEmails[0]?.id ?? null);

// Current focus context
export const focusAtom = atom<FocusContext>("list");

// Search query
export const searchQueryAtom = atom<string>("");

// Search results (email IDs)
export const searchResultsAtom = atom<string[]>([]);

// Search selected index
export const searchSelectedIndexAtom = atom<number>(0);

// Overlay stack
export const overlayStackAtom = atom<Overlay[]>([]);

// Command input
export const commandInputAtom = atom<string>("");

// Command palette selection index
export const commandSelectedIndexAtom = atom<number>(0);

// Status message (vim-style)
export const messageAtom = atom<Message | null>(null);

// Message visibility
export const messageVisibleAtom = atom<boolean>(true);

// Scroll offset for email list
export const listScrollOffsetAtom = atom<number>(0);

// Scroll offset for email view (ScrollView clamps internally)
export const viewScrollOffsetAtom = atom<number>(0);

// Header visibility in email view (collapsed by default)
export const headersExpandedAtom = atom<boolean>(false);

// Attachment viewer state
export const selectedAttachmentIndexAtom = atom<number>(-1); // -1 means no attachment selected
export const attachmentsFocusedAtom = atom<boolean>(false); // Whether attachment section has focus

// Downloads directory (default to ~/Downloads)
export const downloadsPathAtom = atom<string>(
  process.env.HOME ? `${process.env.HOME}/Downloads` : "/tmp"
);

// ===== Reply State =====

// Reply mode: null = not replying, 'reply' = reply to sender, 'replyAll' = reply to all
export type ReplyMode = null | "reply" | "replyAll";
export const replyModeAtom = atom<ReplyMode>(null);

// Reply fields
export const replyToAtom = atom<string>("");
export const replyCcAtom = atom<string>("");
export const replyBccAtom = atom<string>("");
export const replySubjectAtom = atom<string>("");
export const replyContentAtom = atom<string>("");
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

// Get emails filtered by current label
export const filteredEmailsAtom = atom((get) => {
  const emails = get(emailsAtom);
  const label = get(currentLabelAtom);
  const searchQuery = get(searchQueryAtom);
  const focus = get(focusAtom);
  
  let filtered = emails.filter(e => e.labelIds.includes(label));
  
  // Apply search filter if in search mode
  if (focus === "search" && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(e => 
      e.subject.toLowerCase().includes(query) ||
      e.from.name?.toLowerCase().includes(query) ||
      e.from.email.toLowerCase().includes(query) ||
      e.snippet.toLowerCase().includes(query)
    );
  }
  
  // Sort by date, newest first
  return filtered.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
});

// Get currently selected email
export const selectedEmailAtom = atom((get) => {
  const emails = get(emailsAtom);
  const selectedId = get(selectedEmailIdAtom);
  return selectedId ? emails.find(e => e.id === selectedId) ?? null : null;
});

// Get selected index in filtered list
export const selectedIndexAtom = atom((get) => {
  const filtered = get(filteredEmailsAtom);
  const selectedId = get(selectedEmailIdAtom);
  return filtered.findIndex(e => e.id === selectedId);
});

// Get unread count for current label
export const unreadCountAtom = atom((get) => {
  const filtered = get(filteredEmailsAtom);
  return filtered.filter(e => e.labelIds.includes("UNREAD")).length;
});

// Get total count for current label
export const totalCountAtom = atom((get) => {
  const filtered = get(filteredEmailsAtom);
  return filtered.length;
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

// Get label counts
export const labelCountsAtom = atom((get) => {
  const emails = get(emailsAtom);
  const counts: Record<string, { total: number; unread: number }> = {
    INBOX: { total: 0, unread: 0 },
    SENT: { total: 0, unread: 0 },
    DRAFT: { total: 0, unread: 0 },
    TRASH: { total: 0, unread: 0 },
    SPAM: { total: 0, unread: 0 },
    STARRED: { total: 0, unread: 0 },
    IMPORTANT: { total: 0, unread: 0 },
  };
  
  for (const email of emails) {
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
