import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Box, Text, Input, Portal, FocusScope } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom, useAtom } from "jotai";
import {
  focusAtom,
  commandInputAtom,
  commandSelectedIndexAtom,
  selectedEmailAtom,
  messageAtom,
  messageVisibleAtom,
  searchQueryAtom,
  currentLabelAtom,
  isLoggedInAtom,
  isAuthLoadingAtom,
  googleAccountsAtom,
  isSearchingRemoteAtom,
} from "../state/atoms.ts";
import {
  executeCommandAtom,
  updateSearchQueryAtom,
  closeSearchAtom,
  moveSelectionAtom,
} from "../state/actions.ts";
import { formatRelativeTime } from "../domain/time.ts";
import { getAllCommands } from "../keybinds/registry.ts";
import { CommandPalette, getSelectedCommand } from "./CommandPalette.tsx";

// Message display component
function MessageDisplay() {
  const message = useAtomValue(messageAtom);
  const isVisible = useAtomValue(messageVisibleAtom);

  if (!message || !isVisible) {
    return null;
  }

  const colorMap: Record<string, string> = {
    success: "green",
    warning: "yellow",
    error: "red",
    info: "white",
  };

  const prefixMap: Record<string, string> = {
    success: "✓ ",
    warning: "⚠ ",
    error: "✗ ",
    info: "",
  };

  return (
    <Box style={{ flexDirection: "row", flexGrow: 1 }}>
      <Text style={{ color: colorMap[message.type] as any, bold: message.type === "error" }}>
        {prefixMap[message.type]}{message.text}
      </Text>
    </Box>
  );
}

// Command input component
function CommandInput() {
  const [input, setInput] = useAtom(commandInputAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(commandSelectedIndexAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const setFocus = useSetAtom(focusAtom);

  // Get filtered commands
  const allCommands = useMemo(() => getAllCommands(), []);
  const filteredCommands = useMemo(() => {
    if (!input.trim()) return allCommands;
    const query = input.toLowerCase().trim();
    return allCommands.filter((cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [allCommands, input]);

  // Reset selection when input changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [input, setSelectedIndex]);

  const selectCommand = useCallback(() => {
    executeCommand();
  }, [executeCommand]);

  // Auto-fill selected command
  const autoFillCommand = useCallback(() => {
    const selected = getSelectedCommand(input, selectedIndex);
    if (selected) {
      setInput(selected.name + " ");
    }
  }, [input, selectedIndex, setInput]);

  const handleKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    const isCtrlP = key.sequence === "\x10";
    const isCtrlN = key.sequence === "\x0e";

    if (key.name === "return") {
      selectCommand();
      return true;
    }
    if (key.name === "tab") {
      autoFillCommand();
      return true;
    }
    if (key.name === "escape") {
      setFocus("list");
      return true;
    }
    if (key.name === "up" || isCtrlP) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down" || isCtrlN) {
      setSelectedIndex((i) => Math.min(filteredCommands.length - 1, i + 1));
      return true;
    }
    return false;
  }, [selectCommand, autoFillCommand, setFocus, setSelectedIndex, filteredCommands.length]);

  return (
    <FocusScope trap>
      <Box style={{ flexDirection: "row", flexGrow: 1, alignItems: "center" }}>
        <Text style={{ color: "cyan", bold: true }}>:</Text>
        <Input
          key="command-input"
          value={input}
          placeholder="Type command..."
          onChange={setInput}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            flexGrow: 1,
          }}
        />
      </Box>
    </FocusScope>
  );
}

// Search input component
function SearchInput() {
  const query = useAtomValue(searchQueryAtom);
  const updateQuery = useSetAtom(updateSearchQueryAtom);
  const closeSearch = useSetAtom(closeSearchAtom);
  const moveSelection = useSetAtom(moveSelectionAtom);
  const isSearchingRemote = useAtomValue(isSearchingRemoteAtom);

  const handleKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    const isCtrlP = key.sequence === "\x10";
    const isCtrlN = key.sequence === "\x0e";

    if (key.name === "escape") {
      closeSearch();
      return true;
    }
    if (key.name === "return") {
      closeSearch();
      return true;
    }
    if (key.name === "up" || isCtrlP) {
      moveSelection("up");
      return true;
    }
    if (key.name === "down" || isCtrlN) {
      moveSelection("down");
      return true;
    }
    return false;
  }, [closeSearch, moveSelection]);

  return (
    <FocusScope trap>
      <Box style={{ flexDirection: "row", flexGrow: 1, alignItems: "center" }}>
        <Text style={{ color: "cyan", bold: true }}>/</Text>
        <Input
          key="search-input"
          value={query}
          placeholder="Search... (from: to: has:attachment is:unread after: before:)"
          onChange={updateQuery}
          onKeyPress={handleKeyPress}
          autoFocus
          style={{
            flexGrow: 1,
          }}
        />
        {isSearchingRemote && <Text style={{ color: "yellow" }}> ⟳</Text>}
      </Box>
    </FocusScope>
  );
}

// Status info (shows selected email info)
function StatusInfo() {
  const email = useAtomValue(selectedEmailAtom);
  const message = useAtomValue(messageAtom);
  const isMessageVisible = useAtomValue(messageVisibleAtom);
  const label = useAtomValue(currentLabelAtom);

  // Show message if visible
  if (message && isMessageVisible) {
    return <MessageDisplay />;
  }

  if (!email) {
    return (
      <Text dim>
        {label.charAt(0) + label.slice(1).toLowerCase()} • Press ? for help
      </Text>
    );
  }

  const timeAgo = formatRelativeTime(email.date);

  return (
    <Box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
      <Text dim>{timeAgo}</Text>
      <Text style={{ color: email.labelIds.includes("STARRED") ? "yellow" : undefined }} wrap="truncate">
        {email.subject}
      </Text>
    </Box>
  );
}

// Auth indicator
function AuthIndicator() {
  const loggedIn = useAtomValue(isLoggedInAtom);
  const loading = useAtomValue(isAuthLoadingAtom);
  const accounts = useAtomValue(googleAccountsAtom);

  if (loading) {
    return <Text style={{ color: "yellow" }}>⟳ signing in…</Text>;
  }

  if (loggedIn && accounts.length > 0) {
    const primary = accounts[0]!;
    const label = primary.name || primary.email;
    return (
      <Text style={{ color: "green" }}>
        ● {label}{accounts.length > 1 ? ` +${accounts.length - 1}` : ""}
      </Text>
    );
  }

  return <Text dim>○ offline</Text>;
}

// Clock component
function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <Text bold>{timeStr}</Text>
  );
}

export function StatusBar() {
  const focus = useAtomValue(focusAtom);
  const isCommandMode = focus === "command";
  const isSearchMode = focus === "search";

  return (
    <>
      {/* Command Palette (floats above status bar) */}
      {isCommandMode && (
        <Portal zIndex={40}>
          <CommandPalette />
        </Portal>
      )}

      <Box
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingX: 1,
          borderTopWidth: 1,
          borderStyle: "single",
          borderColor: "gray",
        }}
      >
        {/* Left side: Input or status info */}
        <Box style={{ flexGrow: 1, flexShrink: 1 }}>
          {isCommandMode ? (
            <CommandInput />
          ) : isSearchMode ? (
            <SearchInput />
          ) : (
            <StatusInfo />
          )}
        </Box>

        {/* Right side: Auth + Hints + Clock */}
        <Box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
          <AuthIndicator />
          {!isCommandMode && !isSearchMode && (
            <Text dim>:cmd /search ?help</Text>
          )}
          <Clock />
        </Box>
      </Box>
    </>
  );
}
