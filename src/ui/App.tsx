import React from "react";
import { Box, Text, useApp, Keybind, JumpNav } from "@nick-skriabin/glyph";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { EmailList } from "./EmailList.tsx";
import { EmailView } from "./EmailView.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { ReplyView } from "./ReplyView.tsx";
import { AttachmentPicker } from "./AttachmentPicker.tsx";
import { FolderSidebar } from "./FolderSidebar.tsx";
import { overlayStackAtom, currentLabelAtom, focusAtom, hasOverlayAtom, isReplyingAtom, folderSidebarOpenAtom } from "../state/atoms.ts";
import { toggleFolderSidebarAtom } from "../state/actions.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

// ASCII art logo for the app
const LOGO = "EPIST";

// Vertical divider component
function VerticalDivider() {
  const { rows } = useApp();
  // Fill the available height with │ characters
  const height = rows - 2; // Subtract header and status bar

  return (
    <Box style={{ width: 1, height: "100%", flexDirection: "column" }}>
      {Array.from({ length: height }, (_, i) => (
        <Text key={i} dim>│</Text>
      ))}
    </Box>
  );
}

// Render overlays from stack
function OverlayRenderer() {
  const overlayStack = useAtomValue(overlayStackAtom);

  return (
    <>
      {overlayStack.map((overlay, index) => {
        switch (overlay.kind) {
          case "help":
            return <HelpDialog key={`help-${index}`} />;
          default:
            return null;
        }
      })}
    </>
  );
}

function Header() {
  const { columns: terminalWidth } = useApp();
  const label = useAtomValue(currentLabelAtom);
  const focus = useAtomValue(focusAtom);

  const labelDisplay = label.charAt(0) + label.slice(1).toLowerCase();
  const focusIndicator = focus === "list" ? "◀" : focus === "view" ? "▶" : "○";

  // Match the list width calculation from EmailList
  const listWidth = Math.min(60, Math.max(30, Math.floor(terminalWidth * 0.4)));

  return (
    <Box
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderStyle: "single",
        borderColor: "gray",
      }}
    >
      {/* Left section: matches email list width */}
      <Box style={{ width: listWidth, flexDirection: "row", paddingX: 1 }}>
        <Text style={{ bold: true, color: "cyan" }}>{LOGO}</Text>
        <Text>  </Text>
        <Text style={{ bold: true }}>{labelDisplay}</Text>
        <Text dim> {focusIndicator}</Text>
      </Box>

      {/* Divider */}
      <Text dim>│</Text>

      {/* Right section */}
      <Box style={{ flexGrow: 1, flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <Text dim>Email</Text>
        <Text dim>j/k:nav  Tab:switch  ?:help  ::cmd</Text>
      </Box>
    </Box>
  );
}

// Global keybinds that should only work when not in command/search/reply mode
function GlobalKeybinds() {
  const { exit } = useApp();
  const focus = useAtomValue(focusAtom);
  const hasOverlay = useAtomValue(hasOverlayAtom);
  const isReplying = useAtomValue(isReplyingAtom);
  const toggleFolderSidebar = useSetAtom(toggleFolderSidebarAtom);

  // Only allow quit when not in command/search/reply/folders mode and no overlays
  const canQuit = focus !== "command" && focus !== "search" && focus !== "reply" && focus !== "folders" && !hasOverlay && !isReplying;

  return (
    <>
      {canQuit && <Keybind keypress="q" onPress={() => exit()} />}
      {canQuit && <Keybind keypress="ctrl+c" onPress={() => exit()} />}
      <Keybind keypress="ctrl+f" onPress={() => toggleFolderSidebar()} />
    </>
  );
}

function AppContent() {
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);

  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <Header />

      {/* Main content: two-column layout */}
      <Box
        style={{
          flexGrow: 1,
          flexShrink: 1,
          flexDirection: "row",
          clip: true,
        }}
      >
        {/* Folder sidebar (hidden by default, Ctrl+F to toggle) */}
        {folderSidebarOpen && (
          <>
            <FolderSidebar />
            <VerticalDivider />
          </>
        )}

        {/* Left: Email list sidebar */}
        <EmailList />

        {/* Vertical divider */}
        <VerticalDivider />

        {/* Right: Email view panel */}
        <EmailView />
      </Box>

      {/* Status bar */}
      <StatusBar />

      {/* Global keybinds */}
      <GlobalKeybinds />

      {/* Overlays */}
      <OverlayRenderer />

      {/* Reply view (modal) */}
      <ReplyView />

      {/* Attachment picker (overlays reply view) */}
      <AttachmentPicker />
    </Box>
  );
}

export function App() {
  return (
    <Provider>
      <ErrorBoundary>
        <JumpNav activationKey="ctrl+o">
          <AppContent />
        </JumpNav>
      </ErrorBoundary>
    </Provider>
  );
}
