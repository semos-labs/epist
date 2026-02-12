import React from "react";
import { Box, Text, Portal, Input, FocusScope } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { basename } from "path";
import {
  attachmentPickerOpenAtom,
  attachmentPickerResultsAtom,
  attachmentPickerSelectedIndexAtom,
  attachmentPickerSelectedFilesAtom,
} from "../state/atoms.ts";
import {
  closeAttachmentPickerAtom,
  updatePickerQueryAtom,
  movePickerSelectionAtom,
  togglePickerFileSelectionAtom,
  confirmPickerSelectionAtom,
} from "../state/actions.ts";
import { icons } from "./icons.ts";

const PICKER_WIDTH = 45;
const PICKER_HEIGHT = 14;

function formatLine(path: string, isMarked: boolean): string {
  const filename = basename(path);
  const mark = isMarked ? "●" : " ";
  return `${mark}   ${filename}`;
}

function FileList({
  visibleResults,
  scrollStart,
  selectedIndex,
  selectedFiles,
  listHeight,
}: {
  visibleResults: string[];
  scrollStart: number;
  selectedIndex: number;
  selectedFiles: Set<string>;
  listHeight: number;
}) {
  const selectedVi = selectedIndex - scrollStart;

  const beforeLines = visibleResults
    .slice(0, selectedVi)
    .map((p) => formatLine(p, selectedFiles.has(p)));

  const afterLines = visibleResults
    .slice(selectedVi + 1)
    .map((p) => formatLine(p, selectedFiles.has(p)));

  const selectedPath = visibleResults[selectedVi];
  const selectedMarked = selectedPath ? selectedFiles.has(selectedPath) : false;
  const selectedFilename = selectedPath ? basename(selectedPath) : "";
  const selectedMark = selectedMarked ? "●" : " ";

  return (
    <>
      {beforeLines.length > 0 && (
        <Box style={{ paddingX: 1, height: beforeLines.length }}>
          <Text wrap="truncate">{beforeLines.join("\n")}</Text>
        </Box>
      )}
      {selectedPath && (
        <Box style={{ flexDirection: "row", paddingX: 1, height: 1, bg: "white" }}>
          <Text style={{ color: selectedMarked ? "green" : "black" }}>{selectedMark} </Text>
          <Text style={{ color: "black" }} wrap="truncate">
            {"  " + selectedFilename}
          </Text>
        </Box>
      )}
      {afterLines.length > 0 && (
        <Box style={{ paddingX: 1, height: afterLines.length }}>
          <Text wrap="truncate">{afterLines.join("\n")}</Text>
        </Box>
      )}
    </>
  );
}

export function AttachmentPicker() {
  const isOpen = useAtomValue(attachmentPickerOpenAtom);
  const results = useAtomValue(attachmentPickerResultsAtom);
  const selectedIndex = useAtomValue(attachmentPickerSelectedIndexAtom);
  const selectedFiles = useAtomValue(attachmentPickerSelectedFilesAtom);

  const close = useSetAtom(closeAttachmentPickerAtom);
  const updateQuery = useSetAtom(updatePickerQueryAtom);
  const moveSelection = useSetAtom(movePickerSelectionAtom);
  const toggleSelection = useSetAtom(togglePickerFileSelectionAtom);
  const confirm = useSetAtom(confirmPickerSelectionAtom);

  const [query, setQuery] = React.useState("");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset query when picker opens
  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  // Clean up debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const listHeight = PICKER_HEIGHT - 4;

  // Manual windowing: compute which slice of results to show
  const scrollStart = Math.max(0, Math.min(
    selectedIndex - Math.floor(listHeight / 2),
    results.length - listHeight
  ));
  const visibleResults = results.slice(scrollStart, scrollStart + listHeight);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateQuery(value);
    }, 250);
  };

  // Handle special keys via onKeyPress — return true to consume, false to let Input handle
  const handleKeyPress = (key: { name?: string; ctrl?: boolean; shift?: boolean }) => {
    if (key.name === "escape") {
      close();
      return true;
    }
    if (key.name === "return") {
      confirm();
      return true;
    }
    if (key.name === "up" || (key.name === "k" && key.ctrl)) {
      moveSelection("up");
      return true;
    }
    if (key.name === "down" || (key.name === "j" && key.ctrl)) {
      moveSelection("down");
      return true;
    }
    if (key.name === "tab") {
      toggleSelection();
      moveSelection("down");
      return true;
    }
    // Let the Input handle all other keys (typing, backspace, etc.)
    return false;
  };

  return (
    <Portal zIndex={200}>
      <Box
        style={{
          position: "absolute",
          inset: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: PICKER_WIDTH,
            height: PICKER_HEIGHT,
            flexDirection: "column",
            bg: "black",
            clip: true,
          }}
        >
          <FocusScope trap>
            {/* Header */}
            <Box style={{ paddingX: 1, height: 1, flexDirection: "row" }}>
              <Text bold color="cyan">{icons.attachment} Attach Files</Text>
              <Box style={{ flexGrow: 1 }} />
              {selectedFiles.size > 0 && <Text color="green">{selectedFiles.size} selected</Text>}
            </Box>

            {/* Search input */}
            <Box style={{ paddingX: 1, height: 1, flexDirection: "row" }}>
              <Text dim>/ </Text>
              <Input
                value={query}
                onChange={handleQueryChange}
                placeholder="search files..."
                style={{ flexGrow: 1 }}
                autoFocus
                onKeyPress={handleKeyPress}
              />
            </Box>

            {/* File list — manually windowed */}
            <Box style={{ height: listHeight, clip: true }}>
              {results.length === 0 ? (
                <Box style={{ paddingX: 1 }}>
                  <Text dim>{query ? "No matches" : "No files found"}</Text>
                </Box>
              ) : (
                <FileList
                  visibleResults={visibleResults}
                  scrollStart={scrollStart}
                  selectedIndex={selectedIndex}
                  selectedFiles={selectedFiles}
                  listHeight={listHeight}
                />
              )}
            </Box>

            {/* Footer */}
            <Box style={{ paddingX: 1, height: 1, flexDirection: "row" }}>
              <Text dim>↑↓:nav Tab:mark Enter:add Esc:close</Text>
              <Box style={{ flexGrow: 1 }} />
              {results.length > 0 && <Text dim>{selectedIndex + 1}/{results.length}</Text>}
            </Box>
          </FocusScope>
        </Box>
      </Box>
    </Portal>
  );
}
