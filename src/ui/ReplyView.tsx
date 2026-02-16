import React, { useMemo } from "react";
import { Box, Text, useApp, FocusScope, Input, Keybind, Select } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  selectedEmailAtom,
  replyModeAtom,
  replyToAtom,
  replyCcAtom,
  replyBccAtom,
  replySubjectAtom,
  replyContentAtom,
  replyAttachmentsAtom,
  replyFullscreenAtom,
  replyShowCcBccAtom,
  composeAttachmentIndexAtom,
  composeAttachmentModeAtom,
  attachmentPickerOpenAtom,
  contactSuggestionsAtom,
  contactSuggestionIndexAtom,
  activeContactFieldAtom,
  accountsAtom,
  replyFromAccountAtom,
} from "../state/atoms.ts";
import {
  autoSaveDraftAtom,
  closeReplyAtom,
  sendReplyAtom,
  updateReplyToAtom,
  updateReplyCcAtom,
  updateReplyBccAtom,
  updateReplySubjectAtom,
  updateReplyContentAtom,
  toggleReplyFullscreenAtom,
  toggleReplyCcBccAtom,
  openAttachmentPickerAtom,
  toggleComposeAttachmentModeAtom,
  moveComposeAttachmentAtom,
  removeComposeAttachmentAtom,
  previewComposeAttachmentAtom,
  getFilename,
  moveSuggestionAtom,
  acceptSuggestionAtom,
  setReplyAccountAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import { icons } from "./icons.ts";
import { formatFileSize } from "../utils/files.ts";

// Attachment management mode keybinds — uses priority so they fire before Input
function AttachmentModeKeybinds() {
  const toggleMode = useSetAtom(toggleComposeAttachmentModeAtom);
  const moveAttachment = useSetAtom(moveComposeAttachmentAtom);
  const removeAttachment = useSetAtom(removeComposeAttachmentAtom);
  const previewAttachment = useSetAtom(previewComposeAttachmentAtom);

  const handlers = useMemo(() => ({
    next: () => moveAttachment("next"),
    prev: () => moveAttachment("prev"),
    remove: () => removeAttachment(),
    preview: () => previewAttachment(),
    exit: () => toggleMode(),
  }), [moveAttachment, removeAttachment, previewAttachment, toggleMode]);

  return <ScopedKeybinds scope="composeAttachments" handlers={handlers} priority />;
}

// Attachment list component
function ComposeAttachments({ maxWidth }: { maxWidth: number }) {
  const attachments = useAtomValue(replyAttachmentsAtom);
  const isInAttachmentMode = useAtomValue(composeAttachmentModeAtom);
  const selectedIndex = useAtomValue(composeAttachmentIndexAtom);
  const toggleMode = useSetAtom(toggleComposeAttachmentModeAtom);
  const openPicker = useSetAtom(openAttachmentPickerAtom);

  if (attachments.length === 0) {
    return (
      <Box style={{ flexDirection: "row", paddingX: 1, gap: 1 }}>
        <Text dim>{icons.attachment}</Text>
        <Text dim>No attachments (Ctrl+A to add)</Text>
      </Box>
    );
  }

  return (
    <Box style={{
      flexDirection: "column",
      paddingX: 1,
      bg: isInAttachmentMode ? "blackBright" : undefined,
    }}>
      {/* Header */}
      <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text>{icons.attachment}</Text>
          <Text>{attachments.length} attachment{attachments.length > 1 ? "s" : ""}:</Text>
        </Box>
        {isInAttachmentMode ? (
          <Text dim>j/k:nav d:remove o:preview ^G/Esc:done</Text>
        ) : (
          <Text dim>[^G:manage] [^A:add]</Text>
        )}
      </Box>

      {/* Attachment list */}
      {attachments.map((path, index) => {
        const isSelected = isInAttachmentMode && index === selectedIndex;
        const filename = getFilename(path);

        return (
          <Box
            key={index}
            style={{
              flexDirection: "row",
              bg: isSelected ? "white" : undefined,
            }}
          >
            <Text>
              {isSelected ? "> " : "  "}{filename}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

// Contact autocomplete dropdown
function ContactSuggestions({ maxWidth }: { maxWidth: number }) {
  const suggestions = useAtomValue(contactSuggestionsAtom);
  const selectedIndex = useAtomValue(contactSuggestionIndexAtom);
  const activeField = useAtomValue(activeContactFieldAtom);
  const moveSuggestion = useSetAtom(moveSuggestionAtom);
  const acceptSuggestion = useSetAtom(acceptSuggestionAtom);

  if (suggestions.length === 0) return null;

  return (
    <Box style={{
      flexDirection: "column",
      paddingX: 1,
      marginLeft: 10,
      bg: "blackBright",
      width: Math.min(maxWidth - 10, 55),
    }}>
      <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text dim style={{ bold: true }}>
          {icons.people} Suggestions ({activeField.toUpperCase()})
        </Text>
        <Text dim>Tab:accept ↑↓:nav Esc:dismiss</Text>
      </Box>
      {suggestions.map((contact, index) => {
        const isSelected = index === selectedIndex;
        const display = contact.name
          ? `${contact.name} <${contact.email}>`
          : contact.email;
        return (
          <Box key={contact.email} style={{ flexDirection: "row" }}>
            <Text
              style={{
                bold: isSelected,
                color: isSelected ? "cyan" : undefined,
              }}
            >
              {isSelected ? "▸ " : "  "}{display}
            </Text>
          </Box>
        );
      })}
      {/* Suggestion navigation keybinds — priority so they fire before Input */}
      <Keybind keypress="tab" onPress={() => acceptSuggestion()} priority />
      <Keybind keypress="return" onPress={() => acceptSuggestion()} priority />
      <Keybind keypress="ctrl+n" onPress={() => moveSuggestion("next")} priority />
      <Keybind keypress="ctrl+p" onPress={() => moveSuggestion("prev")} priority />
      <Keybind keypress="up" onPress={() => moveSuggestion("prev")} priority />
      <Keybind keypress="down" onPress={() => moveSuggestion("next")} priority />
    </Box>
  );
}

// Compose/reply keybinds — uses the registry, rendered with priority
function ComposeKeybinds({
  replyMode,
  isInAttachmentMode,
  isPickerOpen,
  sendReply,
  closeReply,
  toggleFullscreen,
  toggleCcBcc,
  openPicker,
  toggleAttachmentMode,
}: {
  replyMode: string;
  isInAttachmentMode: boolean;
  isPickerOpen: boolean;
  sendReply: () => void;
  closeReply: () => void;
  toggleFullscreen: () => void;
  toggleCcBcc: () => void;
  openPicker: () => void;
  toggleAttachmentMode: () => void;
}) {
  const scope = (replyMode === "compose" || replyMode === "forward") ? "compose" : "reply";

  const handlers = useMemo(() => ({
    send: () => sendReply(),
    cancel: isPickerOpen ? undefined : () => (isInAttachmentMode ? toggleAttachmentMode() : closeReply()),
    toggleFullscreen: () => toggleFullscreen(),
    toggleCcBcc: () => toggleCcBcc(),
    openAttachmentPicker: isPickerOpen ? undefined : () => openPicker(),
    toggleAttachmentMode: isPickerOpen ? undefined : () => toggleAttachmentMode(),
  }), [sendReply, closeReply, toggleFullscreen, toggleCcBcc, openPicker, toggleAttachmentMode,
    isInAttachmentMode, isPickerOpen]);

  return <ScopedKeybinds scope={scope} handlers={handlers} priority />;
}

export function ReplyView() {
  const { rows: terminalHeight, columns: terminalWidth } = useApp();
  const email = useAtomValue(selectedEmailAtom);
  const replyMode = useAtomValue(replyModeAtom);
  const isFullscreen = useAtomValue(replyFullscreenAtom);
  const showCcBcc = useAtomValue(replyShowCcBccAtom);
  const attachments = useAtomValue(replyAttachmentsAtom);
  const isInAttachmentMode = useAtomValue(composeAttachmentModeAtom);
  // Multi-account
  const accounts = useAtomValue(accountsAtom);
  const fromAccount = useAtomValue(replyFromAccountAtom);
  const setReplyAccount = useSetAtom(setReplyAccountAtom);
  const hasMultipleAccounts = accounts.length > 1;

  const accountItems = React.useMemo(() =>
    accounts.map((acc) => ({
      label: `${acc.name} <${acc.email}>`,
      value: acc.email,
    })),
    [accounts]
  );

  const selectedAccountEmail = fromAccount?.email ?? "";

  const handleAccountChange = React.useCallback((email: string) => {
    const idx = accounts.findIndex(a => a.email === email);
    if (idx >= 0) setReplyAccount(idx);
  }, [accounts, setReplyAccount]);
  // Field values
  const replyTo = useAtomValue(replyToAtom);
  const replyCc = useAtomValue(replyCcAtom);
  const replyBcc = useAtomValue(replyBccAtom);
  const replySubject = useAtomValue(replySubjectAtom);
  const replyContent = useAtomValue(replyContentAtom);

  // Field updaters
  const updateTo = useSetAtom(updateReplyToAtom);
  const updateCc = useSetAtom(updateReplyCcAtom);
  const updateBcc = useSetAtom(updateReplyBccAtom);
  const updateSubject = useSetAtom(updateReplySubjectAtom);
  const updateContent = useSetAtom(updateReplyContentAtom);

  const closeReply = useSetAtom(closeReplyAtom);
  const sendReply = useSetAtom(sendReplyAtom);
  const autoSave = useSetAtom(autoSaveDraftAtom);

  // Auto-save draft every 5 seconds while composing
  React.useEffect(() => {
    if (!replyMode) return;
    const timer = setInterval(() => autoSave(), 5000);
    return () => clearInterval(timer);
  }, [replyMode, autoSave]);
  const toggleFullscreen = useSetAtom(toggleReplyFullscreenAtom);
  const toggleCcBcc = useSetAtom(toggleReplyCcBccAtom);
  const openPicker = useSetAtom(openAttachmentPickerAtom);
  const toggleAttachmentMode = useSetAtom(toggleComposeAttachmentModeAtom);
  const isPickerOpen = useAtomValue(attachmentPickerOpenAtom);

  if (!replyMode) return null;
  // For reply/replyAll/forward we need an email; for compose we don't
  if (!email && (replyMode === "reply" || replyMode === "replyAll" || replyMode === "forward")) return null;

  const modeLabel =
    replyMode === "compose" ? "Compose" :
      replyMode === "forward" ? "Forward" :
        replyMode === "replyAll" ? "Reply All" : "Reply";

  // Compact mode dimensions (bottom-right popup like Gmail)
  const compactWidth = Math.min(70, terminalWidth - 4);
  const compactHeight = Math.min(20, terminalHeight - 4);

  // Fullscreen mode dimensions
  const fullWidth = terminalWidth - 2;
  const fullHeight = terminalHeight - 2;

  // Choose dimensions based on mode
  const width = isFullscreen ? fullWidth : compactWidth;
  const height = isFullscreen ? fullHeight : compactHeight;

  // Position (bottom-right for compact, centered for fullscreen)
  const top = isFullscreen ? 1 : terminalHeight - compactHeight - 1;
  const left = isFullscreen ? 1 : terminalWidth - compactWidth - 1;

  // Calculate text area height (account for CC/BCC fields and From line when shown)
  const ccBccLines = showCcBcc ? 2 : 0;
  const fromLine = fromAccount ? 1 : 0;
  const attachmentLines = Math.max(1, attachments.length + 1); // Header + items
  const headerLines = 3 + ccBccLines + fromLine; // Title + From + To + (Cc + Bcc) + Subject
  const footerLines = 1;
  const textAreaHeight = Math.max(3, height - headerLines - footerLines - attachmentLines - 6);
  const inputWidth = width - 14; // Account for labels and padding

  return (
    <FocusScope trap>
      <Box
        style={{
          position: "absolute",
          top,
          left,
          width,
          height,
          flexDirection: "column",
          bg: "black",
          borderWidth: 1,
          borderStyle: "single",
          borderColor: "cyan",
        }}
      >
        {/* Header */}
        <Box style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingX: 1,
          bg: "cyan",
        }}>
          <Text style={{ bold: true }}>
            {icons.reply} {modeLabel}
          </Text>
          <Box style={{ flexDirection: "row", gap: 1 }}>
            <Text dim>
              {isFullscreen ? icons.compress : icons.expand}
            </Text>
            <Text dim>{icons.close}</Text>
          </Box>
        </Box>

        {/* Editable fields */}
        <Box style={{ flexDirection: "column", paddingX: 1, paddingTop: 1 }}>
          {/* From account selector */}
          {fromAccount && (
            <Box style={{ flexDirection: "row", alignItems: "center" }}>
              <Text dim style={{ width: 10 }}>From: </Text>
              {hasMultipleAccounts ? (
                <Select
                  items={accountItems}
                  value={selectedAccountEmail}
                  onChange={handleAccountChange}
                  placeholder="Select account"
                  style={{ width: inputWidth, border: "none" } as any}
                  dropdownStyle={{ border: "none" } as any}
                  focusedStyle={{ bg: "blackBright" }}
                  highlightColor="cyan"
                  maxVisible={5}
                  searchable={false}
                />
              ) : (
                <Text>{fromAccount.name} {"<"}{fromAccount.email}{">"}</Text>
              )}
            </Box>
          )}

          {/* To field with Cc/Bcc toggle */}
          <Box style={{ flexDirection: "row", alignItems: "center" }}>
            <Text dim style={{ width: 10 }}>To: </Text>
            <Box style={{ flexDirection: "row", flexGrow: 1 }}>
              <Input
                value={replyTo}
                onChange={updateTo}
                placeholder="recipient@email.com"
                style={{ width: inputWidth - (showCcBcc ? 0 : 10), height: 1 }}
                focusedStyle={{ bg: "blackBright" }}
              />
              {!showCcBcc && (
                <Text dim style={{ marginLeft: 1 }}>
                  Cc Bcc
                </Text>
              )}
            </Box>
          </Box>

          {/* Cc field (collapsible) */}
          {showCcBcc && (
            <Box style={{ flexDirection: "row", alignItems: "center" }}>
              <Text dim style={{ width: 10 }}>Cc: </Text>
              <Input
                value={replyCc}
                onChange={updateCc}
                placeholder="cc@email.com"
                style={{ width: inputWidth, height: 1 }}
                focusedStyle={{ bg: "blackBright" }}
              />
            </Box>
          )}

          {/* Bcc field (collapsible) */}
          {showCcBcc && (
            <Box style={{ flexDirection: "row", alignItems: "center" }}>
              <Text dim style={{ width: 10 }}>Bcc: </Text>
              <Input
                value={replyBcc}
                onChange={updateBcc}
                placeholder="bcc@email.com"
                style={{ width: inputWidth, height: 1 }}
                focusedStyle={{ bg: "blackBright" }}
              />
            </Box>
          )}

          {/* Contact autocomplete suggestions */}
          <ContactSuggestions maxWidth={width - 4} />

          {/* Subject field */}
          <Box style={{ flexDirection: "row", alignItems: "center" }}>
            <Text dim style={{ width: 10 }}>Subject: </Text>
            <Input
              value={replySubject}
              onChange={updateSubject}
              placeholder="Re: Subject"
              style={{ width: inputWidth, height: 1 }}
              focusedStyle={{ bg: "blackBright" }}
            />
          </Box>
        </Box>

        {/* Separator */}
        <Box style={{
          borderBottomWidth: 1,
          borderStyle: "single",
          borderColor: "gray",
          marginTop: 1,
        }} />

        {/* Message body */}
        <Box style={{
          flexDirection: "column",
          flexGrow: 1,
          paddingX: 1,
          paddingY: 1,
        }}>
          <Input
            value={replyContent}
            onChange={updateContent}
            multiline
            placeholder="Type your reply here..."
            style={{
              width: width - 4,
              height: textAreaHeight,
            }}
            focusedStyle={{ bg: "blackBright" }}
          />
        </Box>

        {/* Attachments section */}
        <ComposeAttachments maxWidth={width - 4} />

        {/* Footer with hints */}
        <Box style={{
          flexDirection: "row",
          justifyContent: "space-between",
          paddingX: 1,
          borderTopWidth: 1,
          borderStyle: "single",
          borderColor: "gray",
        }}>
          <Text dim>
            ^A:attach | ^G:manage | ^B:Cc/Bcc | ^F:{isFullscreen ? "compact" : "full"}
          </Text>
          <Text dim>
            Ctrl+S: send | Esc: cancel
          </Text>
        </Box>

        {/* Compose/reply keybinds — priority so they fire before Input */}
        <ComposeKeybinds
          replyMode={replyMode!}
          isInAttachmentMode={isInAttachmentMode}
          isPickerOpen={isPickerOpen}
          sendReply={sendReply}
          closeReply={closeReply}
          toggleFullscreen={toggleFullscreen}
          toggleCcBcc={toggleCcBcc}
          openPicker={openPicker}
          toggleAttachmentMode={toggleAttachmentMode}
        />

        {/* Attachment management sub-mode */}
        {isInAttachmentMode && <AttachmentModeKeybinds />}
      </Box>
    </FocusScope>
  );
}
