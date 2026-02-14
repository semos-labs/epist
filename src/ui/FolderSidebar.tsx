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
  userLabelsAtom,
  categoriesExpandedAtom,
} from "../state/atoms.ts";
import {
  toggleFolderSidebarAtom,
  changeLabelAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import {
  FOLDER_LABELS,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  getLabelDisplay,
  type LabelId,
  type CategoryLabel,
} from "../domain/email.ts";
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

// Sentinel item type for the categories toggle row (not a real label)
const CATEGORIES_TOGGLE_ID = "__categories_toggle__";

type SidebarItem =
  | { type: "system"; id: LabelId; name: string; icon: string }
  | { type: "categoriesToggle"; id: typeof CATEGORIES_TOGGLE_ID; expanded: boolean }
  | { type: "category"; id: CategoryLabel; name: string; icon: string }
  | { type: "custom"; id: LabelId; name: string; color?: string };

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
  const allUserLabels = useAtomValue(userLabelsAtom);
  const categoriesExpanded = useAtomValue(categoriesExpandedAtom);
  const setCategoriesExpanded = useSetAtom(categoriesExpandedAtom);

  // Merge custom labels across accounts for "All Inboxes" mode,
  // or filter to single account. Dedup by label name.
  const customLabels = useMemo(() => {
    const filtered = accountFilter
      ? allUserLabels.filter(l => l.accountEmail === accountFilter)
      : allUserLabels;

    // Dedup by name — take first occurrence (keeps color from first account)
    const seen = new Map<string, typeof filtered[0]>();
    for (const label of filtered) {
      if (!seen.has(label.name)) {
        seen.set(label.name, label);
      }
    }

    // Sort alphabetically
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [allUserLabels, accountFilter]);

  // Build the flat list of items for rendering + navigation
  const allItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [];

    // System labels
    for (const label of FOLDER_LABELS) {
      items.push({
        type: "system",
        id: label,
        name: getLabelDisplay(label),
        icon: FOLDER_ICONS[label] || icons.folder,
      });
    }

    // Categories toggle button (always present)
    items.push({
      type: "categoriesToggle",
      id: CATEGORIES_TOGGLE_ID,
      expanded: categoriesExpanded,
    });

    // Category items (only when expanded)
    if (categoriesExpanded) {
      for (const cat of CATEGORY_LABELS) {
        items.push({
          type: "category",
          id: cat,
          name: getLabelDisplay(cat),
          icon: CATEGORY_ICONS[cat],
        });
      }
    }

    // Custom labels
    for (const label of customLabels) {
      items.push({
        type: "custom",
        id: label.id,
        name: label.name,
        color: label.color,
      });
    }

    return items;
  }, [customLabels, categoriesExpanded]);

  const buttonRefs = useRef<Array<{ focus: () => void } | null>>([]);
  const focusedIndex = useRef(0);

  const moveFocus = useCallback((dir: "up" | "down") => {
    const next = dir === "down"
      ? Math.min(focusedIndex.current + 1, allItems.length - 1)
      : Math.max(focusedIndex.current - 1, 0);
    focusedIndex.current = next;
    buttonRefs.current[next]?.focus();
  }, [allItems.length]);

  // Check if currently focused item is the categories toggle
  const isFocusedOnToggle = useCallback(() => {
    const item = allItems[focusedIndex.current];
    return item?.type === "categoriesToggle";
  }, [allItems]);

  const handleToggleCategories = useCallback(() => {
    if (isFocusedOnToggle()) {
      setCategoriesExpanded(prev => !prev);
    }
  }, [isFocusedOnToggle, setCategoriesExpanded]);

  const handleCollapseCategories = useCallback(() => {
    if (isFocusedOnToggle()) {
      setCategoriesExpanded(false);
    }
  }, [isFocusedOnToggle, setCategoriesExpanded]);

  const handlers = useMemo(() => ({
    nextFolder: () => moveFocus("down"),
    prevFolder: () => moveFocus("up"),
    closeSidebar: () => toggle(),
    toggleCategories: handleToggleCategories,
    collapseCategories: handleCollapseCategories,
  }), [moveFocus, toggle, handleToggleCategories, handleCollapseCategories]);

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

  const handleFolderSelect = useCallback((labelId: LabelId) => {
    changeLabel(labelId);
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
          {allItems.map((item, index) => {
            // Separator before categories toggle
            if (item.type === "categoriesToggle") {
              return (
                <React.Fragment key={CATEGORIES_TOGGLE_ID}>
                  <Box style={{ paddingX: 1 }}>
                    <Text dim>{'─'.repeat(18)}</Text>
                  </Box>
                  <Button
                    ref={(el: any) => { buttonRefs.current[index] = el; }}
                    onPress={() => setCategoriesExpanded(prev => !prev)}
                    style={{
                      flexDirection: "row",
                      paddingX: 1,
                      border: "none",
                    } as any}
                    focusedStyle={{ bg: "white" } as any}
                  >
                    <Text dim>{item.expanded ? "▾" : "▸"} </Text>
                    <Text dim style={{ flexGrow: 1 }}>Categories</Text>
                    <Text dim>{item.expanded ? "←" : "→"}</Text>
                  </Button>
                </React.Fragment>
              );
            }

            // Separator before first custom label (after categories section)
            const prevItem = index > 0 ? allItems[index - 1] : null;
            const needsSeparator = item.type === "custom" &&
              prevItem != null &&
              prevItem.type !== "custom";

            return (
              <React.Fragment key={`${item.id}-${index}`}>
                {needsSeparator && (
                  <Box style={{ paddingX: 1 }}>
                    <Text dim>{'─'.repeat(18)}</Text>
                  </Box>
                )}
                <SidebarItemButton
                  item={item}
                  index={index}
                  isCurrent={item.id === currentLabel}
                  counts={counts}
                  buttonRefs={buttonRefs}
                  onSelect={handleFolderSelect}
                />
              </React.Fragment>
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
          <Text dim>↑↓:nav Space/→:expand ↵:open Esc:close</Text>
        </Box>
      </Box>
    </FocusScope>
  );
}

// Individual sidebar item button (system folder, category, or custom label)
function SidebarItemButton({
  item,
  index,
  isCurrent,
  counts,
  buttonRefs,
  onSelect,
}: {
  item: SidebarItem;
  index: number;
  isCurrent: boolean;
  counts: Record<string, { total: number; unread: number }>;
  buttonRefs: React.MutableRefObject<Array<{ focus: () => void } | null>>;
  onSelect: (id: LabelId) => void;
}) {
  if (item.type === "categoriesToggle") return null;

  const count = counts[item.id];
  const unread = count?.unread || 0;

  return (
    <Button
      ref={(el: any) => { buttonRefs.current[index] = el; }}
      onPress={() => onSelect(item.id)}
      style={{
        flexDirection: "row",
        paddingX: 1,
        paddingLeft: item.type === "category" ? 3 : 1,
        border: "none",
      } as any}
      focusedStyle={{ bg: "white" } as any}
    >
      {item.type === "system" ? (
        <Text dim={!isCurrent}>{item.icon} </Text>
      ) : item.type === "category" ? (
        <Text dim={!isCurrent}>{item.icon} </Text>
      ) : (
        <Text style={{ color: item.color || "white" }}>● </Text>
      )}
      <Text style={{ bold: isCurrent, flexGrow: 1 }}>
        {item.name}
      </Text>
      {unread > 0 && (
        <Text style={{ bold: true }}>{unread}</Text>
      )}
    </Button>
  );
}
