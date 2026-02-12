import React from "react";
import { Box, Text, useApp, FocusScope, Input, Keybind } from "@nick-skriabin/glyph";
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
} from "../state/atoms.ts";
import {
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
} from "../state/actions.ts";
import { icons } from "./icons.ts";
import { formatFileSize } from "../utils/files.ts";

// Component to handle attachment mode keybinds
// Uses priority Keybinds so they fire BEFORE the focused Input component
function AttachmentModeKeybinds() {
  const toggleMode = useSetAtom(toggleComposeAttachmentModeAtom);
  const moveAttachment = useSetAtom(moveComposeAttachmentAtom);
  const removeAttachment = useSetAtom(removeComposeAttachmentAtom);
  const previewAttachment = useSetAtom(previewComposeAttachmentAtom);

  return (
    <>
      <Keybind keypress="j" onPress={() => moveAttachment("next")} priority />
      <Keybind keypress="down" onPress={() => moveAttachment("next")} priority />
      <Keybind keypress="k" onPress={() => moveAttachment("prev")} priority />
      <Keybind keypress="up" onPress={() => moveAttachment("prev")} priority />
      <Keybind keypress="d" onPress={() => removeAttachment()} priority />
      <Keybind keypress="x" onPress={() => removeAttachment()} priority />
      <Keybind keypress="backspace" onPress={() => removeAttachment()} priority />
      <Keybind keypress="o" onPress={() => previewAttachment()} priority />
      <Keybind keypress="return" onPress={() => previewAttachment()} priority />
      <Keybind keypress="escape" onPress={() => toggleMode()} priority />
    </>
  );
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

export function ReplyView() {
  const { rows: terminalHeight, columns: terminalWidth } = useApp();
  const email = useAtomValue(selectedEmailAtom);
  const replyMode = useAtomValue(replyModeAtom);
  const isFullscreen = useAtomValue(replyFullscreenAtom);
  const showCcBcc = useAtomValue(replyShowCcBccAtom);
  const attachments = useAtomValue(replyAttachmentsAtom);
  const isInAttachmentMode = useAtomValue(composeAttachmentModeAtom);
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
  const toggleFullscreen = useSetAtom(toggleReplyFullscreenAtom);
  const toggleCcBcc = useSetAtom(toggleReplyCcBccAtom);
  const openPicker = useSetAtom(openAttachmentPickerAtom);
  const toggleAttachmentMode = useSetAtom(toggleComposeAttachmentModeAtom);
  const isPickerOpen = useAtomValue(attachmentPickerOpenAtom);

  if (!email || !replyMode) return null;

  const isReplyAll = replyMode === "replyAll";

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

  // Calculate text area height (account for CC/BCC fields when shown)
  const ccBccLines = showCcBcc ? 2 : 0;
  const attachmentLines = Math.max(1, attachments.length + 1); // Header + items
  const headerLines = 3 + ccBccLines; // Title + To + (Cc + Bcc) + Subject
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
            {icons.reply} {isReplyAll ? "Reply All" : "Reply"}
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
            Ctrl+Enter: send | Esc: cancel
          </Text>
        </Box>

        {/* Priority keybinds that work even when Input is focused */}
        <Keybind keypress="ctrl+return" onPress={() => sendReply()} priority />
        <Keybind keypress="escape" onPress={() => isInAttachmentMode ? toggleAttachmentMode() : closeReply()} priority disabled={isPickerOpen} />
        <Keybind keypress="ctrl+f" onPress={() => toggleFullscreen()} priority />
        <Keybind keypress="ctrl+b" onPress={() => toggleCcBcc()} priority />
        <Keybind keypress="ctrl+a" onPress={() => openPicker()} priority disabled={isPickerOpen} />
        <Keybind keypress="ctrl+g" onPress={() => toggleAttachmentMode()} priority disabled={isPickerOpen} />

        {/* Attachment mode keybinds */}
        {isInAttachmentMode && <AttachmentModeKeybinds />}
      </Box>
    </FocusScope>
  );
}
