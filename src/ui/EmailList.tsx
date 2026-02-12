import React, { useMemo, useRef, useCallback } from "react";
import { Box, Text, Keybind, useApp } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  filteredEmailsAtom,
  selectedEmailIdAtom,
  selectedIndexAtom,
  focusAtom,
  currentLabelAtom,
  unreadCountAtom,
  totalCountAtom,
  listScrollOffsetAtom,
} from "../state/atoms.ts";
import {
  moveSelectionAtom,
  toggleFocusAtom,
  toggleStarAtom,
  archiveEmailAtom,
  deleteEmailAtom,
  markUnreadAtom,
  openEmailAtom,
  openCommandAtom,
  openSearchAtom,
  openHelpAtom,
  replyEmailAtom,
  replyAllEmailAtom,
  forwardEmailAtom,
} from "../state/actions.ts";
import { formatEmailDate } from "../domain/time.ts";
import { formatEmailAddress, isUnread, isStarred, hasAttachments, type Email } from "../domain/email.ts";
import { icons } from "./icons.ts";

interface EmailItemProps {
  email: Email;
  isSelected: boolean;
  isFocused: boolean;
  isLast: boolean;
}

function EmailItem({ email, isSelected, isFocused, isLast }: EmailItemProps) {
  const unread = isUnread(email);
  const fromName = formatEmailAddress(email.from);
  const date = formatEmailDate(email.date);
  
  const isActive = isSelected && isFocused;  // full highlight: list focused + selected
  const isDimSelected = isSelected && !isFocused;  // dimmed highlight: selected but list not focused

  return (
    <Box style={{ flexDirection: "column" }}>
      {/* Email content box */}
      <Box style={{ 
        flexDirection: "column", 
        bg: isActive ? "white" : isDimSelected ? "blackBright" : undefined,
      }}>
        {/* Line 1: Subject */}
        <Box style={{ flexDirection: "row" }}>
          {/* Selection indicator */}
          <Text style={{ color: isActive ? "black" : undefined }}>
            {isSelected ? `${icons.selected} ` : "  "}
          </Text>
          
          {/* Subject */}
          <Text 
            style={{ 
              color: isActive ? "black" : (unread ? "white" : undefined),
              flexGrow: 1, 
              flexShrink: 1 
            }}
            wrap="truncate"
          >
            {email.subject}
          </Text>
          
          {/* Attachment indicator (right side) */}
          {hasAttachments(email) && (
            <Text style={{ color: isActive ? "black" : undefined, dim: !isActive }}> {icons.attachment}</Text>
          )}
          
          {/* Star indicator (right side) */}
          {isStarred(email) && (
            <Text style={{ color: isActive ? "black" : "yellow" }}> {icons.star}</Text>
          )}
          
          {/* New badge for unread emails */}
          {unread && (
            <Text style={{ color: isActive ? "black" : "cyan" }}>{icons.new}</Text>
          )}
        </Box>
        
        {/* Line 2: Sender, attachments, date (always dimmed unless selected) */}
        <Box style={{ flexDirection: "row" }}>
          {/* Indent to align with subject */}
          <Text style={{ color: isActive ? "black" : undefined }}>  </Text>
          
          {/* Sender */}
          <Text 
            style={{ 
              dim: !isActive, 
              color: isActive ? "black" : undefined,
              flexGrow: 1, 
              flexShrink: 1 
            }}
            wrap="truncate"
          >
            {fromName}
          </Text>
          
        {/* Date */}
          <Text style={{ dim: !isActive, color: isActive ? "black" : undefined }}>
            {date}
          </Text>
        </Box>
      </Box>
      
      {/* Empty line separator (outside the email box) */}
      {!isLast && <Text> </Text>}
    </Box>
  );
}

function ListKeybinds() {
  const moveSelection = useSetAtom(moveSelectionAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const toggleStar = useSetAtom(toggleStarAtom);
  const archive = useSetAtom(archiveEmailAtom);
  const deleteEmail = useSetAtom(deleteEmailAtom);
  const markUnread = useSetAtom(markUnreadAtom);
  const openEmail = useSetAtom(openEmailAtom);
  const openCommand = useSetAtom(openCommandAtom);
  const openSearch = useSetAtom(openSearchAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const reply = useSetAtom(replyEmailAtom);
  const replyAll = useSetAtom(replyAllEmailAtom);
  const forward = useSetAtom(forwardEmailAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const moveDown = useCallback(() => moveSelection("down"), [moveSelection]);
  const moveUp = useCallback(() => moveSelection("up"), [moveSelection]);
  const moveLast = useCallback(() => moveSelection("last"), [moveSelection]);
  const handleG = useCallback(() => {
    const now = Date.now();
    if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
      moveSelection("first");
      lastKeyRef.current = "";
      return;
    }
    lastKeyRef.current = "g";
    lastKeyTimeRef.current = now;
  }, [moveSelection]);
  const handleOpen = useCallback(() => openEmail(), [openEmail]);
  const handleToggleFocus = useCallback(() => toggleFocus(), [toggleFocus]);
  const handleToggleStar = useCallback(() => toggleStar(), [toggleStar]);
  const handleArchive = useCallback(() => archive(), [archive]);
  const handleDelete = useCallback(() => deleteEmail(), [deleteEmail]);
  const handleMarkUnread = useCallback(() => markUnread(), [markUnread]);
  const handleReply = useCallback(() => reply(), [reply]);
  const handleReplyAll = useCallback(() => replyAll(), [replyAll]);
  const handleForward = useCallback(() => forward(), [forward]);
  const handleOpenCommand = useCallback(() => openCommand(), [openCommand]);
  const handleOpenSearch = useCallback(() => openSearch(), [openSearch]);
  const handleOpenHelp = useCallback(() => openHelp(), [openHelp]);

  return (
    <>
      {/* Navigation */}
      <Keybind keypress="j" onPress={moveDown} />
      <Keybind keypress="down" onPress={moveDown} />
      <Keybind keypress="k" onPress={moveUp} />
      <Keybind keypress="up" onPress={moveUp} />
      <Keybind keypress="g" onPress={handleG} />
      <Keybind keypress="shift+g" onPress={moveLast} />

      {/* Open / focus */}
      <Keybind keypress="return" onPress={handleOpen} />
      <Keybind keypress="space" onPress={handleOpen} />
      <Keybind keypress="l" onPress={handleOpen} />
      <Keybind keypress="right" onPress={handleOpen} />
      <Keybind keypress="tab" onPress={handleToggleFocus} />
      <Keybind keypress="`" onPress={handleToggleFocus} />

      {/* Email actions */}
      <Keybind keypress="s" onPress={handleToggleStar} />
      <Keybind keypress="e" onPress={handleArchive} />
      <Keybind keypress="shift+d" onPress={handleDelete} />
      <Keybind keypress="u" onPress={handleMarkUnread} />
      <Keybind keypress="r" onPress={handleReply} />
      <Keybind keypress="shift+r" onPress={handleReplyAll} />
      <Keybind keypress="f" onPress={handleForward} />

      {/* Global */}
      <Keybind keypress=":" onPress={handleOpenCommand} />
      <Keybind keypress="/" onPress={handleOpenSearch} />
      <Keybind keypress="?" onPress={handleOpenHelp} />
    </>
  );
}

export function EmailList() {
  const { rows: terminalHeight, columns: terminalWidth } = useApp();
  const emails = useAtomValue(filteredEmailsAtom);
  const selectedId = useAtomValue(selectedEmailIdAtom);
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const focus = useAtomValue(focusAtom);
  const currentLabel = useAtomValue(currentLabelAtom);
  const unreadCount = useAtomValue(unreadCountAtom);
  const totalCount = useAtomValue(totalCountAtom);
  const scrollOffset = useAtomValue(listScrollOffsetAtom);
  const setScrollOffset = useSetAtom(listScrollOffsetAtom);
  
  const isFocused = focus === "list";
  
  // Calculate list dimensions
  // Sidebar takes about 40% of width, min 30, max 60
  const listWidth = Math.min(60, Math.max(30, Math.floor(terminalWidth * 0.4)));
  
  // Each email takes 3 lines (separator + subject + meta), first one has no separator
  const availableLines = terminalHeight - 4; // Header + count + status bar + padding
  const visibleCount = Math.floor((availableLines + 1) / 3); // +1 because first email has no separator
  
  // Auto-scroll to keep selection visible
  React.useEffect(() => {
    if (selectedIndex >= 0) {
      if (selectedIndex < scrollOffset) {
        setScrollOffset(selectedIndex);
      } else if (selectedIndex >= scrollOffset + visibleCount) {
        setScrollOffset(selectedIndex - visibleCount + 1);
      }
    }
  }, [selectedIndex, scrollOffset, visibleCount, setScrollOffset]);
  
  // Visible emails slice
  const visibleEmails = emails.slice(scrollOffset, scrollOffset + visibleCount);

  return (
    <Box
      style={{
        width: listWidth,
        height: "100%",
        flexDirection: "column",
        clip: true, // Clip all content to fixed width
      }}
    >
      {/* Count indicator */}
      <Box style={{ flexDirection: "row", justifyContent: "flex-end", paddingX: 1 }}>
        <Text dim>
          {unreadCount > 0 ? `${unreadCount} unread · ` : ""}{totalCount} total
        </Text>
      </Box>
      
      {/* Email list */}
      <Box style={{ flexGrow: 1, flexDirection: "column", paddingX: 1 }}>
        {visibleEmails.length === 0 ? (
          <Box style={{ paddingTop: 1 }}>
            <Text dim>No emails</Text>
          </Box>
        ) : (
          visibleEmails.map((email, index) => (
            <EmailItem
              key={email.id}
              email={email}
              isSelected={email.id === selectedId}
              isFocused={isFocused}
              isLast={index === visibleEmails.length - 1}
            />
          ))
        )}
      </Box>
      
      {/* Scroll indicator */}
      {emails.length > visibleCount && (
        <Box style={{ paddingX: 1 }}>
          <Text dim>
            {scrollOffset > 0 ? icons.arrowUp : " "}
            {scrollOffset + visibleCount < emails.length ? icons.arrowDown : " "}
            {" "}{scrollOffset + 1}-{Math.min(scrollOffset + visibleCount, emails.length)}/{emails.length}
          </Text>
        </Box>
      )}
      
      {/* Keybinds handler */}
      {isFocused && <ListKeybinds />}
    </Box>
  );
}
