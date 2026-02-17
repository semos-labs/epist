import React, { useMemo } from "react";
import { Box, Text, useApp, JumpNav, ScopedKeybinds } from "@semos-labs/glyph";
import { Provider, useAtomValue, useSetAtom } from "jotai";
import { EmailList } from "./EmailList.tsx";
import { EmailView } from "./EmailView.tsx";
import { AppStatusBar } from "./StatusBar.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { ReplyView } from "./ReplyView.tsx";
import { AttachmentPicker } from "./AttachmentPicker.tsx";
import { FolderSidebar } from "./FolderSidebar.tsx";
import { MoveToFolderPicker } from "./MoveToFolderPicker.tsx";
import { AccountsDialog } from "./AccountsDialog.tsx";
import { ImapSetupDialog } from "./ImapSetupDialog.tsx";
import { WelcomeScreen } from "./WelcomeScreen.tsx";
import { overlayStackAtom, currentLabelAtom, focusAtom, hasOverlayAtom, isReplyingAtom, folderSidebarOpenAtom, isLoggedInAtom } from "../state/atoms.ts";
import { toggleFolderSidebarAtom, loadConfigAtom, checkAuthAtom } from "../state/actions.ts";
import { registry } from "../keybinds/registry.ts";
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
        <Text key={i} style={{ dim: true }}>│</Text>
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
          case "moveToFolder":
            return <MoveToFolderPicker key={`move-${index}`} />;
          case "accounts":
            return <AccountsDialog key={`accounts-${index}`} />;
          case "addAccount":
            return <ImapSetupDialog key={`add-account-${index}`} />;
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
  const folderSidebar = useAtomValue(folderSidebarOpenAtom);

  const labelDisplay = label.charAt(0) + label.slice(1).toLowerCase();
  const focusIndicator = focus === "list" ? "◀" : focus === "view" ? "▶" : "○";

  // Match the list width calculation from EmailList
  const listWidth = Math.min(60, Math.max(30, Math.floor(terminalWidth * 0.4)));
  // Account for folder sidebar (22 chars) + its divider (1 char)
  const sidebarWidth = folderSidebar ? 22 + 1 : 0;

  return (
    <Box
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderStyle: "single",
        borderColor: "gray",
      }}
    >
      {/* Left section: matches folder sidebar + email list width */}
      <Box style={{ width: sidebarWidth + listWidth, flexDirection: "row", paddingX: 1 }}>
        <Text style={{ bold: true, color: "cyan" }}>{LOGO}</Text>
        <Text>  </Text>
        <Text style={{ bold: true }}>{labelDisplay}</Text>
        <Text style={{ dim: true }}> {focusIndicator}</Text>
      </Box>

      {/* Divider */}
      <Text style={{ dim: true }}>│</Text>

      {/* Right section */}
      <Box style={{ flexGrow: 1, flexDirection: "row", justifyContent: "space-between", paddingX: 1 }}>
        <Text style={{ dim: true }}>Email</Text>
        <Text style={{ dim: true }}>j/k:nav  Tab:switch  ?:help  ::cmd</Text>
      </Box>
    </Box>
  );
}

// Global keybinds — only active when not in reply/overlay modes
// Note: command (:) and search (/) are handled by glyph's StatusBar
function GlobalKeybinds() {
  const { exit } = useApp();
  const focus = useAtomValue(focusAtom);
  const hasOverlay = useAtomValue(hasOverlayAtom);
  const isReplying = useAtomValue(isReplyingAtom);
  const toggleFolderSidebar = useSetAtom(toggleFolderSidebarAtom);

  const canQuit = focus !== "search" && focus !== "reply" && focus !== "folders" && !hasOverlay && !isReplying;

  const handlers = useMemo(() => ({
    quit: canQuit ? () => exit() : undefined,
    toggleFolderSidebar: () => toggleFolderSidebar(),
  }), [canQuit, exit, toggleFolderSidebar]);

  return <ScopedKeybinds registry={registry} scope="global" handlers={handlers} />;
}

function AppContent() {
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const loadConfig = useSetAtom(loadConfigAtom);
  const checkAuth = useSetAtom(checkAuthAtom);

  // Load config first, then check auth (checkAuth reads configAtom for IMAP accounts)
  React.useEffect(() => {
    loadConfig().then(() => checkAuth());
  }, []);

  return (
    <AppStatusBar>
      <Box
        style={{
          width: "100%",
          flexGrow: 1,
          flexDirection: "column",
        }}
      >
        {isLoggedIn ? (
          <>
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

            {/* Global keybinds */}
            <GlobalKeybinds />

            {/* Reply view (modal) */}
            <ReplyView />

            {/* Attachment picker (overlays reply view) */}
            <AttachmentPicker />
          </>
        ) : (
          <WelcomeScreen />
        )}

        <OverlayRenderer />
      </Box>
    </AppStatusBar>
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
