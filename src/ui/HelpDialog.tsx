import React from "react";
import { Box, Text, Portal, ScrollView, Keybind } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { focusAtom, overlayStackAtom } from "../state/atoms.ts";
import { popOverlayAtom } from "../state/actions.ts";
import { getKeybindsForHelp, type KeybindDef } from "../keybinds/registry.ts";

const DIALOG_WIDTH = 50;
const DIALOG_HEIGHT = 20;

interface KeybindRowProps {
  keybind: KeybindDef;
}

function KeybindRow({ keybind }: KeybindRowProps) {
  return (
    <Box style={{ flexDirection: "row", paddingX: 1 }}>
      <Text style={{ width: 12, color: "cyan" }}>
        {keybind.display}
      </Text>
      <Text dim>{keybind.description}</Text>
    </Box>
  );
}

interface SectionProps {
  title: string;
  keybinds: KeybindDef[];
}

function Section({ title, keybinds }: SectionProps) {
  return (
    <Box style={{ flexDirection: "column", paddingBottom: 1 }}>
      <Text style={{ bold: true, paddingX: 1 }}>{title}</Text>
      {keybinds.map((kb, index) => (
        <KeybindRow key={`${kb.action}-${index}`} keybind={kb} />
      ))}
    </Box>
  );
}

export function HelpDialog() {
  const popOverlay = useSetAtom(popOverlayAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  
  // Get the previous focus context from the overlay
  const topOverlay = overlayStack[overlayStack.length - 1];
  const prevFocus = topOverlay?.prevFocus || "list";
  
  // Get keybinds for help
  const sections = getKeybindsForHelp(prevFocus);

  return (
    <Portal zIndex={50}>
      <Box
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: DIALOG_WIDTH,
          height: DIALOG_HEIGHT,
          flexDirection: "column",
          borderWidth: 1,
          borderStyle: "double",
          borderColor: "cyan",
        }}
      >
        {/* Header */}
        <Box
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingX: 1,
            borderBottomWidth: 1,
            borderStyle: "single",
            borderColor: "gray",
          }}
        >
          <Text style={{ bold: true, color: "cyan" }}>
            Keyboard Shortcuts
          </Text>
          <Text dim>Esc to close</Text>
        </Box>

        {/* Content */}
        <Box style={{ flexGrow: 1, flexDirection: "column" }}>
          <ScrollView style={{ height: "100%" }}>
            <Box style={{ flexDirection: "column", padding: 1 }}>
              {sections.map((section, index) => (
                <Section
                  key={section.title}
                  title={section.title}
                  keybinds={section.keybinds}
                />
              ))}
            </Box>
          </ScrollView>
        </Box>

        {/* Escape to close */}
        <Keybind keypress="escape" onPress={() => popOverlay()} />
        <Keybind keypress="?" onPress={() => popOverlay()} />
        <Keybind keypress="q" onPress={() => popOverlay()} />
      </Box>
    </Portal>
  );
}
