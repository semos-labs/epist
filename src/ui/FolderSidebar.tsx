import React, { useCallback, useMemo, useRef } from "react";
import { Box, Text, Button, FocusScope, Select } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  folderSidebarOpenAtom,
  currentLabelAtom,
  labelCountsAtom,
  accountsAtom,
  accountFilterAtom,
  focusAtom,
} from "../state/atoms.ts";
import {
  toggleFolderSidebarAtom,
  changeLabelAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import { FOLDER_LABELS, getLabelDisplay, type FolderLabel } from "../domain/email.ts";
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
  const currentLabel = useAtomValue(currentLabelAtom);
  const counts = useAtomValue(labelCountsAtom);
  const accounts = useAtomValue(accountsAtom);
  const accountFilter = useAtomValue(accountFilterAtom);
  const setAccountFilter = useSetAtom(accountFilterAtom);
  const toggle = useSetAtom(toggleFolderSidebarAtom);
  const changeLabel = useSetAtom(changeLabelAtom);
  const setFocus = useSetAtom(focusAtom);
  const setOpen = useSetAtom(folderSidebarOpenAtom);

  const buttonRefs = useRef<Array<{ focus: () => void } | null>>([]);
  const focusedIndex = useRef(0);

  const moveFocus = useCallback((dir: "up" | "down") => {
    const next = dir === "down"
      ? Math.min(focusedIndex.current + 1, FOLDER_LABELS.length - 1)
      : Math.max(focusedIndex.current - 1, 0);
    focusedIndex.current = next;
    buttonRefs.current[next]?.focus();
  }, []);

  const handlers = useMemo(() => ({
    nextFolder: () => moveFocus("down"),
    prevFolder: () => moveFocus("up"),
    closeSidebar: () => toggle(),
  }), [moveFocus, toggle]);

  const accountItems = useMemo(() => {
    const items = [{ label: `${icons.inbox} All Inboxes`, value: "__all__" }];
    for (const acc of accounts) {
      items.push({ label: `${icons.people} ${acc.name}`, value: acc.email });
    }
    return items;
  }, [accounts]);

  const handleAccountChange = useCallback((value: string) => {
    setAccountFilter(value === "__all__" ? null : value);
  }, [setAccountFilter]);

  const handleFolderSelect = useCallback((label: FolderLabel) => {
    changeLabel(label);
    setOpen(false);
    setFocus("list");
  }, [changeLabel, setOpen, setFocus]);

  if (!open) return null;

  const hasMultipleAccounts = accounts.length > 1;

  return (
    <FocusScope trap>
      <Box style={{ width: 22, flexDirection: "column", height: "100%" }}>
        <ScopedKeybinds scope="folders" handlers={handlers} />

        <Box style={{ paddingX: 1, borderBottomWidth: 1, borderStyle: "single", borderColor: "gray" }}>
          <Text style={{ bold: true }}>Folders</Text>
        </Box>

        <Box style={{ flexDirection: "column", flexGrow: 1 }}>
          {FOLDER_LABELS.map((label, index) => {
            const isCurrent = label === currentLabel;
            const count = counts[label as keyof typeof counts];
            const unread = count?.unread || 0;
            const icon = FOLDER_ICONS[label] || icons.folder;

            return (
              <Button
                key={label}
                ref={(el: any) => { buttonRefs.current[index] = el; }}
                onPress={() => handleFolderSelect(label)}
                style={{
                  flexDirection: "row",
                  paddingX: 1,
                  border: "none",
                } as any}
                focusedStyle={{ bg: "white" } as any}
              >
                <Text dim={!isCurrent}>{icon} </Text>
                <Text style={{ bold: isCurrent, flexGrow: 1 }}>
                  {getLabelDisplay(label)}
                </Text>
                {unread > 0 && (
                  <Text style={{ bold: true }}>{unread}</Text>
                )}
              </Button>
            );
          })}
        </Box>

        {/* Account selector */}
        {hasMultipleAccounts && (
          <Box style={{ paddingX: 1, borderTopWidth: 1, borderStyle: "single", borderColor: "gray" }}>
            <Select
              items={accountItems}
              value={accountFilter ?? "__all__"}
              onChange={handleAccountChange}
              style={{ width: 20, border: "none" } as any}
              dropdownStyle={{ border: "none" } as any}
              focusedStyle={{ bg: "blackBright" }}
              highlightColor="cyan"
              maxVisible={accounts.length + 1}
              searchable={false}
            />
          </Box>
        )}

        <Box style={{ paddingX: 1 }}>
          <Text dim>↑↓/jk:nav Tab ↵:open Esc:close</Text>
        </Box>
      </Box>
    </FocusScope>
  );
}
