import React, { useState, useEffect, useCallback } from "react";
import {
  StatusBar as GlyphStatusBar,
  useStatusBar,
  Box,
  Text,
} from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  focusAtom,
  selectedEmailAtom,
  isLoggedInAtom,
  isAuthLoadingAtom,
  googleAccountsAtom,
  currentLabelAtom,
  isSearchingRemoteAtom,
} from "../state/atoms.ts";
import {
  updateSearchQueryAtom,
  closeSearchAtom,
  moveSelectionAtom,
  dispatchCommandAtom,
} from "../state/actions.ts";
import { formatRelativeTime } from "../domain/time.ts";
import { registry } from "../keybinds/registry.ts";
import { setStatusBarRef } from "../lib/statusBarBridge.ts";

// ── Bridge: expose useStatusBar to Jotai atoms ──────────

function StatusBarBridge() {
  const { showMessage, clearMessage } = useStatusBar();

  useEffect(() => {
    setStatusBarRef(showMessage, clearMessage);
    return () => setStatusBarRef(null, null);
  }, [showMessage, clearMessage]);

  return null;
}

// ── Status info (idle content shown on the left) ────────

function StatusInfo() {
  const email = useAtomValue(selectedEmailAtom);
  const label = useAtomValue(currentLabelAtom);

  if (!email) {
    return (
      <Text style={{ dim: true }}>
        {label.charAt(0) + label.slice(1).toLowerCase()} • Press ? for help
      </Text>
    );
  }

  const timeAgo = formatRelativeTime(email.date);

  return (
    <Box style={{ flexDirection: "row", gap: 1, flexGrow: 1 }}>
      <Text style={{ dim: true }}>{timeAgo}</Text>
      <Text
        style={{
          color: email.labelIds.includes("STARRED") ? "yellow" : undefined,
          wrap: "truncate",
        }}
      >
        {email.subject}
      </Text>
    </Box>
  );
}

// ── Auth indicator ──────────────────────────────────────

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
        ● {label}
        {accounts.length > 1 ? ` +${accounts.length - 1}` : ""}
      </Text>
    );
  }

  return <Text style={{ dim: true }}>○ offline</Text>;
}

// ── Clock ───────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return <Text style={{ bold: true }}>{timeStr}</Text>;
}

// ── Right-side content ──────────────────────────────────

function RightContent() {
  return (
    <Box style={{ flexDirection: "row", gap: 2, alignItems: "center" }}>
      <AuthIndicator />
      <Text style={{ dim: true }}>:cmd /search ?help</Text>
      <Clock />
    </Box>
  );
}

// ── Search spinner (shown next to search input) ─────────

function SearchSpinner() {
  const isSearchingRemote = useAtomValue(isSearchingRemoteAtom);
  if (!isSearchingRemote) return null;
  return <Text style={{ color: "yellow" }}> ⟳</Text>;
}

// ── Main wrapper ────────────────────────────────────────

export function AppStatusBar({ children }: { children: React.ReactNode }) {
  const setFocus = useSetAtom(focusAtom);
  const updateQuery = useSetAtom(updateSearchQueryAtom);
  const closeSearch = useSetAtom(closeSearchAtom);
  const moveSelection = useSetAtom(moveSelectionAtom);
  const dispatchCommand = useSetAtom(dispatchCommandAtom);

  const handleSearch = useCallback(
    (query: string) => {
      // Ensure focus state reflects search mode
      setFocus("search");
      updateQuery(query);
    },
    [setFocus, updateQuery],
  );

  const handleSearchDismiss = useCallback(() => {
    closeSearch();
  }, [closeSearch]);

  const handleSearchSubmit = useCallback(() => {
    // Keep search results visible but go back to list
    setFocus("list");
  }, [setFocus]);

  const handleSearchNavigate = useCallback(
    (direction: "up" | "down") => {
      moveSelection(direction);
    },
    [moveSelection],
  );

  const handleCommand = useCallback(
    (action: string, args?: string) => {
      dispatchCommand({ action, args });
    },
    [dispatchCommand],
  );

  return (
    <GlyphStatusBar
      commands={registry}
      onCommand={handleCommand}
      commandKey=":"
      commandPlaceholder="Type command..."
      onSearch={handleSearch}
      onSearchDismiss={handleSearchDismiss}
      onSearchSubmit={handleSearchSubmit}
      onSearchNavigate={handleSearchNavigate}
      searchKey="/"
      searchPlaceholder="Search... (from: to: has:attachment is:unread after: before:)"
      status={<StatusInfo />}
      right={<RightContent />}
      style={{
        borderTopWidth: 1,
        borderStyle: "single",
        borderColor: "gray",
      }}
    >
      {children}
      <StatusBarBridge />
    </GlyphStatusBar>
  );
}
