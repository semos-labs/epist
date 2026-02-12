import { atom } from "jotai";
import {
  emailsAtom,
  selectedEmailIdAtom,
  selectedIndexAtom,
  filteredEmailsAtom,
  selectedEmailAtom,
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
  headersExpandedAtom,
  replyModeAtom,
  replyToAtom,
  replyCcAtom,
  replyBccAtom,
  replySubjectAtom,
  replyContentAtom,
  replyAttachmentsAtom,
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
  folderSidebarOpenAtom,
  selectedFolderIndexAtom,
  type FocusContext,
  type Overlay,
  type MessageType,
} from "./atoms.ts";
import { openFile, quickLook, saveFile } from "../utils/files.ts";
import { collectFiles, filterFiles, clearFileCache } from "../utils/fzf.ts";
import { formatEmailAddress, formatEmailAddresses, isStarred, isUnread, FOLDER_LABELS, type FolderLabel, type LabelId, type AttendeeStatus } from "../domain/email.ts";
import { findCommand, getAllCommands } from "../keybinds/registry.ts";

// ===== Navigation Actions =====

// Move email selection up/down
export const moveSelectionAtom = atom(
  null,
  (get, set, direction: "up" | "down" | "first" | "last") => {
    const filtered = get(filteredEmailsAtom);
    const currentIndex = get(selectedIndexAtom);
    
    if (filtered.length === 0) return;
    
    let newIndex: number;
    switch (direction) {
      case "up":
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case "down":
        newIndex = Math.min(filtered.length - 1, currentIndex + 1);
        break;
      case "first":
        newIndex = 0;
        break;
      case "last":
        newIndex = filtered.length - 1;
        break;
    }
    
    const newEmail = filtered[newIndex];
    if (newEmail) {
      set(selectedEmailIdAtom, newEmail.id);
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
    set(emailsAtom, emails.map(e => 
      e.id === id ? { ...e, labelIds: e.labelIds.filter(l => l !== "UNREAD") } : e
    ));
  }
);

// Mark email as unread (add UNREAD label)
export const markUnreadAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => 
      e.id === id && !e.labelIds.includes("UNREAD")
        ? { ...e, labelIds: [...e.labelIds, "UNREAD"] }
        : e
    ));
    set(showMessageAtom, { text: "Marked as unread", type: "info" });
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
  }
);

// Archive email (remove INBOX label — Gmail doesn't have an explicit ARCHIVE label)
export const archiveEmailAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (e.id === id) {
        return { ...e, labelIds: e.labelIds.filter(l => l !== "INBOX") };
      }
      return e;
    }));
    
    // Move selection to next email
    set(moveSelectionAtom, "down");
    set(showMessageAtom, { text: "Archived", type: "success" });
  }
);

// Delete email (move to trash — remove INBOX, add TRASH)
export const deleteEmailAtom = atom(
  null,
  (get, set, emailId?: string) => {
    const id = emailId ?? get(selectedEmailIdAtom);
    if (!id) return;
    
    const emails = get(emailsAtom);
    set(emailsAtom, emails.map(e => {
      if (e.id === id) {
        const newLabelIds = e.labelIds.filter(l => l !== "INBOX");
        if (!newLabelIds.includes("TRASH")) {
          newLabelIds.push("TRASH");
        }
        return { ...e, labelIds: newLabelIds };
      }
      return e;
    }));
    
    // Move selection to next email
    set(moveSelectionAtom, "down");
    set(showMessageAtom, { text: "Moved to trash", type: "success" });
  }
);

// Change current label/folder
export const changeLabelAtom = atom(
  null,
  (get, set, label: FolderLabel) => {
    set(currentLabelAtom, label);
    set(selectedEmailIdAtom, null);
    set(listScrollOffsetAtom, 0);
    
    // Select first email in new label
    const filtered = get(filteredEmailsAtom);
    if (filtered.length > 0) {
      set(selectedEmailIdAtom, filtered[0]!.id);
    }
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
    
    // Get command to execute
    let command: ReturnType<typeof findCommand>;
    if (!input.trim() && filteredCommands[selectedIndex]) {
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
        set(archiveEmailAtom, undefined);
        break;
      case "delete":
        set(deleteEmailAtom, undefined);
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
      default:
        set(showMessageAtom, { text: `Executed: ${command.name}`, type: "info" });
    }
    
    // Close command bar
    set(focusAtom, "list");
    set(messageVisibleAtom, true);
  }
);

// ===== Search Actions =====

// Update search query
export const updateSearchQueryAtom = atom(
  null,
  (get, set, query: string) => {
    set(searchQueryAtom, query);
    set(searchSelectedIndexAtom, 0);
    
    // Update selection to first matching email
    const filtered = get(filteredEmailsAtom);
    if (filtered.length > 0) {
      set(selectedEmailIdAtom, filtered[0]!.id);
    }
  }
);

// Close search
export const closeSearchAtom = atom(
  null,
  (get, set) => {
    set(focusAtom, "list");
    set(searchQueryAtom, "");
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

// Toggle headers visibility
export const toggleHeadersAtom = atom(
  null,
  (get, set) => {
    const current = get(headersExpandedAtom);
    set(headersExpandedAtom, !current);
  }
);

// Open email (mark as read and focus view)
export const openEmailAtom = atom(
  null,
  (get, set) => {
    const emailId = get(selectedEmailIdAtom);
    if (emailId) {
      set(markReadAtom, emailId);
      set(focusAtom, "view");
      set(viewScrollOffsetAtom, 0);
      // Reset image navigation state
      set(imageNavModeAtom, false);
      set(focusedImageIndexAtom, -1);
    }
  }
);

// Reply to email - opens reply view
export const replyEmailAtom = atom(
  null,
  (get, set) => {
    const email = get(selectedEmailAtom);
    if (!email) {
      set(showMessageAtom, { text: "No email selected", type: "error" });
      return;
    }
    set(replyModeAtom, "reply");
    set(replyToAtom, formatEmailAddress(email.from));
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, `Re: ${email.subject}`);
    set(replyContentAtom, "");
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
    set(replyModeAtom, "replyAll");
    set(replyToAtom, formatEmailAddress(email.from));
    // CC includes all other recipients (to + cc, excluding self)
    const allRecipients = [
      ...email.to.map(formatEmailAddress),
      ...(email.cc?.map(formatEmailAddress) || []),
    ].join(", ");
    set(replyCcAtom, allRecipients);
    set(replyBccAtom, "");
    set(replySubjectAtom, `Re: ${email.subject}`);
    set(replyContentAtom, "");
    set(replyAttachmentsAtom, []);
    set(replyShowCcBccAtom, true); // Show CC/BCC for reply all
    set(focusAtom, "reply");
  }
);

// Close reply view
export const closeReplyAtom = atom(
  null,
  (get, set) => {
    set(replyModeAtom, null);
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, "");
    set(replyContentAtom, "");
    set(replyAttachmentsAtom, []);
    set(replyFullscreenAtom, false);
    set(replyShowCcBccAtom, false);
    set(focusAtom, "view");
  }
);

// Send reply (placeholder - would integrate with email API)
export const sendReplyAtom = atom(
  null,
  (get, set) => {
    const to = get(replyToAtom);
    const content = get(replyContentAtom);
    
    if (!to.trim()) {
      set(showMessageAtom, { text: "No recipients specified", type: "error" });
      return;
    }
    
    if (!content.trim()) {
      set(showMessageAtom, { text: "Cannot send empty reply", type: "error" });
      return;
    }
    
    // For now, just show a success message and close
    set(showMessageAtom, { text: `Reply sent to ${to}`, type: "success" });
    set(replyModeAtom, null);
    set(replyToAtom, "");
    set(replyCcAtom, "");
    set(replyBccAtom, "");
    set(replySubjectAtom, "");
    set(replyContentAtom, "");
    set(replyAttachmentsAtom, []);
    set(replyFullscreenAtom, false);
    set(replyShowCcBccAtom, false);
    set(focusAtom, "view");
  }
);

// Update reply fields
export const updateReplyToAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyToAtom, value);
  }
);

export const updateReplyCcAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyCcAtom, value);
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

// Update BCC field
export const updateReplyBccAtom = atom(
  null,
  (get, set, value: string) => {
    set(replyBccAtom, value);
  }
);

// Forward email (placeholder)
export const forwardEmailAtom = atom(
  null,
  (get, set) => {
    set(showMessageAtom, { text: "Forward (coming soon)", type: "info" });
  }
);

// Compose new email (placeholder)
export const composeEmailAtom = atom(
  null,
  (get, set) => {
    set(showMessageAtom, { text: "Compose (coming soon)", type: "info" });
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
    
    // Mock: In real implementation, this would be:
    // const result = await saveFile(attachment.localPath, downloadsPath, attachment.filename);
    // if (result.success) {
    //   set(showMessageAtom, { text: `Saved to: ${result.savedPath}`, type: "success" });
    // } else {
    //   set(showMessageAtom, { text: `Failed to save: ${result.error}`, type: "error" });
    // }
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
      const idx = FOLDER_LABELS.indexOf(currentLabel);
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
