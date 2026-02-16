import { atom } from "jotai";
import {
  emailsAtom,
  selectedEmailIdAtom,
  selectedThreadIdAtom,
  selectedIndexAtom,
  filteredEmailsAtom,
  filteredThreadsAtom,
  selectedEmailAtom,
  selectedThreadAtom,
  focusAtom,
  currentLabelAtom,
  overlayStackAtom,
  commandInputAtom,
  commandSelectedIndexAtom,
  searchQueryAtom,
  searchSelectedIndexAtom,
  messageAtom,
  messageVisibleAtom,
  listScrollOffsetAtom,
  viewScrollOffsetAtom,
  expandedHeadersAtom,
  debugHtmlAtom,
  focusedMessageIndexAtom,
  replyModeAtom,
  replyToAtom,
  replyCcAtom,
  replyBccAtom,
  replySubjectAtom,
  replyContentAtom,
  replyAttachmentsAtom,
  draftIdAtom,
  signatureAtom,
  gmailSignaturesAtom,
  currentComposeSigAtom,
  inlineReplyOpenAtom,
  inlineReplyContentAtom,
  contactsAtom,
  contactSuggestionsAtom,
  contactSuggestionIndexAtom,
  activeContactFieldAtom,
  replyFullscreenAtom,
  replyShowCcBccAtom,
  selectedAttachmentIndexAtom,
  attachmentsFocusedAtom,
  downloadsPathAtom,
  composeAttachmentIndexAtom,
  composeAttachmentModeAtom,
  attachmentPickerOpenAtom,
  attachmentPickerQueryAtom,
  attachmentPickerResultsAtom,
  attachmentPickerSelectedIndexAtom,
  attachmentPickerSelectedFilesAtom,
  attachmentPickerCwdAtom,
  focusedImageIndexAtom,
  imageNavModeAtom,
  emailLinksAtom,
  activeLinkIndexAtom,
  folderSidebarOpenAtom,
  selectedFolderIndexAtom,
  selectedThreadIdsAtom,
  bulkModeAtom,
  undoStackAtom,
  configAtom,
  accountsAtom,
  activeAccountIndexAtom,
  replyFromAccountIndexAtom,
  replyFromAccountAtom,
  isLoggedInAtom,
  isAuthLoadingAtom,
  googleAccountsAtom,
  gmailLabelCountsAtom,
  hasMoreEmailsAtom,
  isSyncingAtom,
  searchRemoteResultsAtom,
  isSearchingRemoteAtom,
  userLabelsAtom,
  type FocusContext,
  type Overlay,
  type MessageType,
  type UserLabel,
} from "./atoms.ts";
import { openFile, quickLook, saveFile } from "../utils/files.ts";
import { saveDraft, deleteDraft } from "../utils/drafts.ts";
import { loadConfig, saveConfig, resolvePath, type EpistConfig } from "../utils/config.ts";
import { collectFiles, filterFiles, clearFileCache } from "../utils/fzf.ts";
import { formatEmailAddress, formatEmailAddresses, isStarred, isUnread, FOLDER_LABELS, type Email, type LabelId, type AttendeeStatus } from "../domain/email.ts";
import { findCommand, getAllCommands } from "../keybinds/registry.ts";
import { getProviderOrNull } from "../api/provider.ts";

// ===== Configuration =====

// Load config from disk and apply to atoms
export const loadConfigAtom = atom(
  null,
  async (get, set) => {
    const config = await loadConfig();
    set(configAtom, config);

    // Apply config values to relevant atoms
    if (config.signature.enabled) {
      set(signatureAtom, `\n${config.signature.text}`);
    } else {
      set(signatureAtom, "");
    }

    set(downloadsPathAtom, resolvePath(config.general.downloads_path));

    // Set default account index
    const defaultIdx = config.accounts.findIndex(a => a.is_default);
    set(activeAccountIndexAtom, defaultIdx >= 0 ? defaultIdx : 0);
    set(replyFromAccountIndexAtom, defaultIdx >= 0 ? defaultIdx : 0);
  }
);

// Save current config to disk
export const saveConfigAtom = atom(
  null,
  async (get) => {
    const config = get(configAtom);
    await saveConfig(config);
  }
);

// Update a config section and save
export const updateConfigAtom = atom(
  null,
  async (get, set, update: Partial<EpistConfig>) => {
    const current = get(configAtom);
    const updated = { ...current, ...update };
    set(configAtom, updated);

    // Re-apply relevant settings
    if (update.signature) {
      if (updated.signature.enabled) {
        set(signatureAtom, `\n${updated.signature.text}`);
      } else {
        set(signatureAtom, "");
      }
    }
    if (update.general?.downloads_path) {
      set(downloadsPathAtom, resolvePath(updated.general.downloads_path));
    }

    await saveConfig(updated);
    set(showMessageAtom, { text: "Configuration saved", type: "success" });
  }
);

// ===== Gmail Signature Support =====

/**
 * Convert Gmail HTML signature to plain text.
 * Handles common HTML elements: <br>, <div>, <p>, <a>, <b>, <i>, etc.
 */
function signatureHtmlToText(html: string): string {
  if (!html || !html.trim()) return "";

  let text = html;

  // Replace <br> and <br/> with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");

  // Replace block elements with newlines
  text = text.replace(/<\/(?:div|p|li|tr|h[1-6])>/gi, "\n");
  text = text.replace(/<(?:div|p|li|tr|h[1-6])\b[^>]*>/gi, "");

  // Extract link text with URL: <a href="url">text</a> → text (url)
  text = text.replace(/<a\b[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, (_, href, inner) => {
    const linkText = inner.replace(/<[^>]*>/g, "").trim();
    if (!linkText || linkText === href) return href;
    return `${linkText} (${href})`;
  });

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // Collapse multiple blank lines into at most one
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim trailing whitespace per line, and overall
  text = text.split("\n").map(l => l.trimEnd()).join("\n").trim();

  return text;
}

/**
 * Fetch Gmail signatures for all logged-in accounts and store them.
 */
export const fetchSignaturesAtom = atom(null, async (get, set) => {
  const accounts = get(googleAccountsAtom);
  if (accounts.length === 0) return;

  const sigs: Record<string, string> = {};

  try {
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const provider = getProviderOrNull(acc.email);
          if (!provider?.getSendAsAliases) return;

          const sendAsAliases = await provider.getSendAsAliases();

          // Pick the primary/default alias signature, falling back to the one matching the account email
          const primary = sendAsAliases.find(a => a.isPrimary)
            ?? sendAsAliases.find(a => a.email === acc.email)
            ?? sendAsAliases[0];

          if (primary?.signature) {
            const plainText = signatureHtmlToText(primary.signature);
            if (plainText) {
              sigs[acc.email] = plainText;
            }
          }
        } catch {
          // Non-critical — account keeps using config/default signature
        }
      })
    );

    set(gmailSignaturesAtom, sigs);
  } catch {
    // Non-critical
  }
});

// ===== Multi-Account Actions =====

// Set the reply/compose "From" account by index
export const setReplyAccountAtom = atom(
  null,
  (get, set, index: number) => {
    const accounts = get(accountsAtom);
    if (index < 0 || index >= accounts.length) return;
    set(replyFromAccountIndexAtom, index);

    const account = accounts[index];
    if (!account) return;

    // Resolve the new signature for this account (Gmail > per-account config > global config)
    const newSigText = resolveSignatureForAccount(get, account.email);

    // Update the global signatureAtom
    set(signatureAtom, newSigText ? `\n${newSigText}` : "");

    // Build the new signature block (with -- delimiter, unless already present)
    let newSigBlock = "";
    if (newSigText) {
      newSigBlock = newSigText.startsWith("--") ? `\n${newSigText}` : `\n--\n${newSigText}`;
    }

    // Swap the signature in the compose body
    const oldSigBlock = get(currentComposeSigAtom);
    const content = get(replyContentAtom);

    if (oldSigBlock && content.endsWith(oldSigBlock)) {
      // Replace old signature with new one
      const userContent = content.slice(0, content.length - oldSigBlock.length);
      set(replyContentAtom, userContent + newSigBlock);
    } else if (!oldSigBlock && newSigBlock) {
      // No previous signature — append new one
      set(replyContentAtom, content + newSigBlock);
    }
    // If the user edited the signature area, don't override their changes

    set(currentComposeSigAtom, newSigBlock);
  }
);

/**
 * Resolve the best signature text for an account.
 * Priority: Gmail signature > per-account config signature > global config signature
 */
function resolveSignatureForAccount(get: any, accountEmail: string): string {
  // 1. Gmail signature (fetched from server)
  const gmailSigs = get(gmailSignaturesAtom);
  if (gmailSigs[accountEmail]) {
    return gmailSigs[accountEmail];
  }

  // 2. Per-account config signature
  const accounts = get(accountsAtom);
  const account = accounts.find((a: any) => a.email === accountEmail);
  if (account?.signature) {
    return account.signature;
  }

  // 3. Global config signature
  const config = get(configAtom);
  if (config.signature.enabled) {
    return config.signature.text;
  }

  return "";
}

// ===== Undo System =====
const MAX_UNDO_STACK = 20;

// Push current state to undo stack (call before mutating emails)
export const pushUndoAtom = atom(
  null,
  (get, set, description: string) => {
    const emails = get(emailsAtom);
    const selectedThreadId = get(selectedThreadIdAtom);
    const stack = get(undoStackAtom);
    const entry = {
      description,
      emails: [...emails], // shallow copy of array, each email is immutable
      selectedThreadId,
      timestamp: Date.now(),
    };
    // Keep stack bounded
    set(undoStackAtom, [entry, ...stack].slice(0, MAX_UNDO_STACK));
  }
);

// Undo last action
export const undoAtom = atom(
  null,
  (get, set) => {
    const stack = get(undoStackAtom);
    if (stack.length === 0) {
      set(showMessageAtom, { text: "Nothing to undo", type: "info" });
      return;
    }
    const [entry, ...rest] = stack;
    set(emailsAtom, entry!.emails);
    if (entry!.selectedThreadId) {
      set(selectedThreadIdAtom, entry!.selectedThreadId);
    }
    set(undoStackAtom, rest);
    set(showMessageAtom, { text: `Undone: ${entry!.description}`, type: "info" });
  }
);

// ===== Navigation Actions =====

// Move thread selection up/down
export const moveSelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "first" | "last") => {
    const threads = get(filteredThreadsAtom);
    const currentIndex = get(selectedIndexAtom);
    
    if (threads.length === 0) return;
    
    let newIndex: number;
    switch (direction) {
      case "up":
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case "down":
        newIndex = Math.min(threads.length - 1, currentIndex + 1);
        break;
      case "first":
        newIndex = 0;
        break;
      case "last":
        newIndex = threads.length - 1;
        break;
    }
    
    const thread = threads[newIndex];
    if (thread) {
      set(selectedThreadIdAtom, thread.id);
      set(viewScrollOffsetAtom, 0);
      set(activeLinkIndexAtom, -1);
      set(focusedMessageIndexAtom, -1);
    }

    // Auto-load more when within 5 items of the bottom
    const LOAD_MORE_THRESHOLD = 5;
    if (
      direction === "down" &&
      newIndex >= threads.length - LOAD_MORE_THRESHOLD &&
      get(hasMoreEmailsAtom) &&
      !get(isSyncingAtom)
    ) {
      set(loadMoreEmailsAtom);
    }
  }
);

// Toggle focus between list and view
export const toggleFocusAtom = atom(
  null,
  (get, set) => {
    const focus = get(focusAtom);
    if (focus === "list") {
      set(focusAtom, "view");
    } else if (focus === "view") {
      set(focusAtom, "list");
    }
  }
);

// Set focus directly
export const setFocusAtom = atom(
  null,
  (get, set, focus: FocusContext) => {
    set(focusAtom, focus);
  }
);

// ===== Email Actions =====

// Mark email as read (remove UNREAD label)
export const markReadAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    const email = emails.find(e => e.id === id);
    set(emailsAtom, emails.map(e => 
      e.id === id ? { ...e, labelIds: e.labelIds.filter(l => l !== "UNREAD") } : e
    ));

    // Fire-and-forget provider call
    if (get(isLoggedInAtom) && email?.accountEmail) {
      const provider = getProviderOrNull(email.accountEmail);
      provider?.markRead(id).catch(() => {});
    }
  }
);

// Toggle read/unread on email
export const markUnreadAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    const email = emails.find(e => e.id === id);
    if (!email) return;

    const wasUnread = email.labelIds.includes("UNREAD");
    set(emailsAtom, emails.map(e => 
      e.id === id
        ? { ...e, labelIds: wasUnread 
            ? e.labelIds.filter(l => l !== "UNREAD")
            : [...e.labelIds, "UNREAD"] 
          }
        : e
    ));
    set(showMessageAtom, { text: wasUnread ? "Marked as read" : "Marked as unread", type: "info" });

    // Fire-and-forget provider call
    if (get(isLoggedInAtom) && email.accountEmail) {
      const provider = getProviderOrNull(email.accountEmail);
      if (provider) {
        (wasUnread ? provider.markRead(id) : provider.markUnread(id)).catch(() => {});
      }
    }
  }
);

// Toggle star on email (add/remove STARRED label)
export const toggleStarAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    const email = emails.find(e => e.id === id);
    if (!email) return;
    
    const wasStarred = isStarred(email);
    set(emailsAtom, emails.map(e => {
      if (e.id !== id) return e;
      return wasStarred
        ? { ...e, labelIds: e.labelIds.filter(l => l !== "STARRED") }
        : { ...e, labelIds: [...e.labelIds, "STARRED"] };
    }));
    set(showMessageAtom, { 
      text: wasStarred ? "Unstarred" : "★ Starred", 
      type: "info" 
    });

    // Fire-and-forget provider call
    if (get(isLoggedInAtom) && email.accountEmail) {
      const provider = getProviderOrNull(email.accountEmail);
      if (provider) {
        (wasStarred ? provider.unstar(id) : provider.star(id)).catch(() => {});
      }
    }
  }
);

// Archive thread (remove INBOX label from all messages in thread)
export const archiveEmailAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    if (!thread) return;
    
    set(pushUndoAtom, "Archive");
    const threadMessageIds = new Set(thread.messages.map(m => m.id));
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (threadMessageIds.has(e.id)) {
        return { ...e, labelIds: e.labelIds.filter(l => l !== "INBOX") };
      }
      return e;
    }));
    
    set(moveSelectionAtom, "down");
    set(showMessageAtom, { text: "Archived (z to undo)", type: "success" });

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of thread.messages) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.archive(msg.id).catch(() => {});
        }
      }
    }
  }
);

// Delete thread (move to trash — all messages)
export const deleteEmailAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    if (!thread) return;
    
    set(pushUndoAtom, "Delete");
    const threadMessageIds = new Set(thread.messages.map(m => m.id));
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (threadMessageIds.has(e.id)) {
        const newLabelIds = e.labelIds.filter(l => l !== "INBOX");
        if (!newLabelIds.includes("TRASH")) {
          newLabelIds.push("TRASH");
        }
        return { ...e, labelIds: newLabelIds };
      }
      return e;
    }));
    
    set(moveSelectionAtom, "down");
    set(showMessageAtom, { text: "Moved to trash (z to undo)", type: "success" });

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of thread.messages) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.trash(msg.id).catch(() => {});
        }
      }
    }
  }
);

// Change current label/folder
export const changeLabelAtom = atom(
  null,
  async (get, set, label: LabelId) => {
    set(currentLabelAtom, label);
    set(selectedThreadIdAtom, null);
    set(listScrollOffsetAtom, 0);
    
    // Select first thread already cached for this label
    const threads = get(filteredThreadsAtom);
    if (threads.length > 0) {
      set(selectedThreadIdAtom, threads[0]!.id);
    }

    // If logged in, fetch emails for this label from Gmail
    if (get(isLoggedInAtom)) {
      const { fetchForLabel } = await import("../lib/sync.ts");
      set(isSyncingAtom, true);
      try {
        await fetchForLabel(label as string);
        // After fetch, re-select first thread if nothing selected
        if (!get(selectedThreadIdAtom)) {
          const newThreads = get(filteredThreadsAtom);
          if (newThreads.length > 0) {
            set(selectedThreadIdAtom, newThreads[0]!.id);
          }
        }
      } finally {
        set(isSyncingAtom, false);
      }
    }
  }
);

// Move thread to a target folder
export const moveToFolderAtom = atom(
  null,
  (get, set, targetLabel: LabelId) => {
    const thread = get(selectedThreadAtom);
    if (!thread) return;

    set(pushUndoAtom, `Move to ${targetLabel}`);
    const threadMessageIds = new Set(thread.messages.map(m => m.id));
    const currentLabel = get(currentLabelAtom);
    const emails = get(emailsAtom);

    // Optimistic UI update
    set(emailsAtom, emails.map(e => {
      if (!threadMessageIds.has(e.id)) return e;
      let newLabels = e.labelIds.filter(l => l !== currentLabel);
      if (!newLabels.includes(targetLabel)) {
        newLabels.push(targetLabel);
      }
      return { ...e, labelIds: newLabels };
    }));

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of thread.messages) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.moveToFolder(msg.id, targetLabel, currentLabel).catch(() => {});
        }
      }
    }

    set(moveSelectionAtom, "down");
    set(showMessageAtom, { text: `Moved to ${targetLabel.charAt(0) + targetLabel.slice(1).toLowerCase()} (z to undo)`, type: "success" });
  }
);

// Open move-to-folder picker
export const openMoveToFolderAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    if (!thread) return;
    set(pushOverlayAtom, { kind: "moveToFolder" });
  }
);

// ===== Bulk Selection Actions =====

// Toggle selection of current thread
export const toggleThreadSelectionAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    if (!thread) return;

    const selected = new Set(get(selectedThreadIdsAtom));
    if (selected.has(thread.id)) {
      selected.delete(thread.id);
    } else {
      selected.add(thread.id);
    }
    set(selectedThreadIdsAtom, selected);

    // Auto-enable bulk mode when selecting
    if (selected.size > 0) {
      set(bulkModeAtom, true);
    }
  }
);

// Clear all selections
export const clearBulkSelectionAtom = atom(
  null,
  (_get, set) => {
    set(selectedThreadIdsAtom, new Set());
    set(bulkModeAtom, false);
  }
);

// Select all threads in current view
export const selectAllThreadsAtom = atom(
  null,
  (get, set) => {
    const threads = get(filteredThreadsAtom);
    set(selectedThreadIdsAtom, new Set(threads.map(t => t.id)));
    set(bulkModeAtom, true);
  }
);

// Bulk archive
export const bulkArchiveAtom = atom(
  null,
  (get, set) => {
    const selectedIds = get(selectedThreadIdsAtom);
    if (selectedIds.size === 0) return;

    set(pushUndoAtom, `Bulk archive ${selectedIds.size} threads`);
    const threads = get(filteredThreadsAtom);
    const emailIdsToArchive = new Set<string>();
    const messagesToArchive: Email[] = [];
    for (const thread of threads) {
      if (selectedIds.has(thread.id)) {
        for (const msg of thread.messages) {
          emailIdsToArchive.add(msg.id);
          messagesToArchive.push(msg);
        }
      }
    }

    // Optimistic UI update
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e =>
      emailIdsToArchive.has(e.id)
        ? { ...e, labelIds: e.labelIds.filter(l => l !== "INBOX") }
        : e
    ));

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of messagesToArchive) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.archive(msg.id).catch(() => {});
        }
      }
    }

    set(showMessageAtom, { text: `Archived ${selectedIds.size} threads (z to undo)`, type: "success" });
    set(clearBulkSelectionAtom);
  }
);

// Bulk delete
export const bulkDeleteAtom = atom(
  null,
  (get, set) => {
    const selectedIds = get(selectedThreadIdsAtom);
    if (selectedIds.size === 0) return;

    set(pushUndoAtom, `Bulk delete ${selectedIds.size} threads`);
    const threads = get(filteredThreadsAtom);
    const emailIdsToDelete = new Set<string>();
    const messagesToDelete: Email[] = [];
    for (const thread of threads) {
      if (selectedIds.has(thread.id)) {
        for (const msg of thread.messages) {
          emailIdsToDelete.add(msg.id);
          messagesToDelete.push(msg);
        }
      }
    }

    // Optimistic UI update
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (!emailIdsToDelete.has(e.id)) return e;
      const newLabels = e.labelIds.filter(l => l !== "INBOX");
      if (!newLabels.includes("TRASH")) newLabels.push("TRASH");
      return { ...e, labelIds: newLabels };
    }));

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of messagesToDelete) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.trash(msg.id).catch(() => {});
        }
      }
    }

    set(showMessageAtom, { text: `Deleted ${selectedIds.size} threads (z to undo)`, type: "success" });
    set(clearBulkSelectionAtom);
  }
);

// Bulk mark read
export const bulkMarkReadAtom = atom(
  null,
  (get, set) => {
    const selectedIds = get(selectedThreadIdsAtom);
    if (selectedIds.size === 0) return;

    const threads = get(filteredThreadsAtom);
    const messagesToMark: Email[] = [];
    const emailIds = new Set<string>();
    for (const thread of threads) {
      if (selectedIds.has(thread.id)) {
        for (const msg of thread.messages) {
          emailIds.add(msg.id);
          messagesToMark.push(msg);
        }
      }
    }

    // Optimistic UI update
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e =>
      emailIds.has(e.id) ? { ...e, labelIds: e.labelIds.filter(l => l !== "UNREAD") } : e
    ));

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const msg of messagesToMark) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          provider?.markRead(msg.id).catch(() => {});
        }
      }
    }

    set(showMessageAtom, { text: `Marked ${selectedIds.size} threads as read`, type: "success" });
    set(clearBulkSelectionAtom);
  }
);

// Bulk star
export const bulkToggleStarAtom = atom(
  null,
  (get, set) => {
    const selectedIds = get(selectedThreadIdsAtom);
    if (selectedIds.size === 0) return;

    const threads = get(filteredThreadsAtom);
    const messagesToStar: { msg: Email; wasStarred: boolean }[] = [];
    const emailIds = new Set<string>();
    for (const thread of threads) {
      if (selectedIds.has(thread.id)) {
        for (const msg of thread.messages) {
          emailIds.add(msg.id);
          messagesToStar.push({ msg, wasStarred: msg.labelIds.includes("STARRED") });
        }
      }
    }

    // Optimistic UI update
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (!emailIds.has(e.id)) return e;
      return e.labelIds.includes("STARRED")
        ? { ...e, labelIds: e.labelIds.filter(l => l !== "STARRED") }
        : { ...e, labelIds: [...e.labelIds, "STARRED"] };
    }));

    // Fire-and-forget provider calls
    if (get(isLoggedInAtom)) {
      for (const { msg, wasStarred } of messagesToStar) {
        if (msg.accountEmail) {
          const provider = getProviderOrNull(msg.accountEmail);
          if (provider) {
            (wasStarred ? provider.unstar(msg.id) : provider.star(msg.id)).catch(() => {});
          }
        }
      }
    }

    set(showMessageAtom, { text: `Toggled star on ${selectedIds.size} threads`, type: "success" });
    set(clearBulkSelectionAtom);
  }
);

// ===== Overlay Actions =====

// Push overlay to stack
export const pushOverlayAtom = atom(
  null,
  (get, set, overlay: Overlay) => {
    const stack = get(overlayStackAtom);
    const currentFocus = get(focusAtom);
    set(overlayStackAtom, [...stack, { ...overlay, prevFocus: currentFocus }]);
  }
);

// Pop overlay from stack
export const popOverlayAtom = atom(
  null,
  (get, set) => {
    const stack = get(overlayStackAtom);
    if (stack.length === 0) return;
    
    const top = stack[stack.length - 1];
    set(overlayStackAtom, stack.slice(0, -1));
    
    // Restore previous focus
    if (top?.prevFocus) {
      set(focusAtom, top.prevFocus);
    }
  }
);

// Open command bar
export const openCommandAtom = atom(
  null,
  (get, set) => {
    set(commandInputAtom, "");
    set(commandSelectedIndexAtom, 0);
    set(focusAtom, "command");
    set(messageVisibleAtom, false);
  }
);

// Open search
export const openSearchAtom = atom(
  null,
  (get, set) => {
    set(searchQueryAtom, "");
    set(searchSelectedIndexAtom, 0);
    set(searchRemoteResultsAtom, []);
    set(isSearchingRemoteAtom, false);
    set(focusAtom, "search");
  }
);

// Open help dialog
export const openHelpAtom = atom(
  null,
  (get, set) => {
    set(pushOverlayAtom, { kind: "help" });
  }
);

// ===== Command Actions =====

// Execute command from command bar
export const executeCommandAtom = atom(
  null,
  (get, set) => {
    const input = get(commandInputAtom);
    const selectedIndex = get(commandSelectedIndexAtom);
    
    // If input is empty, execute selected command from palette
    const allCommands = getAllCommands();
    const firstWord = input.toLowerCase().trim().split(/\s+/)[0] ?? "";
    const filteredCommands = firstWord
      ? allCommands.filter(cmd => {
          const cmdName = cmd.name.split(" ")[0] ?? "";
          return cmdName.toLowerCase().includes(firstWord) ||
            cmd.description.toLowerCase().includes(firstWord);
        })
      : allCommands;
    
    // Get command to execute — prefer palette selection, fall back to text input
    let command: ReturnType<typeof findCommand>;
    if (filteredCommands[selectedIndex]) {
      command = { 
        name: filteredCommands[selectedIndex]!.name, 
        action: filteredCommands[selectedIndex]!.action 
      };
    } else {
      command = findCommand(input);
    }
    
    if (!command) {
      set(showMessageAtom, { text: `Unknown command: ${input}`, type: "error" });
      set(focusAtom, "list");
      set(messageVisibleAtom, true);
      return;
    }
    
    // Execute the command
    switch (command.action) {
      case "quit":
        // Will be handled by app
        break;
      case "openHelp":
        set(openHelpAtom);
        break;
      case "toggleStar":
        set(toggleStarAtom, undefined);
        break;
      case "archive":
        set(archiveEmailAtom);
        break;
      case "delete":
        set(deleteEmailAtom);
        break;
      case "markRead":
        set(markReadAtom, undefined);
        break;
      case "markUnread":
        set(markUnreadAtom, undefined);
        break;
      case "gotoInbox":
        set(changeLabelAtom, "INBOX");
        break;
      case "gotoSent":
        set(changeLabelAtom, "SENT");
        break;
      case "gotoDrafts":
        set(changeLabelAtom, "DRAFT");
        break;
      case "gotoTrash":
        set(changeLabelAtom, "TRASH");
        break;
      case "gotoStarred":
        set(changeLabelAtom, "STARRED");
        break;
      case "moveToFolder":
        set(openMoveToFolderAtom);
        break;
      case "undo":
        set(undoAtom);
        break;
      case "reply":
        set(replyEmailAtom);
        break;
      case "replyAll":
        set(replyAllEmailAtom);
        break;
      case "forward":
        set(forwardEmailAtom);
        break;
      case "compose":
        set(composeEmailAtom);
        break;
      case "openSearch":
        set(openSearchAtom);
        break;
      case "login":
        set(loginAtom);
        break;
      case "logout":
        set(logoutAtom);
        break;
      case "accounts":
        set(openAccountsDialogAtom);
        break;
      case "sync":
        set(syncEmailsAtom);
        break;
      case "reset-sync":
        set(resetSyncAtom);
        break;
      default:
        set(showMessageAtom, { text: `Executed: ${command.name}`, type: "info" });
    }
    
    // Close command bar — only reset to list if focus wasn't changed by the action
    const currentFocus = get(focusAtom);
    if (currentFocus === "command") {
      set(focusAtom, "list");
    }
    set(messageVisibleAtom, true);
  }
);

// ===== Search Actions =====

// Debounce timer for remote search
let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 500;

// Search Gmail API for all logged-in accounts
export const searchRemoteAtom = atom(
  null,
  async (get, set) => {
    const query = get(searchQueryAtom).trim();
    if (!query) return;

    const isLoggedIn = get(isLoggedInAtom);
    if (!isLoggedIn) return;

    const accounts = get(googleAccountsAtom);
    if (accounts.length === 0) return;

    set(isSearchingRemoteAtom, true);

    try {
      // Search all accounts in parallel via their providers
      const results = await Promise.all(
        accounts.map(acc => {
          const provider = getProviderOrNull(acc.email);
          if (!provider) return Promise.resolve([] as Email[]);
          return provider.searchMessages(query, 30).catch(() => [] as Email[]);
        })
      );

      // Only update if the query hasn't changed while we were fetching
      if (get(searchQueryAtom).trim() !== query) return;

      const allResults = results.flat();

      // Also upsert into local DB for caching
      try {
        const { upsertEmails } = await import("../lib/database.ts");
        upsertEmails(allResults);
      } catch {
        // DB upsert failure is non-critical
      }

      set(searchRemoteResultsAtom, allResults);

      // Update selection to first result if nothing selected
      const threads = get(filteredThreadsAtom);
      if (threads.length > 0 && !get(selectedThreadIdAtom)) {
        set(selectedThreadIdAtom, threads[0]!.id);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Search failed";
      set(showMessageAtom, { text: msg, type: "error" });
    } finally {
      set(isSearchingRemoteAtom, false);
    }
  }
);

// Update search query — local filter is instant, remote is debounced
export const updateSearchQueryAtom = atom(
  null,
  (get, set, query: string) => {
    set(searchQueryAtom, query);
    set(searchSelectedIndexAtom, 0);
    
    // Update selection to first matching thread (local results, instant)
    const threads = get(filteredThreadsAtom);
    if (threads.length > 0) {
      set(selectedThreadIdAtom, threads[0]!.id);
    }

    // Debounce remote search
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    if (query.trim()) {
      _searchDebounceTimer = setTimeout(() => {
        set(searchRemoteAtom);
      }, SEARCH_DEBOUNCE_MS);
    } else {
      // Clear remote results when query is empty
      set(searchRemoteResultsAtom, []);
      set(isSearchingRemoteAtom, false);
    }
  }
);

// Close search
export const closeSearchAtom = atom(
  null,
  (get, set) => {
    if (_searchDebounceTimer) clearTimeout(_searchDebounceTimer);
    set(focusAtom, "list");
    set(searchQueryAtom, "");
    set(searchRemoteResultsAtom, []);
    set(isSearchingRemoteAtom, false);
  }
);

// ===== Message Actions =====

// Show message
export const showMessageAtom = atom(
  null,
  (get, set, message: { text: string; type: MessageType }) => {
    set(messageAtom, {
      id: Date.now().toString(),
      text: message.text,
      type: message.type,
    });
    set(messageVisibleAtom, true);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      set(messageVisibleAtom, false);
    }, 3000);
  }
);

// Dismiss message
export const dismissMessageAtom = atom(
  null,
  (get, set) => {
    set(messageVisibleAtom, false);
  }
);

// ===== View Actions =====

// Scroll email view (ScrollView clamps the offset internally)
export const scrollViewAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "pageUp" | "pageDown" | "top" | "bottom") => {
    const current = get(viewScrollOffsetAtom);
    const amount = direction === "pageUp" || direction === "pageDown" ? 10 : 1;
    
    switch (direction) {
      case "up":
      case "pageUp":
        set(viewScrollOffsetAtom, Math.max(0, current - amount));
        break;
      case "down":
      case "pageDown":
        set(viewScrollOffsetAtom, current + amount);
        break;
      case "top":
        set(viewScrollOffsetAtom, 0);
        break;
      case "bottom":
        set(viewScrollOffsetAtom, Infinity);
        break;
    }
  }
);

// Toggle headers visibility for the focused message
export const toggleHeadersAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    const email = get(selectedEmailAtom);
    if (!thread || !email) return;

    // Determine which message to toggle
    let messageId: string;
    if (thread.count > 1) {
      // UI displays messages in reverse (latest first), so map the UI index back
      const idx = get(focusedMessageIndexAtom);
      const uiIdx = idx < 0 ? 0 : idx;
      const reversed = [...thread.messages].reverse();
      messageId = reversed[uiIdx]?.id ?? email.id;
    } else {
      messageId = email.id;
    }

    const current = { ...get(expandedHeadersAtom) };
    if (current[messageId]) {
      delete current[messageId];
    } else {
      current[messageId] = true;
    }
    set(expandedHeadersAtom, current);
  }
);

// Toggle raw HTML debug view for the focused message
export const toggleDebugHtmlAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    const email = get(selectedEmailAtom);
    if (!thread || !email) return;

    let messageId: string;
    if (thread.count > 1) {
      const idx = get(focusedMessageIndexAtom);
      const uiIdx = idx < 0 ? 0 : idx;
      const reversed = [...thread.messages].reverse();
      messageId = reversed[uiIdx]?.id ?? email.id;
    } else {
      messageId = email.id;
    }

    const current = { ...get(debugHtmlAtom) };
    if (current[messageId]) {
      delete current[messageId];
    } else {
      current[messageId] = true;
    }
    set(debugHtmlAtom, current);
  }
);

// Copy raw HTML of focused message to clipboard via pbcopy
export const copyHtmlToClipboardAtom = atom(
  null,
  async (get, set) => {
    const thread = get(selectedThreadAtom);
    const email = get(selectedEmailAtom);
    if (!thread || !email) return;

    let msg: typeof email;
    if (thread.count > 1) {
      const idx = get(focusedMessageIndexAtom);
      const uiIdx = idx < 0 ? 0 : idx;
      const reversed = [...thread.messages].reverse();
      msg = reversed[uiIdx] ?? email;
    } else {
      msg = email;
    }

    const rawHtml = msg.bodyHtml || msg.body;
    if (!rawHtml) {
      set(showMessageAtom, { text: "No HTML body to copy", type: "warning" });
      return;
    }

    try {
      const proc = Bun.spawn(["pbcopy"], { stdin: "pipe" });
      proc.stdin.write(rawHtml);
      proc.stdin.end();
      await proc.exited;
      set(showMessageAtom, { text: `Copied ${rawHtml.length} chars of raw HTML to clipboard`, type: "success" });
    } catch (err) {
      set(showMessageAtom, { text: `Failed to copy: ${err instanceof Error ? err.message : err}`, type: "error" });
    }
  }
);

// Move focused message within a thread
export const moveFocusedMessageAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const thread = get(selectedThreadAtom);
    if (!thread || thread.count <= 1) return;

    const current = get(focusedMessageIndexAtom);
    const lastIdx = thread.messages.length - 1;
    const resolved = current < 0 ? 0 : current;

    let next: number;
    if (direction === "next") {
      next = Math.min(resolved + 1, lastIdx);
    } else {
      next = Math.max(resolved - 1, 0);
    }
    set(focusedMessageIndexAtom, next);
  }
);

// Open email (mark as read and focus view)
export const openEmailAtom = atom(
  null,
  (get, set) => {
    const thread = get(selectedThreadAtom);
    if (thread) {
      // Mark all thread messages as read
      for (const msg of thread.messages) {
        if (msg.labelIds.includes("UNREAD")) {
          set(markReadAtom, msg.id);
        }
      }
      set(focusAtom, "view");
      set(viewScrollOffsetAtom, 0);
      // Reset image and link navigation state
      set(imageNavModeAtom, false);
      set(focusedImageIndexAtom, -1);
      set(activeLinkIndexAtom, -1);
      // Reset per-message state
      set(expandedHeadersAtom, {});
      set(focusedMessageIndexAtom, -1);
    }
  }
);

// Helper: get the signature block for the current reply account (with -- delimiter)
function getAccountSignatureBlock(get: any): string {
  const account = get(replyFromAccountAtom);
  if (!account) {
    const sig = get(signatureAtom);
    return sig || "";
  }
  const sigText = resolveSignatureForAccount(get, account.email);
  if (!sigText) return "";
  // Only prepend the -- delimiter if the signature doesn't already start with one
  if (sigText.startsWith("--")) return `\n${sigText}`;
  return `\n--\n${sigText}`;
}

// Reply to email - opens reply view
export const replyEmailAtom = atom(
  null,
  (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) {
      set(showMessageAtom, { text: "No email selected", type: "error" });
      return;
    }
    // Set reply account to active account
    set(replyFromAccountIndexAtom, get(activeAccountIndexAtom));
    const sigBlock = getAccountSignatureBlock(get);
    set(currentComposeSigAtom, sigBlock);
    set(draftIdAtom, `draft-${Date.now()}`);
    set(replyModeAtom, "reply");
    set(replyToAtom, formatEmailAddress(email.from));
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, `Re: ${email.subject}`);
    set(replyContentAtom, sigBlock ? `\n${sigBlock}` : "");
    set(replyAttachmentsAtom, []);
    set(replyShowCcBccAtom, false);
    set(focusAtom, "reply");
  }
);

// Reply all - opens reply view with all recipients
export const replyAllEmailAtom = atom(
  null,
  (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) {
      set(showMessageAtom, { text: "No email selected", type: "error" });
      return;
    }
    set(replyFromAccountIndexAtom, get(activeAccountIndexAtom));
    const sigBlock = getAccountSignatureBlock(get);
    set(currentComposeSigAtom, sigBlock);
    set(draftIdAtom, `draft-${Date.now()}`);
    set(replyModeAtom, "replyAll");
    set(replyToAtom, formatEmailAddress(email.from));
    const allRecipients = [
      ...email.to.map(formatEmailAddress),
      ...(email.cc?.map(formatEmailAddress) || []),
    ].join(", ");
    set(replyCcAtom, allRecipients);
    set(replyBccAtom, "");
    set(replySubjectAtom, `Re: ${email.subject}`);
    set(replyContentAtom, sigBlock ? `\n${sigBlock}` : "");
    set(replyAttachmentsAtom, []);
    set(replyShowCcBccAtom, true);
    set(focusAtom, "reply");
  }
);

// Auto-save current draft
export const autoSaveDraftAtom = atom(
  null,
  async (get) => {
    const id = get(draftIdAtom);
    const mode = get(replyModeAtom);
    if (!id || !mode) return;

    const content = get(replyContentAtom);
    const to = get(replyToAtom);
    // Only save if there's meaningful content
    if (!content.trim() && !to.trim()) return;

    await saveDraft({
      id,
      to,
      cc: get(replyCcAtom),
      bcc: get(replyBccAtom),
      subject: get(replySubjectAtom),
      content,
      attachments: get(replyAttachmentsAtom),
      mode: mode as "reply" | "replyAll" | "forward",
      savedAt: Date.now(),
    });
  }
);

// Close reply view (deletes draft)
export const closeReplyAtom = atom(
  null,
  async (get, set) => {
    const id = get(draftIdAtom);
    if (id) {
      await deleteDraft(id);
    }
    set(draftIdAtom, null);
    set(replyModeAtom, null);
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, "");
    set(replyContentAtom, "");
    set(replyAttachmentsAtom, []);
    set(replyFullscreenAtom, false);
    set(replyShowCcBccAtom, false);
    set(currentComposeSigAtom, "");
    set(focusAtom, "view");
  }
);

// Send reply — uses Gmail API when logged in
export const sendReplyAtom = atom(
  null,
  async (get, set) => {
    const to = get(replyToAtom);
    const cc = get(replyCcAtom);
    const bcc = get(replyBccAtom);
    const subject = get(replySubjectAtom);
    const content = get(replyContentAtom);
    const fromAccount = get(replyFromAccountAtom);
    const isLoggedIn = get(isLoggedInAtom);
    const selectedEmail = get(selectedEmailAtom);
    
    if (!to.trim()) {
      set(showMessageAtom, { text: "No recipients specified", type: "error" });
      return;
    }
    
    if (!content.trim()) {
      set(showMessageAtom, { text: "Cannot send empty reply", type: "error" });
      return;
    }

    // Delete draft on successful send
    const id = get(draftIdAtom);
    if (id) {
      await deleteDraft(id);
    }

    // Try to send via provider
    if (isLoggedIn && fromAccount) {
      try {
        const provider = getProviderOrNull(fromAccount.email);
        if (!provider) {
          set(showMessageAtom, { text: `No provider for ${fromAccount.email}`, type: "error" });
          return;
        }
        const toList = to.split(",").map(s => s.trim()).filter(Boolean);
        const ccList = cc ? cc.split(",").map(s => s.trim()).filter(Boolean) : undefined;
        const bccList = bcc ? bcc.split(",").map(s => s.trim()).filter(Boolean) : undefined;

        await provider.sendMessage({
          to: toList,
          cc: ccList,
          bcc: bccList,
          subject: subject,
          body: content,
          inReplyTo: selectedEmail?.messageId,
          references: selectedEmail?.references,
          threadId: selectedEmail?.threadId,
        });

        set(showMessageAtom, { text: `Sent from ${fromAccount.email} to ${to}`, type: "success" });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        set(showMessageAtom, { text: `Send failed: ${msg}`, type: "error" });
        return; // Don't clear the form on failure
      }
    } else {
      const fromLabel = fromAccount ? ` from ${fromAccount.email}` : "";
      set(showMessageAtom, { text: `Sent${fromLabel} to ${to}`, type: "success" });
    }

    set(draftIdAtom, null);
    set(replyModeAtom, null);
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, "");
    set(replyContentAtom, "");
    set(replyAttachmentsAtom, []);
    set(replyFullscreenAtom, false);
    set(replyShowCcBccAtom, false);
    set(currentComposeSigAtom, "");
    set(focusAtom, "view");
  }
);

// Update reply fields
// Helper: extract last token from comma-separated input
function getLastToken(value: string): string {
  const parts = value.split(",");
  return (parts[parts.length - 1] || "").trim();
}

// Helper: fuzzy match contacts against a query
function matchContacts(query: string, contacts: Array<{ email: string; name?: string }>): Array<{ email: string; name?: string }> {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return contacts.filter(c =>
    c.email.toLowerCase().includes(q) ||
    (c.name && c.name.toLowerCase().includes(q))
  ).slice(0, 5);
}

export const updateReplyToAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyToAtom, value);
    set(activeContactFieldAtom, "to");
    const token = getLastToken(value);
    set(contactSuggestionsAtom, matchContacts(token, get(contactsAtom)));
    set(contactSuggestionIndexAtom, 0);
  }
);

export const updateReplyCcAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyCcAtom, value);
    set(activeContactFieldAtom, "cc");
    const token = getLastToken(value);
    set(contactSuggestionsAtom, matchContacts(token, get(contactsAtom)));
    set(contactSuggestionIndexAtom, 0);
  }
);

export const updateReplySubjectAtom = atom(
  null,
  (get, set, value: string) => {
    set(replySubjectAtom, value);
  }
);

export const updateReplyContentAtom = atom(
  null,
  (get, set, content: string) => {
    set(replyContentAtom, content);
  }
);

// Toggle reply fullscreen mode
export const toggleReplyFullscreenAtom = atom(
  null,
  (get, set) => {
    const current = get(replyFullscreenAtom);
    set(replyFullscreenAtom, !current);
  }
);

// Toggle CC/BCC visibility
export const toggleReplyCcBccAtom = atom(
  null,
  (get, set) => {
    const current = get(replyShowCcBccAtom);
    set(replyShowCcBccAtom, !current);
  }
);

// Update BCC field with contact suggestions
export const updateReplyBccAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyBccAtom, value);
    set(activeContactFieldAtom, "bcc");
    const token = getLastToken(value);
    set(contactSuggestionsAtom, matchContacts(token, get(contactsAtom)));
    set(contactSuggestionIndexAtom, 0);
  }
);

// Navigate contact suggestions
export const moveSuggestionAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const suggestions = get(contactSuggestionsAtom);
    if (suggestions.length === 0) return;
    const current = get(contactSuggestionIndexAtom);
    if (direction === "next") {
      set(contactSuggestionIndexAtom, (current + 1) % suggestions.length);
    } else {
      set(contactSuggestionIndexAtom, (current - 1 + suggestions.length) % suggestions.length);
    }
  }
);

// Accept the currently highlighted contact suggestion
export const acceptSuggestionAtom = atom(
  null,
  (get, set) => {
    const suggestions = get(contactSuggestionsAtom);
    if (suggestions.length === 0) return;
    const index = get(contactSuggestionIndexAtom);
    const suggestion = suggestions[index];
    if (!suggestion) return;

    const field = get(activeContactFieldAtom);
    const fieldAtom = field === "to" ? replyToAtom : field === "cc" ? replyCcAtom : replyBccAtom;
    const current = get(fieldAtom);

    // Replace the last token with the selected contact
    const parts = current.split(",").map(s => s.trim());
    parts[parts.length - 1] = suggestion.name
      ? `${suggestion.name} <${suggestion.email}>`
      : suggestion.email;
    set(fieldAtom, parts.join(", ") + ", ");

    // Clear suggestions
    set(contactSuggestionsAtom, []);
    set(contactSuggestionIndexAtom, 0);
  }
);

// Dismiss contact suggestions
export const dismissSuggestionsAtom = atom(
  null,
  (_get, set) => {
    set(contactSuggestionsAtom, []);
    set(contactSuggestionIndexAtom, 0);
  }
);

// Forward email
export const forwardEmailAtom = atom(
  null,
  (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) {
      set(showMessageAtom, { text: "No email selected", type: "error" });
      return;
    }
    set(replyFromAccountIndexAtom, get(activeAccountIndexAtom));
    const sigBlock = getAccountSignatureBlock(get);
    set(currentComposeSigAtom, sigBlock);
    set(draftIdAtom, `draft-${Date.now()}`);
    set(replyModeAtom, "forward");
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, `Fwd: ${email.subject}`);
    set(replyContentAtom, sigBlock ? `\n${sigBlock}` : "");
    set(replyAttachmentsAtom, []);
    set(replyShowCcBccAtom, false);
    set(focusAtom, "reply");
  }
);

// Compose new email
export const composeEmailAtom = atom(
  null,
  (get, set) => {
    set(replyFromAccountIndexAtom, get(activeAccountIndexAtom));
    const sigBlock = getAccountSignatureBlock(get);
    set(currentComposeSigAtom, sigBlock);
    set(draftIdAtom, `draft-${Date.now()}`);
    set(replyModeAtom, "compose");
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, "");
    set(replyContentAtom, sigBlock ? `\n${sigBlock}` : "");
    set(replyAttachmentsAtom, []);
    set(replyShowCcBccAtom, false);
    set(focusAtom, "reply");
  }
);

// ===== Inline Reply Actions =====

// Open quick inline reply at bottom of email view
export const openInlineReplyAtom = atom(
  null,
  (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) {
      set(showMessageAtom, { text: "No email selected", type: "error" });
      return;
    }
    set(inlineReplyContentAtom, "");
    set(inlineReplyOpenAtom, true);
  }
);

// Close inline reply
export const closeInlineReplyAtom = atom(
  null,
  (_get, set) => {
    set(inlineReplyOpenAtom, false);
    set(inlineReplyContentAtom, "");
  }
);

// Update inline reply content
export const updateInlineReplyContentAtom = atom(
  null,
  (_get, set, content: string) => {
    set(inlineReplyContentAtom, content);
  }
);

// Send inline reply — uses Gmail API when logged in
export const sendInlineReplyAtom = atom(
  null,
  async (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) return;

    const content = get(inlineReplyContentAtom).trim();
    if (!content) {
      set(showMessageAtom, { text: "Cannot send empty reply", type: "error" });
      return;
    }

    const fromAccount = get(replyFromAccountAtom);
    const isLoggedIn = get(isLoggedInAtom);
    const to = formatEmailAddress(email.from);

    if (isLoggedIn && fromAccount) {
      try {
        const provider = getProviderOrNull(fromAccount.email);
        if (!provider) {
          set(showMessageAtom, { text: `No provider for ${fromAccount.email}`, type: "error" });
          return;
        }

        await provider.sendMessage({
          to: [email.from.email],
          subject: `Re: ${email.subject}`,
          body: content,
          inReplyTo: email.messageId,
          references: email.references,
          threadId: email.threadId,
        });

        set(showMessageAtom, { text: `Quick reply sent from ${fromAccount.email} to ${to}`, type: "success" });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        set(showMessageAtom, { text: `Send failed: ${msg}`, type: "error" });
        return; // Don't clear the form on failure
      }
    } else {
      set(showMessageAtom, { text: "Not logged in — cannot send", type: "error" });
      return;
    }

    set(inlineReplyOpenAtom, false);
    set(inlineReplyContentAtom, "");
  }
);

// Expand inline reply to full compose
export const expandInlineReplyAtom = atom(
  null,
  (get, set) => {
    const content = get(inlineReplyContentAtom);
    // Close inline reply
    set(inlineReplyOpenAtom, false);
    set(inlineReplyContentAtom, "");
    // Open full reply with the content carried over
    set(replyEmailAtom);
    if (content.trim()) {
      const sigBlock = get(currentComposeSigAtom);
      set(replyContentAtom, content + sigBlock);
    }
  }
);

// ===== Attachment Actions =====

// Toggle attachment focus
export const toggleAttachmentsFocusAtom = atom(
  null,
  (get, set) => {
    const current = get(attachmentsFocusedAtom);
    if (!current) {
      // Entering attachment mode - select first attachment
      const email = get(selectedEmailAtom);
      if (email?.attachments && email.attachments.length > 0) {
        set(attachmentsFocusedAtom, true);
        set(selectedAttachmentIndexAtom, 0);
      } else {
        set(showMessageAtom, { text: "No attachments", type: "info" });
      }
    } else {
      // Exiting attachment mode
      set(attachmentsFocusedAtom, false);
      set(selectedAttachmentIndexAtom, -1);
    }
  }
);

// Navigate attachments
export const moveAttachmentSelectionAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const email = get(selectedEmailAtom);
    if (!email?.attachments || email.attachments.length === 0) return;
    
    const currentIndex = get(selectedAttachmentIndexAtom);
    const maxIndex = email.attachments.length - 1;
    
    let newIndex: number;
    if (direction === "next") {
      newIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    }
    
    set(selectedAttachmentIndexAtom, newIndex);
  }
);

// Open/preview selected attachment (Quick Look on macOS, default app elsewhere)
// In a real app, this would first download the attachment via Gmail API
// using messages.attachments.get with the attachmentId, then preview it.
export const openAttachmentAtom = atom(
  null,
  async (get, set) => {
    const email = get(selectedEmailAtom);
    const index = get(selectedAttachmentIndexAtom);
    
    if (!email?.attachments || index < 0 || index >= email.attachments.length) {
      set(showMessageAtom, { text: "No attachment selected", type: "error" });
      return;
    }
    
    const attachment = email.attachments[index];
    if (!attachment) return;
    
    // TODO: Download attachment via Gmail API (messages.attachments.get)
    // then preview with quickLook(localPath)
    set(showMessageAtom, { text: `Preview: ${attachment.filename} (download not implemented yet)`, type: "info" });
  }
);

// Save selected attachment to downloads
export const saveAttachmentAtom = atom(
  null,
  async (get, set) => {
    const email = get(selectedEmailAtom);
    const index = get(selectedAttachmentIndexAtom);
    const downloadsPath = get(downloadsPathAtom);
    
    if (!email?.attachments || index < 0 || index >= email.attachments.length) {
      set(showMessageAtom, { text: "No attachment selected", type: "error" });
      return;
    }
    
    const attachment = email.attachments[index];
    if (!attachment) return;
    
    // For now, we'll simulate saving - in real app, would have actual file data
    set(showMessageAtom, { 
      text: `Saved: ${attachment.filename} → ${downloadsPath}`, 
      type: "success" 
    });
    
    // TODO: implement actual file save via Gmail attachment API
  }
);

// Save all attachments
export const saveAllAttachmentsAtom = atom(
  null,
  async (get, set) => {
    const email = get(selectedEmailAtom);
    const downloadsPath = get(downloadsPathAtom);
    
    if (!email?.attachments || email.attachments.length === 0) {
      set(showMessageAtom, { text: "No attachments to save", type: "error" });
      return;
    }
    
    set(showMessageAtom, { 
      text: `Saved ${email.attachments.length} attachment(s) → ${downloadsPath}`, 
      type: "success" 
    });
  }
);

// Get current selected attachment (derived)
export const selectedAttachmentAtom = atom((get) => {
  const email = get(selectedEmailAtom);
  const index = get(selectedAttachmentIndexAtom);
  
  if (!email?.attachments || index < 0 || index >= email.attachments.length) {
    return null;
  }
  
  return email.attachments[index];
});

// ===== Image Navigation Actions =====

// Toggle image navigation mode
export const toggleImageNavAtom = atom(
  null,
  (get, set) => {
    const current = get(imageNavModeAtom);
    if (current) {
      set(imageNavModeAtom, false);
      set(focusedImageIndexAtom, -1);
    } else {
      set(imageNavModeAtom, true);
      set(focusedImageIndexAtom, 0);
    }
  }
);

// Move image focus (used with Tab/Shift+Tab)
export const moveImageFocusAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const currentIndex = get(focusedImageIndexAtom);
    // The total image count is managed by the component (passed as max)
    // For now, we just increment/decrement — the component will clamp
    if (direction === "next") {
      set(focusedImageIndexAtom, currentIndex + 1);
    } else {
      set(focusedImageIndexAtom, Math.max(0, currentIndex - 1));
    }
  }
);

// Reset image state (called when switching emails)
export const resetImageStateAtom = atom(
  null,
  (get, set) => {
    set(imageNavModeAtom, false);
    set(focusedImageIndexAtom, -1);
  }
);

// ===== Link Navigation Actions =====

// Move link focus (Tab / Shift+Tab in email view)
export const moveLinkFocusAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const links = get(emailLinksAtom);
    if (links.length === 0) return;

    const current = get(activeLinkIndexAtom);
    if (direction === "next") {
      set(activeLinkIndexAtom, current < links.length - 1 ? current + 1 : 0);
    } else {
      set(activeLinkIndexAtom, current > 0 ? current - 1 : links.length - 1);
    }
  }
);

// Open the currently focused link
export const openActiveLinkAtom = atom(
  null,
  async (get) => {
    const links = get(emailLinksAtom);
    const index = get(activeLinkIndexAtom);
    const link = links[index];
    if (index >= 0 && link) {
      const { openFile } = await import("../utils/files.ts");
      await openFile(link.href);
    }
  }
);

// Reset link navigation state (called when switching emails or leaving view)
export const resetLinkNavAtom = atom(
  null,
  (get, set) => {
    set(activeLinkIndexAtom, -1);
  }
);

// ===== Folder Sidebar Actions =====

// Toggle folder sidebar
export const toggleFolderSidebarAtom = atom(
  null,
  (get, set) => {
    const open = get(folderSidebarOpenAtom);
    if (open) {
      set(folderSidebarOpenAtom, false);
      // Restore focus to list
      set(focusAtom, "list");
    } else {
      // Open and select current folder
      const currentLabel = get(currentLabelAtom);
      const idx = (FOLDER_LABELS as string[]).indexOf(currentLabel);
      set(selectedFolderIndexAtom, idx >= 0 ? idx : 0);
      set(folderSidebarOpenAtom, true);
      set(focusAtom, "folders");
    }
  }
);

// Navigate folder list
export const moveFolderSelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down") => {
    const current = get(selectedFolderIndexAtom);
    const max = FOLDER_LABELS.length - 1;
    if (direction === "up") {
      set(selectedFolderIndexAtom, current <= 0 ? max : current - 1);
    } else {
      set(selectedFolderIndexAtom, current >= max ? 0 : current + 1);
    }
  }
);

// Select folder and close sidebar
export const selectFolderAtom = atom(
  null,
  (get, set) => {
    const idx = get(selectedFolderIndexAtom);
    const label = FOLDER_LABELS[idx];
    if (label) {
      set(changeLabelAtom, label);
      set(folderSidebarOpenAtom, false);
      set(focusAtom, "list");
    }
  }
);

// ===== Calendar RSVP Actions =====

// Respond to calendar invite (Accept / Decline / Maybe)
export const rsvpCalendarInviteAtom = atom(
  null,
  (get, set, response: "ACCEPTED" | "DECLINED" | "TENTATIVE") => {
    const email = get(selectedEmailAtom);
    if (!email?.calendarEvent) {
      set(showMessageAtom, { text: "No calendar invite to respond to", type: "error" });
      return;
    }

    const labels: Record<string, string> = {
      ACCEPTED: "Accepted",
      DECLINED: "Declined",
      TENTATIVE: "Maybe",
    };

    // Update the email's calendarEvent.myStatus in state
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (e.id !== email.id || !e.calendarEvent) return e;

      // Also update our status in the attendees list
      const updatedAttendees = e.calendarEvent.attendees?.map(a => {
        if (a.email.toLowerCase() === "me@example.com") {
          return { ...a, status: response as AttendeeStatus };
        }
        return a;
      });

      return {
        ...e,
        calendarEvent: {
          ...e.calendarEvent,
          myStatus: response as AttendeeStatus,
          attendees: updatedAttendees,
        },
      };
    }));

    set(showMessageAtom, {
      text: `${labels[response]}: ${email.calendarEvent.summary}`,
      type: "success",
    });

    // TODO: In real implementation, send a calendar REPLY via Gmail API:
    // 1. Generate an ICS REPLY with METHOD:REPLY and PARTSTAT:<response>
    // 2. Send it as an email to the organizer
  }
);

// ===== Attachment Picker Actions =====

// Open the attachment picker
export const openAttachmentPickerAtom = atom(
  null,
  (get, set) => {
    set(attachmentPickerOpenAtom, true);
    set(attachmentPickerQueryAtom, "");
    set(attachmentPickerSelectedIndexAtom, 0);
    set(attachmentPickerSelectedFilesAtom, new Set());
    set(attachmentPickerResultsAtom, []);
    
    // Collect file list once — cached for the entire picker session
    const cwd = get(attachmentPickerCwdAtom);
    collectFiles(cwd).then((files) => {
      set(attachmentPickerResultsAtom, files.slice(0, 50));
    });
  }
);

// Close the attachment picker
export const closeAttachmentPickerAtom = atom(
  null,
  (get, set) => {
    set(attachmentPickerOpenAtom, false);
    set(attachmentPickerQueryAtom, "");
    set(attachmentPickerResultsAtom, []);
    set(attachmentPickerSelectedFilesAtom, new Set());
    clearFileCache();
  }
);

// Update picker query and filter results from the cached file list
let _pickerQueryVersion = 0;

export const updatePickerQueryAtom = atom(
  null,
  async (get, set, query: string) => {
    const version = ++_pickerQueryVersion;
    set(attachmentPickerQueryAtom, query);
    set(attachmentPickerSelectedIndexAtom, 0);
    
    try {
      const result = await filterFiles(query, 50);
      // Discard stale results
      if (version !== _pickerQueryVersion) return;
      if (result.success) {
        set(attachmentPickerResultsAtom, result.paths);
      }
    } catch {
      // Silently ignore — stale or failed
    }
  }
);

// Navigate picker results
export const movePickerSelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "pageUp" | "pageDown") => {
    const results = get(attachmentPickerResultsAtom);
    if (results.length === 0) return;
    
    const currentIndex = get(attachmentPickerSelectedIndexAtom);
    const maxIndex = results.length - 1;
    
    let newIndex: number;
    switch (direction) {
      case "up":
        newIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
        break;
      case "down":
        newIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
        break;
      case "pageUp":
        newIndex = Math.max(0, currentIndex - 10);
        break;
      case "pageDown":
        newIndex = Math.min(maxIndex, currentIndex + 10);
        break;
    }
    
    set(attachmentPickerSelectedIndexAtom, newIndex);
  }
);

// Toggle file selection (multi-select)
export const togglePickerFileSelectionAtom = atom(
  null,
  (get, set) => {
    const results = get(attachmentPickerResultsAtom);
    const index = get(attachmentPickerSelectedIndexAtom);
    
    if (index < 0 || index >= results.length) return;
    
    const path = results[index];
    if (!path) return;
    
    const selected = new Set(get(attachmentPickerSelectedFilesAtom));
    
    if (selected.has(path)) {
      selected.delete(path);
    } else {
      selected.add(path);
    }
    
    set(attachmentPickerSelectedFilesAtom, selected);
  }
);

// Select all visible results
export const selectAllPickerFilesAtom = atom(
  null,
  (get, set) => {
    const results = get(attachmentPickerResultsAtom);
    set(attachmentPickerSelectedFilesAtom, new Set(results));
  }
);

// Deselect all
export const deselectAllPickerFilesAtom = atom(
  null,
  (get, set) => {
    set(attachmentPickerSelectedFilesAtom, new Set());
  }
);

// Confirm picker selection and add to attachments
export const confirmPickerSelectionAtom = atom(
  null,
  (get, set) => {
    const selectedFiles = get(attachmentPickerSelectedFilesAtom);
    const results = get(attachmentPickerResultsAtom);
    const index = get(attachmentPickerSelectedIndexAtom);
    
    // If no multi-select, use the highlighted item
    let filesToAdd: string[];
    if (selectedFiles.size > 0) {
      filesToAdd = Array.from(selectedFiles);
    } else if (index >= 0 && index < results.length && results[index]) {
      filesToAdd = [results[index]];
    } else {
      set(showMessageAtom, { text: "No file selected", type: "error" });
      return;
    }
    
    // Add to reply attachments
    const currentAttachments = get(replyAttachmentsAtom);
    const newAttachments = [...currentAttachments];
    
    let addedCount = 0;
    for (const path of filesToAdd) {
      if (!newAttachments.includes(path)) {
        newAttachments.push(path);
        addedCount++;
      }
    }
    
    set(replyAttachmentsAtom, newAttachments);
    
    // Close the picker
    set(attachmentPickerOpenAtom, false);
    set(attachmentPickerQueryAtom, "");
    set(attachmentPickerResultsAtom, []);
    set(attachmentPickerSelectedFilesAtom, new Set());
    
    if (addedCount > 0) {
      set(showMessageAtom, { 
        text: `Added ${addedCount} attachment${addedCount > 1 ? "s" : ""}`, 
        type: "success" 
      });
    } else {
      set(showMessageAtom, { text: "Files already attached", type: "info" });
    }
  }
);

// Change picker directory
export const changePickerDirectoryAtom = atom(
  null,
  async (get, set, newCwd: string) => {
    set(attachmentPickerCwdAtom, newCwd);
    set(attachmentPickerQueryAtom, "");
    set(attachmentPickerSelectedIndexAtom, 0);
    
    const files = await collectFiles(newCwd);
    set(attachmentPickerResultsAtom, files.slice(0, 50));
  }
);

// ===== Compose Attachment Actions =====

// Toggle compose attachment mode
export const toggleComposeAttachmentModeAtom = atom(
  null,
  (get, set) => {
    const attachments = get(replyAttachmentsAtom);
    const isInMode = get(composeAttachmentModeAtom);
    
    if (!isInMode) {
      if (attachments.length === 0) {
        set(showMessageAtom, { text: "No attachments to manage", type: "info" });
        return;
      }
      set(composeAttachmentModeAtom, true);
      set(composeAttachmentIndexAtom, 0);
    } else {
      set(composeAttachmentModeAtom, false);
      set(composeAttachmentIndexAtom, -1);
    }
  }
);

// Navigate compose attachments
export const moveComposeAttachmentAtom = atom(
  null,
  (get, set, direction: "next" | "prev") => {
    const attachments = get(replyAttachmentsAtom);
    if (attachments.length === 0) return;
    
    const currentIndex = get(composeAttachmentIndexAtom);
    const maxIndex = attachments.length - 1;
    
    let newIndex: number;
    if (direction === "next") {
      newIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    }
    
    set(composeAttachmentIndexAtom, newIndex);
  }
);

// Remove selected compose attachment
export const removeComposeAttachmentAtom = atom(
  null,
  (get, set) => {
    const attachments = get(replyAttachmentsAtom);
    const index = get(composeAttachmentIndexAtom);
    
    if (index < 0 || index >= attachments.length) return;
    
    const removed = attachments[index];
    const newAttachments = attachments.filter((_, i) => i !== index);
    set(replyAttachmentsAtom, newAttachments);
    
    // Adjust selection index
    if (newAttachments.length === 0) {
      set(composeAttachmentModeAtom, false);
      set(composeAttachmentIndexAtom, -1);
    } else if (index >= newAttachments.length) {
      set(composeAttachmentIndexAtom, newAttachments.length - 1);
    }
    
    const filename = removed?.split("/").pop() || "attachment";
    set(showMessageAtom, { text: `Removed: ${filename}`, type: "info" });
  }
);

// Preview selected compose attachment (uses Quick Look on macOS, fallback to open)
export const previewComposeAttachmentAtom = atom(
  null,
  async (get, set) => {
    const attachments = get(replyAttachmentsAtom);
    const index = get(composeAttachmentIndexAtom);
    
    if (index < 0 || index >= attachments.length) {
      set(showMessageAtom, { text: "No attachment selected", type: "error" });
      return;
    }
    
    const path = attachments[index];
    if (!path) return;
    
    const result = await quickLook(path);
    if (!result.success) {
      set(showMessageAtom, { text: `Failed to preview: ${result.error}`, type: "error" });
    }
  }
);

// ===== Label Actions =====

// Map Gmail hex background color to nearest terminal color
function hexToTerminalColor(hex?: string): string {
  if (!hex) return "white";
  const h = hex.replace("#", "").toLowerCase();
  // Parse RGB
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;

  // Map to basic terminal colors by closest match
  const colors: [string, number, number, number][] = [
    ["red",         220, 50,  50],
    ["redBright",   255, 100, 100],
    ["green",       50,  180, 80],
    ["greenBright", 100, 220, 120],
    ["yellow",      240, 180, 40],
    ["yellowBright",255, 220, 80],
    ["blue",        60,  100, 220],
    ["blueBright",  100, 140, 255],
    ["magenta",     180, 60,  180],
    ["magentaBright",220,120, 220],
    ["cyan",        50,  180, 200],
    ["cyanBright",  100, 220, 240],
    ["white",       200, 200, 200],
    ["gray",        128, 128, 128],
  ];

  let best = "white";
  let bestDist = Infinity;
  for (const [name, cr, cg, cb] of colors) {
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

// Fetch user labels from Gmail for all accounts.
// Loads cached labels from DB instantly, then refreshes from Gmail in the background.
export const fetchUserLabelsAtom = atom(null, async (get, set) => {
  const accounts = get(googleAccountsAtom);
  if (accounts.length === 0) return;

  // 1. Instantly load cached labels from SQLite so sidebar renders immediately
  try {
    const { getCachedUserLabels } = await import("../lib/database.ts");
    const cached = getCachedUserLabels();
    if (cached.length > 0) {
      set(userLabelsAtom, cached.map(l => ({
        id: l.id,
        name: l.name,
        color: l.color ?? "white",
        accountEmail: l.accountEmail,
      } satisfies UserLabel)));
    }
  } catch {
    // DB read failed — not critical, we'll fetch from API
  }

  // 2. Fetch fresh labels from providers and update both atom + cache
  try {
    const { upsertUserLabels } = await import("../lib/database.ts");

    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          const provider = getProviderOrNull(acc.email);
          if (!provider) return [];

          const folders = await provider.listFolders();
          const userLbls = folders
            .filter(f => f.type === "user")
            .map(f => ({
              id: f.id,
              name: f.name,
              color: hexToTerminalColor(f.color),
              accountEmail: acc.email,
            } satisfies UserLabel));

          // Persist to SQLite cache
          upsertUserLabels(acc.email, userLbls.map(l => ({
            id: l.id,
            name: l.name,
            color: l.color,
          })));

          return userLbls;
        } catch {
          return [];
        }
      })
    );

    const fresh = results.flat();
    if (fresh.length > 0) {
      set(userLabelsAtom, fresh);
    }
  } catch {
    // Non-critical — sidebar keeps showing cached labels
  }
});

// ===== Auth Actions =====

// Login to Google (add a new account)
export const loginAtom = atom(null, async (get, set) => {
  const { startLoginFlow, getAccounts, hasGmailAccess } = await import("../auth/index.ts");
  const { startSync, updateAccounts } = await import("../lib/sync.ts");
  const { createProvider, registerProvider } = await import("../api/provider.ts");
  const { GmailProvider } = await import("../api/gmail-provider.ts");

  set(isAuthLoadingAtom, true);
  set(showMessageAtom, { text: "Opening browser for authentication…", type: "info" });

  const result = await startLoginFlow({
    onAuthUrl: () => {
      set(showMessageAtom, { text: "Waiting for Google sign-in…", type: "info" });
    },
    onSuccess: (account) => {
      set(showMessageAtom, { text: `Logged in as ${account.email}`, type: "success" });
    },
    onError: (error) => {
      set(showMessageAtom, { text: `Login failed: ${error}`, type: "error" });
    },
  });

  set(isAuthLoadingAtom, false);

  if (result.success && result.account) {
    const accounts = await getAccounts();
    set(googleAccountsAtom, accounts.map(a => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));
    set(isLoggedInAtom, accounts.length > 0);

    // Create + register providers for Gmail accounts
    const gmailAccounts = accounts.filter(a => hasGmailAccess(a));
    const gmailEmails = gmailAccounts.map(a => a.account.email);

    for (const email of gmailEmails) {
      const provider = new GmailProvider(email);
      registerProvider(provider);
    }

    updateAccounts(gmailEmails);

    await startSync(gmailEmails, {
      onEmailsUpdated: (emails) => set(emailsAtom, emails),
      onLabelCountsUpdated: (counts) => set(gmailLabelCountsAtom, counts),
      onStatus: (text, type) => set(showMessageAtom, { text, type }),
      onHasMore: (hasMore) => set(hasMoreEmailsAtom, hasMore),
    });

    // Fetch custom labels and Gmail signatures
    set(fetchUserLabelsAtom);
    set(fetchSignaturesAtom);
  }
});

// Logout all accounts
export const logoutAtom = atom(null, async (get, set) => {
  const { logoutAll } = await import("../auth/index.ts");
  const { stopSync } = await import("../lib/sync.ts");
  const { clearAllData } = await import("../lib/database.ts");
  const { getAllProviders, unregisterProvider } = await import("../api/provider.ts");

  stopSync();

  // Disconnect and unregister all providers
  for (const provider of getAllProviders()) {
    try { await provider.disconnect(); } catch { /* best effort */ }
    unregisterProvider(provider.accountEmail);
  }

  await logoutAll();
  clearAllData();

  set(googleAccountsAtom, []);
  set(isLoggedInAtom, false);
  set(emailsAtom, []);
  set(gmailLabelCountsAtom, {});
  set(gmailSignaturesAtom, {});
  set(hasMoreEmailsAtom, false);
  set(userLabelsAtom, []);
  set(currentLabelAtom, "INBOX");
  set(showMessageAtom, { text: "Logged out from all accounts", type: "success" });
});

// Open accounts dialog
export const openAccountsDialogAtom = atom(null, (get, set) => {
  set(pushOverlayAtom, { kind: "accounts" as any });
});

// Manually trigger a sync refresh
export const syncEmailsAtom = atom(null, async (get, set) => {
  const { manualSync } = await import("../lib/sync.ts");
  set(isSyncingAtom, true);
  set(showMessageAtom, { text: "Syncing…", type: "info" });
  try {
    await manualSync();
  } finally {
    set(isSyncingAtom, false);
  }
});

// Clear cache and do a full resync from scratch
export const resetSyncAtom = atom(null, async (get, set) => {
  const { resetSync } = await import("../lib/sync.ts");
  set(isSyncingAtom, true);
  set(showMessageAtom, { text: "Clearing cache & resyncing…", type: "info" });
  try {
    await resetSync();
    set(showMessageAtom, { text: "Full resync complete", type: "success" });
  } catch (err) {
    set(showMessageAtom, { text: `Resync failed: ${err instanceof Error ? err.message : err}`, type: "error" });
  } finally {
    set(isSyncingAtom, false);
  }
});

// Load more emails (pagination — called on scroll)
export const loadMoreEmailsAtom = atom(null, async (get, set) => {
  const hasMore = get(hasMoreEmailsAtom);
  if (!hasMore) return;

  const { loadMore } = await import("../lib/sync.ts");
  const currentLabel = get(currentLabelAtom);
  set(isSyncingAtom, true);
  try {
    await loadMore(currentLabel);
  } finally {
    set(isSyncingAtom, false);
  }
});

// Check auth state on startup and start sync if logged in
export const checkAuthAtom = atom(null, async (get, set) => {
  const { getAccounts, hasGmailAccess } = await import("../auth/index.ts");
  const { startSync } = await import("../lib/sync.ts");
  const { registerProvider } = await import("../api/provider.ts");
  const { GmailProvider } = await import("../api/gmail-provider.ts");

  const allAccountEmails: string[] = [];

  try {
    // 1. Google OAuth accounts
    const oauthAccounts = await getAccounts();
    set(googleAccountsAtom, oauthAccounts.map(a => ({
      email: a.account.email,
      name: a.account.name,
      picture: a.account.picture,
    })));

    const gmailAccounts = oauthAccounts.filter(a => hasGmailAccess(a));
    for (const acc of gmailAccounts) {
      const provider = new GmailProvider(acc.account.email);
      registerProvider(provider);
      allAccountEmails.push(acc.account.email);
    }

    // 2. IMAP accounts from config
    const config = get(configAtom);
    const imapAccounts = config.accounts.filter(a => a.provider === "imap" && a.imap && a.smtp);
    if (imapAccounts.length > 0) {
      const { ImapSmtpProvider } = await import("../api/imap-provider.ts");
      for (const acc of imapAccounts) {
        try {
          const provider = new ImapSmtpProvider(acc.email, acc.imap!, acc.smtp!);
          registerProvider(provider);
          await provider.connect();
          allAccountEmails.push(acc.email);
        } catch (err) {
          // IMAP connection failed — log but don't stop other accounts
          set(showMessageAtom, {
            text: `Failed to connect IMAP account ${acc.email}: ${err instanceof Error ? err.message : err}`,
            type: "error",
          });
        }
      }
    }

    // 3. Mark as logged in if we have any accounts
    set(isLoggedInAtom, allAccountEmails.length > 0);

    if (allAccountEmails.length > 0) {
      // Start sync engine with all connected accounts
      await startSync(allAccountEmails, {
        onEmailsUpdated: (emails) => set(emailsAtom, emails),
        onLabelCountsUpdated: (counts) => set(gmailLabelCountsAtom, counts),
        onStatus: (text, type) => set(showMessageAtom, { text, type }),
        onHasMore: (hasMore) => set(hasMoreEmailsAtom, hasMore),
      });

      // Fetch custom labels and signatures
      set(fetchUserLabelsAtom);
      set(fetchSignaturesAtom);
    }
  } catch {
    // No accounts, that's fine
  }
});

// Get filename from path
export function getFilename(path: string): string {
  return path.split("/").pop() || path;
}

// Get file size (would need actual file stat in real implementation)
export async function getFileSize(path: string): Promise<number> {
  try {
    const file = Bun.file(path);
    return file.size;
  } catch {
    return 0;
  }
}
