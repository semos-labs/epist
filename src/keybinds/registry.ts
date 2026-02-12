import type { FocusContext } from "../state/atoms.ts";

export interface KeybindDef {
  key: string;           // The key combo (e.g., "shift+d", "ctrl+u")
  display: string;       // Human-readable display (e.g., "D", "Ctrl+u")
  description: string;   // What it does
  action: string;        // Action identifier
  command?: string;      // Optional command name for command bar
}

export type KeybindScope = FocusContext | "global";

// Central registry of all keybinds
export const KEYBIND_REGISTRY: Record<KeybindScope, KeybindDef[]> = {
  global: [
    { key: "?", display: "?", description: "Show keyboard shortcuts", action: "openHelp", command: "help" },
    { key: ":", display: ":", description: "Open command bar", action: "openCommand" },
    { key: "/", display: "/", description: "Search emails", action: "openSearch", command: "search" },
    { key: "c", display: "c", description: "Compose new email", action: "compose", command: "compose" },
    { key: "q", display: "q", description: "Quit application", action: "quit", command: "quit" },
    { key: "ctrl+c", display: "Ctrl+c", description: "Quit application", action: "quit" },
    { key: "escape", display: "Esc", description: "Close/Cancel", action: "escape" },
    
    // Label/folder navigation (command-only)
    { key: "g i", display: "gi", description: "Go to Inbox", action: "gotoInbox", command: "inbox" },
    { key: "g s", display: "gs", description: "Go to Sent", action: "gotoSent", command: "sent" },
    { key: "g d", display: "gd", description: "Go to Drafts", action: "gotoDrafts", command: "drafts" },
    { key: "g t", display: "gt", description: "Go to Trash", action: "gotoTrash", command: "trash" },
    { key: "g r", display: "gr", description: "Go to Starred", action: "gotoStarred", command: "starred" },
  ],

  list: [
    { key: "j", display: "j / ↓", description: "Next email", action: "nextEmail" },
    { key: "down", display: "j / ↓", description: "Next email", action: "nextEmail" },
    { key: "k", display: "k / ↑", description: "Previous email", action: "prevEmail" },
    { key: "up", display: "k / ↑", description: "Previous email", action: "prevEmail" },
    { key: "g", display: "gg", description: "First email", action: "firstEmail" },
    { key: "shift+g", display: "G", description: "Last email", action: "lastEmail" },
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
    { key: "u", display: "u", description: "Mark as unread", action: "markUnread", command: "unread" },
    { key: "r", display: "r", description: "Reply", action: "reply", command: "reply" },
    { key: "shift+r", display: "R", description: "Reply all", action: "replyAll", command: "reply-all" },
    { key: "f", display: "f", description: "Forward", action: "forward", command: "forward" },
  ],

  view: [
    { key: "j", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "down", display: "j / ↓", description: "Scroll down", action: "scrollDown" },
    { key: "k", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "up", display: "k / ↑", description: "Scroll up", action: "scrollUp" },
    { key: "ctrl+d", display: "Ctrl+d", description: "Page down", action: "pageDown" },
    { key: "ctrl+u", display: "Ctrl+u", description: "Page up", action: "pageUp" },
    { key: "g", display: "gg", description: "Go to top", action: "scrollTop" },
    { key: "shift+g", display: "G", description: "Go to bottom", action: "scrollBottom" },
    { key: "h", display: "h / ←", description: "Back to list", action: "focusList" },
    { key: "left", display: "h / ←", description: "Back to list", action: "focusList" },
    { key: "tab", display: "Tab", description: "Switch to list", action: "toggleFocus" },
    { key: "`", display: "`", description: "Switch to list", action: "toggleFocus" },
    { key: "escape", display: "Esc", description: "Back to list", action: "focusList" },
    
    // Email actions in view
    { key: "s", display: "s", description: "Toggle star", action: "toggleStar" },
    { key: "e", display: "e", description: "Archive email", action: "archive" },
    { key: "shift+d", display: "D", description: "Delete email", action: "delete" },
    { key: "u", display: "u", description: "Mark as unread", action: "markUnread" },
    { key: "r", display: "r", description: "Reply", action: "reply" },
    { key: "shift+r", display: "R", description: "Reply all", action: "replyAll" },
    { key: "f", display: "f", description: "Forward", action: "forward" },
    { key: "n", display: "n", description: "Next email", action: "nextEmail" },
    { key: "p", display: "p", description: "Previous email", action: "prevEmail" },
    { key: "i", display: "i", description: "Toggle headers (info)", action: "toggleHeaders" },
    { key: "shift+i", display: "I", description: "Toggle image navigation", action: "toggleImageNav" },
  ],

  command: [
    { key: "return", display: "Enter", description: "Execute command", action: "execute" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
    { key: "tab", display: "Tab", description: "Auto-complete", action: "complete" },
  ],

  search: [
    { key: "return", display: "Enter", description: "Select result", action: "select" },
    { key: "escape", display: "Esc", description: "Close search", action: "close" },
    { key: "ctrl+n", display: "Ctrl+n", description: "Next result", action: "next" },
    { key: "ctrl+p", display: "Ctrl+p", description: "Previous result", action: "prev" },
  ],

  folders: [
    { key: "j", display: "j / ↓", description: "Next folder", action: "nextFolder" },
    { key: "down", display: "j / ↓", description: "Next folder", action: "nextFolder" },
    { key: "k", display: "k / ↑", description: "Previous folder", action: "prevFolder" },
    { key: "up", display: "k / ↑", description: "Previous folder", action: "prevFolder" },
    { key: "return", display: "Enter", description: "Open folder", action: "selectFolder" },
    { key: "space", display: "Space", description: "Open folder", action: "selectFolder" },
    { key: "escape", display: "Esc", description: "Close sidebar", action: "closeSidebar" },
  ],

  compose: [
    { key: "ctrl+return", display: "Ctrl+Enter", description: "Send email", action: "send" },
    { key: "escape", display: "Esc", description: "Cancel", action: "cancel" },
  ],

  reply: [
    { key: "ctrl+return", display: "Ctrl+Enter", description: "Send reply", action: "send" },
    { key: "escape", display: "Esc", description: "Cancel reply", action: "cancel" },
  ],
};

// Get keybinds for a scope, deduped by display key
export function getKeybindsForScope(scope: KeybindScope): KeybindDef[] {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  const seen = new Set<string>();
  return keybinds.filter((kb) => {
    if (seen.has(kb.display)) return false;
    seen.add(kb.display);
    return true;
  });
}

// Get keybinds for help dialog
export function getKeybindsForHelp(context: FocusContext): { title: string; keybinds: KeybindDef[] }[] {
  const sections: { title: string; keybinds: KeybindDef[] }[] = [];

  const scopeTitle: Record<FocusContext, string> = {
    list: "Email List",
    view: "Email View",
    folders: "Folders",
    command: "Command Bar",
    search: "Search",
    compose: "Compose",
    reply: "Reply",
  };

  // Context-specific keybinds
  const contextKeybinds = getKeybindsForScope(context);
  if (contextKeybinds.length > 0) {
    sections.push({
      title: scopeTitle[context] || context,
      keybinds: contextKeybinds,
    });
  }

  // Global keybinds
  sections.push({
    title: "Global",
    keybinds: getKeybindsForScope("global"),
  });

  return sections;
}

// Get all commands from registry
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

// Handle key event and execute action
export function handleKeyEvent(
  scope: KeybindScope,
  key: { name: string; shift?: boolean; ctrl?: boolean; meta?: boolean; sequence?: string },
  handlers: Record<string, () => void>
): boolean {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  
  for (const kb of keybinds) {
    if (matchKey(kb.key, key)) {
      const handler = handlers[kb.action];
      if (handler) {
        handler();
        return true;
      }
    }
  }
  
  return false;
}

// Match key definition against key event
function matchKey(
  keyDef: string,
  key: { name: string; shift?: boolean; ctrl?: boolean; meta?: boolean; sequence?: string }
): boolean {
  const parts = keyDef.toLowerCase().split("+");
  const keyName = parts.pop() || "";
  const modifiers = new Set(parts);
  
  // Check modifiers
  if (modifiers.has("shift") !== !!key.shift) return false;
  if (modifiers.has("ctrl") !== !!key.ctrl) return false;
  if (modifiers.has("meta") !== !!key.meta) return false;
  
  // Normalize: registry uses "space" but Glyph sends " "
  const normalizedKeyName = keyName === "space" ? " " : keyName;
  
  // Check key name
  return key.name === normalizedKeyName || key.sequence === normalizedKeyName;
}
