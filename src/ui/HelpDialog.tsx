import React, { useState, useMemo, useCallback } from "react";
import { Box, Text, Portal, ScrollView, Input } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { focusAtom, overlayStackAtom } from "../state/atoms.ts";
import { popOverlayAtom } from "../state/actions.ts";
import { getKeybindsForHelp, getAllCommands, type KeybindDef } from "../keybinds/registry.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import type { FocusContext } from "../state/atoms.ts";

const KEY_WIDTH = 14;
const PAGE_SIZE = 8;

function KeybindRow({ display, description }: { display: string; description: string }) {
  return (
    <Box style={{ flexDirection: "row", gap: 1, paddingX: 1 }}>
      <Text style={{ color: "cyan", width: KEY_WIDTH }}>{display}</Text>
      <Text>{description}</Text>
    </Box>
  );
}

function filterKeybinds(
  sections: { title: string; keybinds: KeybindDef[] }[],
  query: string
): { title: string; keybinds: KeybindDef[] }[] {
  if (!query.trim()) return sections;

  const lowerQuery = query.toLowerCase();

  return sections
    .map((section) => ({
      title: section.title,
      keybinds: section.keybinds.filter(
        (kb) =>
          kb.display.toLowerCase().includes(lowerQuery) ||
          kb.description.toLowerCase().includes(lowerQuery) ||
          kb.action.toLowerCase().includes(lowerQuery) ||
          (kb.command && kb.command.toLowerCase().includes(lowerQuery))
      ),
    }))
    .filter((section) => section.keybinds.length > 0);
}

export function HelpDialog() {
  const focus = useAtomValue(focusAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const [filter, setFilter] = useState("");
  const [scrollOffset, setScrollOffset] = useState(0);

  // Get the previous focus context (before help was opened)
  const helpOverlay = overlayStack.find((o) => o.kind === "help");
  const contextFocus = (helpOverlay?.prevFocus || focus) as FocusContext;

  // Get keybinds from registry
  const allSections = getKeybindsForHelp(contextFocus);

  // Filter sections based on search
  const sections = useMemo(
    () => filterKeybinds(allSections, filter),
    [allSections, filter]
  );

  // Get all commands and filter
  const allCommands = useMemo(() => getAllCommands(), []);
  const filteredCommands = useMemo(() => {
    if (!filter.trim()) return allCommands;
    const lowerQuery = filter.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [allCommands, filter]);

  const showCommands = contextFocus === "command" && !filter.trim();

  // Reset scroll when filter changes
  const handleFilterChange = useCallback((value: string) => {
    setFilter(value);
    setScrollOffset(0);
  }, []);

  // Scroll handlers + close — all use priority so they fire before Input
  const helpHandlers = useMemo(() => ({
    close: () => popOverlay(),
    scrollDown: () => setScrollOffset((o) => o + 1),
    scrollUp: () => setScrollOffset((o) => Math.max(0, o - 1)),
    pageDown: () => setScrollOffset((o) => o + PAGE_SIZE),
    pageUp: () => setScrollOffset((o) => Math.max(0, o - PAGE_SIZE)),
  }), [popOverlay]);

  return (
    <Portal zIndex={100}>
      <ScopedKeybinds scope="help" handlers={helpHandlers} priority />
      <Box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: 55,
            height: "80%",
            bg: "black",
            padding: 1,
            flexDirection: "column",
            borderWidth: 1,
            borderStyle: "round",
            borderColor: "cyan",
          } as any}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ color: "cyan", bold: true }}>
              ⌨ Shortcuts ({contextFocus})
            </Text>
            <Text dim>↑↓ scroll · Esc close</Text>
          </Box>

          {/* Filter input */}
          <Box style={{ paddingBottom: 1 }}>
            <Input
              placeholder="Search..."
              value={filter}
              onChange={handleFilterChange}
              autoFocus
              style={{
                bg: "blackBright",
              } as any}
            />
          </Box>

          {/* Content — manual scroll via scrollOffset + disableKeyboard */}
          <ScrollView
            style={{ flexGrow: 1, flexShrink: 1 } as any}
            scrollOffset={scrollOffset}
            onScroll={setScrollOffset}
            disableKeyboard
            focusable={false}
          >
            {sections.length === 0 && filteredCommands.length === 0 ? (
              <Text dim>No matches found</Text>
            ) : (
              <>
                {sections.map((section, i) => (
                  <Box key={i} style={{ flexDirection: "column", paddingBottom: 1 }}>
                    <Box style={{ paddingX: 1 }}>
                      <Text style={{ color: "yellow", bold: true }}>
                        {"▸ "}{section.title}
                      </Text>
                    </Box>
                    {section.keybinds.map((kb, j) => (
                      <KeybindRow key={j} display={kb.display} description={kb.description} />
                    ))}
                  </Box>
                ))}

                {/* Commands section */}
                {(showCommands || (filter.trim() && filteredCommands.length > 0)) && (
                  <Box style={{ flexDirection: "column", paddingBottom: 1 }}>
                    <Box style={{ paddingX: 1 }}>
                      <Text style={{ color: "yellow", bold: true }}>
                        {"▸ "}Commands
                      </Text>
                    </Box>
                    {filteredCommands.map((cmd, i) => (
                      <KeybindRow key={i} display={cmd.name} description={cmd.description} />
                    ))}
                  </Box>
                )}
              </>
            )}
          </ScrollView>
        </Box>
      </Box>
    </Portal>
  );
}
