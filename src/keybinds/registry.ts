import type { FocusContext } from "../state/atoms.ts";

export interface KeybindDef {
  key: string;           // The key combo (e.g., "shift+d", "ctrl+u")
  display: string;       // Human-readable display (e.g., "D", "Ctrl+u")
  description: string;   // What it does
  action: string;        // Action identifier
  command?: string;      // Optional command name for command bar
}

// Sub-mode scopes extend beyond FocusContext
export type KeybindScope =
  | FocusContext
  | "global"
  | "viewAttachments"   // Email view with attachment section focused
  | "viewImageNav"      // Email view in image navigation mode
  | "inlineReply"       // Quick inline reply box
  | "moveToFolder"      // Move-to-folder overlay picker
  | "composeAttachments" // Attachment management mode in compose/reply
  | "help";             // Help dialog

// ===== Central Registry =====
// Every keybind in the app is defined here.

export const KEYBIND_REGISTRY: Record<KeybindScope, KeybindDef[]> = {

  // ── Global ─────────────────────────────────────────────
  // These fire regardless of list/view focus (but not in command/search/reply/overlays)
  global: [
    { key: "q", display: "q", description: "Quit application", action: "quit", command: "quit" },
    { key: "ctrl+c", display: "Ctrl+c", description: "Quit application", action: "quit" },
    { key: "ctrl+f", display: "Ctrl+f", description: "Toggle folder sidebar", action: "toggleFolderSidebar" },
  ],

  // ── Email List ─────────────────────────────────────────
  list: [
    // Navigation
    { key: "j", display: "j / ↓", description: "Next email", action: "nextEmail" },
    { key: "down", display: "j / ↓", description: "Next email", action: "nextEmail" },
    { key: "k", display: "k / ↑", description: "Previous email", action: "prevEmail" },
    { key: "up", display: "k / ↑", description: "Previous email", action: "prevEmail" },
    { key: "shift+g", display: "G", description: "Last email", action: "lastEmail" },
    { key: "g", display: "gg", description: "First email", action: "firstEmail" },

    // Open / focus
    { key: "return", display: "Enter", description: "Open email", action: "openEmail" },
    { key: "space", display: "Space", description: "Open email", action: "openEmail" },
    { key: "l", display: "l / →", description: "View email", action: "focusView" },
    { key: "right", display: "l / →", description: "View email", action: "focusView" },
    { key: "tab", display: "Tab", description: "Switch to view", action: "toggleFocus" },
    { key: "`", display: "`", description: "Switch to view", action: "toggleFocus" },

    // Email actions
    { key: "s", display: "s", description: "Toggle star", action: "toggleStar", command: "star" },
    { key: "e", display: "e", description: "Archive email", action: "archive", command: "archive" },
    { key: "shift+d", display: "D", description: "Delete email", action: "delete", command: "delete" },
    { key: "u", display: "u", description: "Toggle read/unread", action: "markUnread", command: "unread" },
    { key: "shift+r", display: "R", description: "Reply all", action: "replyAll", command: "reply-all" },
    { key: "r", display: "r", description: "Reply", action: "reply", command: "reply" },
    { key: "f", display: "f", description: "Forward", action: "forward", command: "forward" },
    { key: "m", display: "m", description: "Move to folder", action: "moveToFolder", command: "move" },
    { key: "z", display: "z", description: "Undo last action", action: "undo", command: "undo" },

    // Bulk selection
    { key: "x", display: "x", description: "Toggle thread selection", action: "toggleSelect" },
    { key: "shift+a", display: "A", description: "Select all threads", action: "selectAll" },
    { key: "escape", display: "Esc", description: "Clear selection", action: "clearBulk" },

    // Global-like (available in list context)
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "/", display: "/", description: "Search emails", action: "openSearch", command: "search" },
    { key: "?", display: "?", description: "Show keyboard shortcuts", action: "openHelp", command: "help" },
    { key: "c", display: "c", description: "Compose new email", action: "compose", command: "compose" },

    // Auth commands (command-bar only, no key)
    { key: "", display: "", description: "Login to Google", action: "login", command: "login" },
    { key: "", display: "", description: "Logout all accounts", action: "logout", command: "logout" },
    { key: "", display: "", description: "Manage accounts", action: "accounts", command: "profile" },
    { key: "", display: "", description: "Add IMAP/SMTP account", action: "addAccount", command: "add-account" },
    { key: "", display: "", description: "Sync emails from server", action: "sync", command: "sync" },
    { key: "", display: "", description: "Clear cache & full resync", action: "resetSync", command: "reset-sync" },
    { key: "", display: "", description: "Rebuild search index", action: "reindex", command: "reindex" },
  ],

  // ── Email View ─────────────────────────────────────────
  view: [
    // Scroll
    { key: "j", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "down", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "k", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "up", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "ctrl+d", display: "Ctrl+d", description: "Page down", action: "pageDown" },
    { key: "ctrl+u", display: "Ctrl+u", description: "Page up", action: "pageUp" },
    { key: "shift+g", display: "G", description: "Go to bottom", action: "scrollBottom" },
    { key: "g", display: "gg", description: "Go to top", action: "scrollTop" },

    // Focus
    { key: "h", display: "h / ←", description: "Back to list", action: "focusList" },
    { key: "left", display: "h / ←", description: "Back to list", action: "focusList" },
    { key: "`", display: "`", description: "Switch to list", action: "toggleFocus" },
    { key: "escape", display: "Esc", description: "Back to list", action: "focusList" },

    // Email actions
    { key: "s", display: "s", description: "Toggle star", action: "toggleStar" },
    { key: "e", display: "e", description: "Archive email", action: "archive" },
    { key: "shift+d", display: "D", description: "Delete email", action: "delete" },
    { key: "u", display: "u", description: "Toggle read/unread", action: "markUnread" },
    { key: "ctrl+n", display: "Ctrl+n", description: "Next email", action: "nextEmail" },
    { key: "ctrl+p", display: "Ctrl+p", description: "Previous email", action: "prevEmail" },
    { key: "shift+r", display: "R", description: "Reply all", action: "replyAll" },
    { key: "r", display: "r", description: "Reply", action: "reply" },
    { key: "f", display: "f", description: "Forward", action: "forward" },
    { key: "shift+i", display: "I", description: "Toggle image navigation", action: "toggleImageNav" },
    { key: "i", display: "i", description: "Toggle headers (info)", action: "toggleHeaders" },
    { key: "a", display: "a", description: "Toggle attachments", action: "toggleAttachments" },
    { key: "shift+h", display: "H", description: "Toggle raw HTML (debug)", action: "toggleDebugHtml" },
    { key: "ctrl+y", display: "Ctrl+y", description: "Copy raw HTML to clipboard", action: "copyHtmlToClipboard" },

    // Link navigation
    { key: "tab", display: "Tab", description: "Next link", action: "nextLink" },
    { key: "shift+tab", display: "Shift+Tab", description: "Previous link", action: "prevLink" },
    { key: "return", display: "Enter", description: "Open link", action: "openLink" },

    // Thread message navigation
    { key: "]", display: "]", description: "Next message in thread", action: "nextMessage" },
    { key: "[", display: "[", description: "Previous message in thread", action: "prevMessage" },

    // Move / undo / inline reply
    { key: "m", display: "m", description: "Move to folder", action: "moveToFolder" },
    { key: "z", display: "z", description: "Undo last action", action: "undo" },
    { key: "shift+q", display: "Q", description: "Quick inline reply", action: "inlineReply" },

    // Calendar RSVP (conditionally active)
    { key: "y", display: "y", description: "Accept invite", action: "rsvpAccept" },
    { key: "n", display: "n", description: "Decline invite", action: "rsvpDecline" },
    { key: "t", display: "t", description: "Maybe / Tentative", action: "rsvpTentative" },

    // Global-like (available in view context)
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "/", display: "/", description: "Search emails", action: "openSearch" },
    { key: "?", display: "?", description: "Show keyboard shortcuts", action: "openHelp" },
    { key: "c", display: "c", description: "Compose new email", action: "compose" },
  ],

  // ── View: Attachment Navigation ────────────────────────
  viewAttachments: [
    { key: "j", display: "j / ↓", description: "Next attachment", action: "nextAttachment" },
    { key: "down", display: "j / ↓", description: "Next attachment", action: "nextAttachment" },
    { key: "k", display: "k / ↑", description: "Previous attachment", action: "prevAttachment" },
    { key: "up", display: "k / ↑", description: "Previous attachment", action: "prevAttachment" },
    { key: "return", display: "Enter", description: "Open attachment", action: "openAttachment" },
    { key: "o", display: "o", description: "Open attachment", action: "openAttachment" },
    { key: "s", display: "s", description: "Save attachment", action: "saveAttachment" },
    { key: "shift+s", display: "S", description: "Save all attachments", action: "saveAll" },
    { key: "a", display: "a", description: "Exit attachment mode", action: "exitAttachments" },
  ],

  // ── View: Image Navigation ─────────────────────────────
  viewImageNav: [
    { key: "tab", display: "Tab", description: "Next image", action: "nextImage" },
    { key: "shift+tab", display: "Shift+Tab", description: "Previous image", action: "prevImage" },
    { key: "j", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "down", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "k", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "up", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "escape", display: "Esc", description: "Exit image nav", action: "exitImageNav" },
    { key: "shift+i", display: "I", description: "Exit image nav", action: "exitImageNav" },
  ],

  // ── Inline Reply ───────────────────────────────────────
  inlineReply: [
    { key: "ctrl+s", display: "Ctrl+s", description: "Send reply", action: "send" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
    { key: "ctrl+f", display: "Ctrl+f", description: "Expand to full reply", action: "expand" },
  ],

  // ── Folder Sidebar ─────────────────────────────────────
  folders: [
    { key: "j", display: "j / ↓", description: "Next folder", action: "nextFolder" },
    { key: "down", display: "j / ↓", description: "Next folder", action: "nextFolder" },
    { key: "k", display: "k / ↑", description: "Previous folder", action: "prevFolder" },
    { key: "up", display: "k / ↑", description: "Previous folder", action: "prevFolder" },
    { key: "space", display: "Space", description: "Toggle categories", action: "toggleCategories" },
    { key: "right", display: "→", description: "Toggle categories", action: "toggleCategories" },
    { key: "left", display: "←", description: "Collapse categories", action: "collapseCategories" },
    { key: "escape", display: "Esc", description: "Close sidebar", action: "closeSidebar" },
    { key: "ctrl+f", display: "Ctrl+f", description: "Close sidebar", action: "closeSidebar" },
  ],

  // ── Move to Folder Picker ──────────────────────────────
  moveToFolder: [
    { key: "j", display: "j / ↓", description: "Next folder", action: "next" },
    { key: "down", display: "j / ↓", description: "Next folder", action: "next" },
    { key: "k", display: "k / ↑", description: "Previous folder", action: "prev" },
    { key: "up", display: "k / ↑", description: "Previous folder", action: "prev" },
    { key: "return", display: "Enter", description: "Move to folder", action: "select" },
    { key: "space", display: "Space", description: "Move to folder", action: "select" },
    { key: "escape", display: "Esc", description: "Cancel", action: "close" },
  ],

  // ── Compose / Reply ────────────────────────────────────
  compose: [
    { key: "ctrl+s", display: "Ctrl+s", description: "Send email", action: "send" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
    { key: "ctrl+f", display: "Ctrl+f", description: "Toggle fullscreen", action: "toggleFullscreen" },
    { key: "ctrl+b", display: "Ctrl+b", description: "Toggle Cc/Bcc", action: "toggleCcBcc" },
    { key: "ctrl+a", display: "Ctrl+a", description: "Attach file", action: "openAttachmentPicker" },
    { key: "ctrl+g", display: "Ctrl+g", description: "Manage attachments", action: "toggleAttachmentMode" },
  ],

  reply: [
    { key: "ctrl+s", display: "Ctrl+s", description: "Send reply", action: "send" },
    { key: "escape", display: "Esc", description: "Cancel reply", action: "cancel" },
    { key: "ctrl+f", display: "Ctrl+f", description: "Toggle fullscreen", action: "toggleFullscreen" },
    { key: "ctrl+b", display: "Ctrl+b", description: "Toggle Cc/Bcc", action: "toggleCcBcc" },
    { key: "ctrl+a", display: "Ctrl+a", description: "Attach file", action: "openAttachmentPicker" },
    { key: "ctrl+g", display: "Ctrl+g", description: "Manage attachments", action: "toggleAttachmentMode" },
  ],

  // ── Compose: Attachment Management ─────────────────────
  composeAttachments: [
    { key: "j", display: "j / ↓", description: "Next attachment", action: "next" },
    { key: "down", display: "j / ↓", description: "Next attachment", action: "next" },
    { key: "k", display: "k / ↑", description: "Previous attachment", action: "prev" },
    { key: "up", display: "k / ↑", description: "Previous attachment", action: "prev" },
    { key: "d", display: "d", description: "Remove attachment", action: "remove" },
    { key: "x", display: "x", description: "Remove attachment", action: "remove" },
    { key: "backspace", display: "Backspace", description: "Remove attachment", action: "remove" },
    { key: "o", display: "o", description: "Preview attachment", action: "preview" },
    { key: "return", display: "Enter", description: "Preview attachment", action: "preview" },
    { key: "escape", display: "Esc", description: "Exit attachment mode", action: "exit" },
  ],

  // ── Command Bar ────────────────────────────────────────
  command: [
    { key: "return", display: "Enter", description: "Execute command", action: "execute" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
    { key: "tab", display: "Tab", description: "Auto-complete", action: "complete" },
  ],

  // ── Search ─────────────────────────────────────────────
  search: [
    { key: "return", display: "Enter", description: "Confirm search", action: "select" },
    { key: "escape", display: "Esc", description: "Close search", action: "close" },
    { key: "ctrl+n", display: "Ctrl+n", description: "Next result", action: "next" },
    { key: "ctrl+p", display: "Ctrl+p", description: "Previous result", action: "prev" },
  ],

  // ── Help Dialog ────────────────────────────────────────
  help: [
    { key: "escape", display: "Esc", description: "Close help", action: "close" },
    { key: "ctrl+n", display: "Ctrl+n / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "down", display: "Ctrl+n / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "ctrl+p", display: "Ctrl+p / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "up", display: "Ctrl+p / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "ctrl+d", display: "Ctrl+d", description: "Page down", action: "pageDown" },
    { key: "ctrl+u", display: "Ctrl+u", description: "Page up", action: "pageUp" },
  ],
};

// ===== Helpers =====

// Get keybinds for a scope, deduped by display key
export function getKeybindsForScope(scope: KeybindScope): KeybindDef[] {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  const seen = new Set<string>();
  return keybinds.filter((kb) => {
    if (!kb.key || seen.has(kb.display)) return false;
    seen.add(kb.display);
    return true;
  });
}

// Scope titles for help dialog
const SCOPE_TITLES: Partial<Record<KeybindScope, string>> = {
  list: "Email List",
  view: "Email View",
  viewAttachments: "Attachment Navigation",
  viewImageNav: "Image Navigation",
  inlineReply: "Quick Reply",
  folders: "Folders",
  moveToFolder: "Move to Folder",
  compose: "Compose",
  reply: "Reply",
  composeAttachments: "Attachment Management",
  command: "Command Bar",
  search: "Search",
  help: "Help",
  global: "Global",
};

// Related sub-mode scopes for each main context
const RELATED_SCOPES: Partial<Record<KeybindScope, KeybindScope[]>> = {
  view: ["viewAttachments", "viewImageNav", "inlineReply"],
  compose: ["composeAttachments"],
  reply: ["composeAttachments"],
};

// Get keybinds for help dialog — context + related sub-modes + global
export function getKeybindsForHelp(context: FocusContext): { title: string; keybinds: KeybindDef[] }[] {
  const sections: { title: string; keybinds: KeybindDef[] }[] = [];

  // Context-specific keybinds
  const contextKeybinds = getKeybindsForScope(context);
  if (contextKeybinds.length > 0) {
    sections.push({
      title: SCOPE_TITLES[context] || context,
      keybinds: contextKeybinds,
    });
  }

  // Related sub-mode keybinds
  const related = RELATED_SCOPES[context] || [];
  for (const subScope of related) {
    const subKeybinds = getKeybindsForScope(subScope);
    if (subKeybinds.length > 0) {
      sections.push({
        title: SCOPE_TITLES[subScope] || subScope,
        keybinds: subKeybinds,
      });
    }
  }

  // Global keybinds
  sections.push({
    title: "Global",
    keybinds: getKeybindsForScope("global"),
  });

  return sections;
}

// Get all commands from registry (keybinds with command field)
export function getAllCommands(): { name: string; description: string; action: string }[] {
  const commands: { name: string; description: string; action: string }[] = [];
  const seen = new Set<string>();

  for (const scope of Object.keys(KEYBIND_REGISTRY) as KeybindScope[]) {
    for (const kb of KEYBIND_REGISTRY[scope]) {
      if (kb.command && !seen.has(kb.command)) {
        seen.add(kb.command);
        commands.push({
          name: kb.command,
          description: kb.description,
          action: kb.action,
        });
      }
    }
  }

  return commands.sort((a, b) => a.name.localeCompare(b.name));
}

// Find command by name
export function findCommand(input: string): { name: string; action: string; args?: string } | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const commands = getAllCommands();

  // Exact match
  const exact = commands.find((c) => c.name === trimmed);
  if (exact) {
    return { name: exact.name, action: exact.action };
  }

  // Parameterized commands
  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0];
  const args = parts.slice(1).join(" ");

  const parameterized = commands.find((c) => c.name === cmdName);
  if (parameterized) {
    return { name: parameterized.name, action: parameterized.action, args: args || undefined };
  }

  return null;
}
