import React, { useMemo } from "react";
import { Box, Text, ScrollView } from "@semos-labs/glyph";
import { useAtomValue, useAtom } from "jotai";
import { commandInputAtom, commandSelectedIndexAtom } from "../state/atoms.ts";
import { getAllCommands } from "../keybinds/registry.ts";

const PALETTE_WIDTH = 45;
const PALETTE_HEIGHT = 10;

interface CommandItemProps {
  name: string;
  description: string;
  isSelected: boolean;
}

function CommandItem({ name, description, isSelected }: CommandItemProps) {
  return (
    <Box
      style={{
        flexDirection: "row",
        paddingX: 1,
        bg: isSelected ? "white" : undefined,
      }}
    >
      <Text
        style={{
          color: isSelected ? "black" : "cyan",
          bold: isSelected,
          width: 12,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          color: isSelected ? "black" : undefined,
          dim: !isSelected,
        }}
        wrap="truncate"
      >
        {description}
      </Text>
    </Box>
  );
}

export function CommandPalette() {
  const input = useAtomValue(commandInputAtom);
  const [selectedIndex, setSelectedIndex] = useAtom(commandSelectedIndexAtom);

  // Get and filter commands
  const allCommands = useMemo(() => getAllCommands(), []);

  const filteredCommands = useMemo(() => {
    if (!input.trim()) return allCommands;

    const query = input.toLowerCase().trim();
    return allCommands.filter((cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description.toLowerCase().includes(query)
    );
  }, [allCommands, input]);

  // Reset selection when filter changes
  React.useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex, setSelectedIndex]);

  if (filteredCommands.length === 0) {
    return (
      <Box
        style={{
          position: "absolute",
          bottom: 1,
          left: 0,
          width: PALETTE_WIDTH,
          padding: 1,
        }}
      >
        <Text dim>No matching commands</Text>
      </Box>
    );
  }

  return (
    <Box
      style={{
        position: "absolute",
        bottom: 1,
        left: 0,
        width: PALETTE_WIDTH,
        height: Math.min(PALETTE_HEIGHT, filteredCommands.length + 1),
        flexDirection: "column",
        borderWidth: 1,
        borderStyle: "single",
        borderColor: "gray",
        bg: "black",
      }}
    >
      {/* Header */}
      <Box style={{ paddingX: 1, flexDirection: "row", justifyContent: "space-between" }}>
        <Text dim>
          Commands ({filteredCommands.length})
        </Text>
        <Text dim>↑↓ Tab:fill</Text>
      </Box>

      {/* Command list */}
      <Box style={{ height: Math.min(PALETTE_HEIGHT - 2, filteredCommands.length) }}>
        <ScrollView
          style={{ height: "100%" }}
          scrollOffset={Math.max(0, selectedIndex - 3)}
        >
          {filteredCommands.map((cmd, index) => (
            <CommandItem
              key={cmd.name}
              name={cmd.name}
              description={cmd.description}
              isSelected={index === selectedIndex}
            />
          ))}
        </ScrollView>
      </Box>
    </Box>
  );
}

// Get the currently selected command
export function getSelectedCommand(input: string, selectedIndex: number) {
  const allCommands = getAllCommands();
  
  const query = input.toLowerCase().trim();
  const filteredCommands = query
    ? allCommands.filter((cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      )
    : allCommands;

  return filteredCommands[selectedIndex] || null;
}
