import React, { useMemo, useRef, useCallback } from "react";
import { Box, Text, useApp } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  filteredThreadsAtom,
  selectedThreadIdAtom,
  selectedThreadIdsAtom,
  bulkModeAtom,
  selectedIndexAtom,
  focusAtom,
  currentLabelAtom,
  unreadCountAtom,
  totalCountAtom,
  listScrollOffsetAtom,
  hasOverlayAtom,
  folderSidebarOpenAtom,
  hasMoreEmailsAtom,
  isSyncingAtom,
  listVisibleCountAtom,
  unreadSeparatorIndexAtom,
} from "../state/atoms.ts";
import {
  moveSelectionAtom,
  toggleFocusAtom,
  toggleStarAtom,
  archiveEmailAtom,
  deleteEmailAtom,
  markUnreadAtom,
  openEmailAtom,
  openHelpAtom,
  replyEmailAtom,
  replyAllEmailAtom,
  forwardEmailAtom,
  composeEmailAtom,
  openMoveToFolderAtom,
  undoAtom,
  toggleThreadSelectionAtom,
  clearBulkSelectionAtom,
  selectAllThreadsAtom,
  bulkArchiveAtom,
  bulkDeleteAtom,
  bulkMarkReadAtom,
  bulkToggleStarAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "@semos-labs/glyph";
import { registry } from "../keybinds/registry.ts";
import { formatEmailDate } from "../domain/time.ts";
import { formatEmailAddress, isUnread, isStarred, hasAttachments, type Email, type Thread } from "../domain/email.ts";
import { icons } from "./icons.ts";

interface ThreadItemProps {
  thread: Thread;
  isSelected: boolean;
  isFocused: boolean;
  isLast: boolean;
  isBulkSelected: boolean;
}

function ThreadItem({ thread, isSelected, isFocused, isLast, isBulkSelected }: ThreadItemProps) {
  const { latest, count, hasUnread, subject } = thread;
  const fromName = formatEmailAddress(latest.from);
  const date = formatEmailDate(latest.date);
  const hasAnyAttachments = thread.messages.some(m => hasAttachments(m));
  const hasAnyStar = thread.messages.some(m => isStarred(m));
  
  const isActive = isSelected && isFocused;
  const isDimSelected = isSelected && !isFocused;

  return (
    <Box style={{ flexDirection: "column" }}>
      <Box style={{ 
        flexDirection: "column", 
        bg: isActive ? "white" : isDimSelected ? "blackBright" : undefined,
      }}>
        {/* Line 1: Subject + thread count */}
        <Box style={{ flexDirection: "row" }}>
          <Text style={{ color: isActive ? "black" : isBulkSelected ? "cyan" : undefined }}>
            {isBulkSelected ? "● " : isSelected ? `${icons.selected} ` : "  "}
          </Text>
          
          <Text 
            style={{ 
              color: isActive ? "black" : (hasUnread ? "white" : undefined),
              bold: hasUnread,
              flexGrow: 1, 
              flexShrink: 1,
              wrap: "truncate",
            }}
          >
            {subject}
          </Text>
          
          {/* Thread count badge */}
          {count > 1 && (
            <Text style={{ color: isActive ? "black" : undefined, dim: !isActive }}> ({count})</Text>
          )}
          
          {hasAnyAttachments && (
            <Text style={{ color: isActive ? "black" : undefined, dim: !isActive }}> {icons.attachment}</Text>
          )}
          
          {hasAnyStar && (
            <Text style={{ color: isActive ? "black" : "yellow" }}> {icons.star}</Text>
          )}
          
          {hasUnread && (
            <Text style={{ color: isActive ? "black" : "cyan" }}>{icons.new}</Text>
          )}
        </Box>
        
        {/* Line 2: Sender + date */}
        <Box style={{ flexDirection: "row" }}>
          <Text style={{ color: isActive ? "black" : undefined }}>  </Text>
          
          <Text 
            style={{ 
              dim: !isActive, 
              color: isActive ? "black" : undefined,
              flexGrow: 1, 
              flexShrink: 1,
              wrap: "truncate",
            }}
          >
            {fromName}
          </Text>
          
          <Text style={{ dim: !isActive, color: isActive ? "black" : undefined }}>
            {date}
          </Text>
        </Box>
      </Box>
      
      {!isLast && <Text> </Text>}
    </Box>
  );
}

function ListKeybinds() {
  const bulkMode = useAtomValue(bulkModeAtom);
  const moveSelection = useSetAtom(moveSelectionAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const toggleStar = useSetAtom(toggleStarAtom);
  const archive = useSetAtom(archiveEmailAtom);
  const deleteEmail = useSetAtom(deleteEmailAtom);
  const markUnread = useSetAtom(markUnreadAtom);
  const openEmail = useSetAtom(openEmailAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const reply = useSetAtom(replyEmailAtom);
  const replyAll = useSetAtom(replyAllEmailAtom);
  const forward = useSetAtom(forwardEmailAtom);
  const compose = useSetAtom(composeEmailAtom);
  const moveToFolder = useSetAtom(openMoveToFolderAtom);
  const undo = useSetAtom(undoAtom);
  const toggleSelection = useSetAtom(toggleThreadSelectionAtom);
  const clearBulk = useSetAtom(clearBulkSelectionAtom);
  const selectAll = useSetAtom(selectAllThreadsAtom);
  const bArchive = useSetAtom(bulkArchiveAtom);
  const bDelete = useSetAtom(bulkDeleteAtom);
  const bMarkRead = useSetAtom(bulkMarkReadAtom);
  const bStar = useSetAtom(bulkToggleStarAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const handlers = useMemo(() => ({
    // Navigation
    nextEmail: () => moveSelection("down"),
    prevEmail: () => moveSelection("up"),
    halfPageDown: () => moveSelection("halfPageDown"),
    halfPageUp: () => moveSelection("halfPageUp"),
    lastEmail: () => moveSelection("last"),
    firstEmail: () => {
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        moveSelection("first");
        lastKeyRef.current = "";
        return;
      }
      lastKeyRef.current = "g";
      lastKeyTimeRef.current = now;
    },

    // Open / focus
    openEmail: () => openEmail(),
    focusView: () => openEmail(),
    toggleFocus: () => toggleFocus(),

    // Email actions (bulk-aware)
    toggleStar: () => bulkMode ? bStar() : toggleStar(),
    archive: () => bulkMode ? bArchive() : archive(),
    delete: () => bulkMode ? bDelete() : deleteEmail(),
    markUnread: () => bulkMode ? bMarkRead() : markUnread(),
    reply: () => reply(),
    replyAll: () => replyAll(),
    forward: () => forward(),
    moveToFolder: () => moveToFolder(),
    undo: () => undo(),

    // Bulk selection
    toggleSelect: () => toggleSelection(),
    selectAll: () => selectAll(),
    clearBulk: bulkMode ? () => clearBulk() : undefined,

    // Global-like
    openHelp: () => openHelp(),
    compose: () => compose(),
  }), [bulkMode, moveSelection, openEmail, toggleFocus, toggleStar, archive, deleteEmail, markUnread,
       reply, replyAll, forward, compose, moveToFolder, undo, toggleSelection, selectAll, clearBulk,
       openHelp, bStar, bArchive, bDelete, bMarkRead]);

  return <ScopedKeybinds registry={registry} scope="list" handlers={handlers} />;
}

export function EmailList({ fullWidth }: { fullWidth?: boolean } = {}) {
  const { rows: terminalHeight, columns: terminalWidth } = useApp();
  const threads = useAtomValue(filteredThreadsAtom);
  const selectedThreadId = useAtomValue(selectedThreadIdAtom);
  const bulkSelectedIds = useAtomValue(selectedThreadIdsAtom);
  const bulkMode = useAtomValue(bulkModeAtom);
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const focus = useAtomValue(focusAtom);
  const currentLabel = useAtomValue(currentLabelAtom);
  const unreadCount = useAtomValue(unreadCountAtom);
  const totalCount = useAtomValue(totalCountAtom);
  const scrollOffset = useAtomValue(listScrollOffsetAtom);
  const setScrollOffset = useSetAtom(listScrollOffsetAtom);
  const hasOverlay = useAtomValue(hasOverlayAtom);
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);
  const hasMore = useAtomValue(hasMoreEmailsAtom);
  const isSyncing = useAtomValue(isSyncingAtom);
  const separatorIndex = useAtomValue(unreadSeparatorIndexAtom);
  
  const isFocused = focus === "list";
  
  const listWidth = fullWidth
    ? undefined  // let flexbox fill available space
    : Math.min(60, Math.max(30, Math.floor(terminalWidth * 0.4)));
  const availableLines = terminalHeight - 4;
  const visibleCount = Math.floor((availableLines + 1) / 3);

  // Keep the atom in sync so moveSelectionAtom can compute half-page jumps
  const setVisibleCount = useSetAtom(listVisibleCountAtom);
  React.useEffect(() => { setVisibleCount(visibleCount); }, [visibleCount, setVisibleCount]);
  
  React.useEffect(() => {
    if (selectedIndex >= 0) {
      if (selectedIndex < scrollOffset) {
        setScrollOffset(selectedIndex);
      } else if (selectedIndex >= scrollOffset + visibleCount) {
        setScrollOffset(selectedIndex - visibleCount + 1);
      }
    }
  }, [selectedIndex, scrollOffset, visibleCount, setScrollOffset]);
  
  const visibleThreads = threads.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <Box
      style={{
        ...(listWidth != null ? { width: listWidth } : { flexGrow: 1 }),
        height: "100%",
        flexDirection: "column",
        clip: true,
      }}
    >
      {/* Count indicator */}
      <Box style={{ flexDirection: "row", justifyContent: "flex-end", paddingX: 1 }}>
        <Text style={{ dim: true }}>
          {bulkMode ? `${bulkSelectedIds.size} selected · ` : ""}
          {unreadCount > 0 ? `${unreadCount} unread · ` : ""}{totalCount} threads
        </Text>
      </Box>
      
      {/* Thread list */}
      <Box style={{ flexGrow: 1, flexDirection: "column", paddingX: 1 }}>
        {visibleThreads.length === 0 ? (
          <Box style={{ paddingTop: 1 }}>
            <Text style={{ dim: true }}>No emails</Text>
          </Box>
        ) : (
          visibleThreads.map((thread, index) => {
            const globalIndex = scrollOffset + index;
            const showSeparator = globalIndex === separatorIndex;

            return (
              <React.Fragment key={thread.id}>
                {showSeparator && (
                  <Box style={{ flexDirection: "row", alignItems: "center", paddingY: 0 }}>
                    <Text style={{ dim: true }}>{"─".repeat((listWidth ?? terminalWidth) - 4)}</Text>
                  </Box>
                )}
                <ThreadItem
                  thread={thread}
                  isSelected={thread.id === selectedThreadId}
                  isFocused={isFocused}
                  isLast={index === visibleThreads.length - 1}
                  isBulkSelected={bulkSelectedIds.has(thread.id)}
                />
              </React.Fragment>
            );
          })
        )}
      </Box>
      
      {/* Scroll indicator */}
      {threads.length > visibleCount && (
        <Box style={{ paddingX: 1 }}>
          <Text style={{ dim: true }}>
            {scrollOffset > 0 ? icons.arrowUp : " "}
            {scrollOffset + visibleCount < threads.length ? icons.arrowDown : " "}
            {" "}{scrollOffset + 1}-{Math.min(scrollOffset + visibleCount, threads.length)}/{threads.length}
            {hasMore ? " ↓more" : ""}
            {isSyncing ? " ⟳" : ""}
          </Text>
        </Box>
      )}
      
      {/* Keybinds handler — disabled when overlays are open */}
      {isFocused && !hasOverlay && !folderSidebarOpen && <ListKeybinds />}
    </Box>
  );
}
