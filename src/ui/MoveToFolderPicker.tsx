import React, { useState, useCallback, useMemo } from "react";
import { Box, Text, useApp, FocusScope } from "@semos-labs/glyph";
import { useSetAtom, useAtomValue } from "jotai";
import { moveToFolderAtom, popOverlayAtom } from "../state/actions.ts";
import { currentLabelAtom, userLabelsAtom, accountFilterAtom } from "../state/atoms.ts";
import { FOLDER_LABELS, getLabelDisplay, type LabelId } from "../domain/email.ts";
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
  const allUserLabels = useAtomValue(userLabelsAtom);
  const accountFilter = useAtomValue(accountFilterAtom);

  // Build folder list: system + custom labels, minus current
  const folders = useMemo(() => {
    const items: { id: LabelId; name: string; icon?: string; color?: string }[] = [];

    for (const label of FOLDER_LABELS) {
      if (label === currentLabel) continue;
      items.push({
        id: label,
        name: getLabelDisplay(label),
        icon: FOLDER_ICONS[label] || icons.folder,
      });
    }

    // Custom labels (dedup by name)
    const filtered = accountFilter
      ? allUserLabels.filter(l => l.accountEmail === accountFilter)
      : allUserLabels;
    const seen = new Set<string>();
    for (const label of filtered) {
      if (!seen.has(label.name) && label.id !== currentLabel) {
        seen.add(label.name);
        items.push({
          id: label.id,
          name: label.name,
          color: label.color,
        });
      }
    }

    return items;
  }, [currentLabel, allUserLabels, accountFilter]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handlers = useMemo(() => ({
    next: () => setSelectedIndex(i => Math.min(i + 1, folders.length - 1)),
    prev: () => setSelectedIndex(i => Math.max(i - 1, 0)),
    select: () => {
      const target = folders[selectedIndex];
      if (target) {
        moveToFolder(target.id);
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
          const isCustom = !FOLDER_ICONS[folder.id];

          return (
            <Box
              key={folder.id}
              style={{
                paddingX: 1,
                flexDirection: "row",
                bg: isSelected ? "white" : undefined,
              }}
            >
              {isCustom ? (
                <Text style={{ color: isSelected ? "black" : (folder.color || "white") }}>● </Text>
              ) : (
                <Text style={{ color: isSelected ? "black" : undefined }}>{folder.icon} </Text>
              )}
              <Text style={{ color: isSelected ? "black" : undefined }}>
                {folder.name}
              </Text>
            </Box>
          );
        })}
      </Box>

      <ScopedKeybinds scope="moveToFolder" handlers={handlers} />
    </FocusScope>
  );
}
