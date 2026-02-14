import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, FocusScope } from "@semos-labs/glyph";
import { useSetAtom, useAtomValue } from "jotai";
import { moveToFolderAtom, popOverlayAtom } from "../state/actions.ts";
import { currentLabelAtom } from "../state/atoms.ts";
import { FOLDER_LABELS, type FolderLabel } from "../domain/email.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import { icons } from "./icons.ts";

const FOLDER_ICONS: Record<string, string> = {
  INBOX: icons.inbox,
  SENT: icons.sent,
  DRAFT: icons.drafts,
  TRASH: icons.trash,
  SPAM: icons.close,
  STARRED: icons.star,
  IMPORTANT: icons.unread,
};

export function MoveToFolderPicker() {
  const { rows, columns } = useApp();
  const currentLabel = useAtomValue(currentLabelAtom);
  const moveToFolder = useSetAtom(moveToFolderAtom);
  const popOverlay = useSetAtom(popOverlayAtom);

  // Filter out the current folder from the list
  const folders = FOLDER_LABELS.filter(f => f !== currentLabel);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handlers = useMemo(() => ({
    next: () => setSelectedIndex(i => Math.min(i + 1, folders.length - 1)),
    prev: () => setSelectedIndex(i => Math.max(i - 1, 0)),
    select: () => {
      const target = folders[selectedIndex];
      if (target) {
        moveToFolder(target);
        popOverlay();
      }
    },
    close: () => popOverlay(),
  }), [selectedIndex, folders, moveToFolder, popOverlay]);

  // Position in center of screen
  const boxWidth = 28;
  const boxHeight = folders.length + 2;
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));
  const left = Math.max(0, Math.floor((columns - boxWidth) / 2));

  return (
    <FocusScope trap>
      <Box
        style={{
          position: "absolute",
          top,
          left,
          width: boxWidth,
          flexDirection: "column",
          border: "single",
          borderColor: "white",
          bg: "black",
        } as any}
      >
        <Box style={{ paddingX: 1, borderBottomWidth: 1, borderStyle: "single", borderColor: "gray" } as any}>
          <Text bold>Move to…</Text>
        </Box>

        {folders.map((folder, index) => {
          const isSelected = index === selectedIndex;
          const icon = FOLDER_ICONS[folder] || "📁";
          const label = folder.charAt(0) + folder.slice(1).toLowerCase();

          return (
            <Box
              key={folder}
              style={{
                paddingX: 1,
                flexDirection: "row",
                bg: isSelected ? "white" : undefined,
              }}
            >
              <Text style={{ color: isSelected ? "black" : undefined }}>
                {icon} {label}
              </Text>
            </Box>
          );
        })}
      </Box>

      <ScopedKeybinds scope="moveToFolder" handlers={handlers} />
    </FocusScope>
  );
}
