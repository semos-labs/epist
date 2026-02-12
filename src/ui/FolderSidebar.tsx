import React, { useCallback } from "react";
import { Box, Text, ScrollView, Keybind, FocusScope } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  folderSidebarOpenAtom,
  selectedFolderIndexAtom,
  currentLabelAtom,
  labelCountsAtom,
} from "../state/atoms.ts";
import {
  toggleFolderSidebarAtom,
  moveFolderSelectionAtom,
  selectFolderAtom,
} from "../state/actions.ts";
import { FOLDER_LABELS, getLabelDisplay } from "../domain/email.ts";
import { icons } from "./icons.ts";

const FOLDER_ICONS: Record<string, string> = {
  INBOX: icons.inbox,
  SENT: icons.sent,
  DRAFT: icons.drafts,
  TRASH: icons.trash,
  SPAM: icons.folder,
  STARRED: icons.star,
  IMPORTANT: icons.folder,
};

export function FolderSidebar() {
  const open = useAtomValue(folderSidebarOpenAtom);
  const selectedIndex = useAtomValue(selectedFolderIndexAtom);
  const currentLabel = useAtomValue(currentLabelAtom);
  const counts = useAtomValue(labelCountsAtom);
  const toggle = useSetAtom(toggleFolderSidebarAtom);
  const move = useSetAtom(moveFolderSelectionAtom);
  const select = useSetAtom(selectFolderAtom);

  const moveDown = useCallback(() => move("down"), [move]);
  const moveUp = useCallback(() => move("up"), [move]);
  const handleSelect = useCallback(() => select(), [select]);
  const handleToggle = useCallback(() => toggle(), [toggle]);

  if (!open) return null;

  return (
    <FocusScope trap>
      <Box style={{ width: 22, flexDirection: "column", height: "100%" }}>
        <Keybind keypress="j" onPress={moveDown} />
        <Keybind keypress="down" onPress={moveDown} />
        <Keybind keypress="k" onPress={moveUp} />
        <Keybind keypress="up" onPress={moveUp} />
        <Keybind keypress="return" onPress={handleSelect} />
        <Keybind keypress="space" onPress={handleSelect} />
        <Keybind keypress="escape" onPress={handleToggle} />
        <Keybind keypress="ctrl+f" onPress={handleToggle} />

        <Box style={{ paddingX: 1, borderBottomWidth: 1, borderStyle: "single", borderColor: "gray" }}>
          <Text style={{ bold: true }}>Folders</Text>
        </Box>
        <ScrollView style={{ flexGrow: 1 }} focusable={false} disableKeyboard>
          {FOLDER_LABELS.map((label, index) => {
            const isSelected = index === selectedIndex;
            const isCurrent = label === currentLabel;
            const count = counts[label];
            const unread = count?.unread || 0;
            const icon = FOLDER_ICONS[label] || icons.folder;

            return (
              <Box
                key={label}
                style={{
                  flexDirection: "row",
                  paddingX: 1,
                  bg: isSelected ? "white" : undefined,
                }}
              >
                <Text dim={!isSelected && !isCurrent}>{icon} </Text>
                <Text style={{ bold: isCurrent, flexGrow: 1 }}>
                  {getLabelDisplay(label)}
                </Text>
                {unread > 0 && (
                  <Text style={{ bold: true }}>{unread}</Text>
                )}
              </Box>
            );
          })}
        </ScrollView>
        <Box style={{ paddingX: 1 }}>
          <Text dim>j/k:nav ↵:open Esc:close</Text>
        </Box>
      </Box>
    </FocusScope>
  );
}
