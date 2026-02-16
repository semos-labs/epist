import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Box, Text, Input, ScrollView, useApp, FocusScope } from "@semos-labs/glyph";
import { useSetAtom, useAtomValue } from "jotai";
import { moveToFolderAtom, popOverlayAtom } from "../state/actions.ts";
import { currentLabelAtom, userLabelsAtom, accountFilterAtom } from "../state/atoms.ts";
import { FOLDER_LABELS, getLabelDisplay, type LabelId } from "../domain/email.ts";
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

const MAX_VISIBLE = 12;
const BOX_WIDTH = 30;

export function MoveToFolderPicker() {
  const { rows, columns } = useApp();
  const currentLabel = useAtomValue(currentLabelAtom);
  const moveToFolder = useSetAtom(moveToFolderAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const allUserLabels = useAtomValue(userLabelsAtom);
  const accountFilter = useAtomValue(accountFilterAtom);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build full folder list: system + custom labels, minus current
  const allFolders = useMemo(() => {
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

  // Filter by search query
  const folders = useMemo(() => {
    if (!query.trim()) return allFolders;
    const q = query.toLowerCase().trim();
    return allFolders.filter(f => f.name.toLowerCase().includes(q));
  }, [allFolders, query]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyPress = useCallback((key: { name: string; ctrl?: boolean; shift?: boolean; sequence?: string }) => {
    const isCtrlP = key.sequence === "\x10";
    const isCtrlN = key.sequence === "\x0e";

    if (key.name === "escape") {
      popOverlay();
      return true;
    }
    if (key.name === "return") {
      const target = folders[selectedIndex];
      if (target) {
        moveToFolder(target.id);
        popOverlay();
      }
      return true;
    }
    if (key.name === "up" || isCtrlP) {
      setSelectedIndex(i => Math.max(0, i - 1));
      return true;
    }
    if (key.name === "down" || isCtrlN) {
      setSelectedIndex(i => Math.min(folders.length - 1, i + 1));
      return true;
    }
    return false;
  }, [folders, selectedIndex, moveToFolder, popOverlay]);

  // Sizing & positioning
  const listHeight = Math.min(MAX_VISIBLE, folders.length);
  // +1 for the input row
  const boxHeight = listHeight + 1;
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));
  const left = Math.max(0, Math.floor((columns - BOX_WIDTH) / 2));

  // Keep selection in scroll view
  const scrollOffset = Math.max(0, selectedIndex - Math.floor(listHeight / 2));

  return (
    <FocusScope trap>
      <Box
        style={{
          position: "absolute",
          top,
          left,
          width: BOX_WIDTH,
          flexDirection: "column",
          bg: "black",
        } as any}
      >
        {/* Search input */}
        <Box style={{ flexDirection: "row", alignItems: "center", paddingX: 1 }}>
          <Text style={{ color: "cyan" }}>{icons.search || "/"} </Text>
          <Input
            value={query}
            placeholder="Filter…"
            onChange={setQuery}
            onKeyPress={handleKeyPress}
            autoFocus
            style={{ flexGrow: 1 }}
          />
        </Box>

        {/* Folder list */}
        {folders.length === 0 ? (
          <Box style={{ paddingX: 1 }}>
            <Text dim>No matching folders</Text>
          </Box>
        ) : (
          <Box style={{ height: listHeight }}>
            <ScrollView
              style={{ height: "100%" }}
              scrollOffset={scrollOffset}
            >
              {folders.map((folder, index) => {
                const isSelected = index === selectedIndex;
                const isCustom = !FOLDER_ICONS[folder.id];

                return (
                  <Box
                    key={`${folder.id}-${folder.name}`}
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
            </ScrollView>
          </Box>
        )}
      </Box>
    </FocusScope>
  );
}
