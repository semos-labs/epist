import React, { useMemo } from "react";
import { Box, Text, useApp, useMediaQuery, Portal, JumpNav, ScopedKeybinds } from "@semos-labs/glyph";
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
import { overlayStackAtom, currentLabelAtom, focusAtom, hasOverlayAtom, isReplyingAtom, folderSidebarOpenAtom, isLoggedInAtom, layoutModeAtom, type LayoutMode } from "../state/atoms.ts";
import { toggleFolderSidebarAtom, loadConfigAtom, checkAuthAtom } from "../state/actions.ts";
import { registry } from "../keybinds/registry.ts";
import { ErrorBoundary } from "./ErrorBoundary.tsx";

// ASCII art logo for the app
const LOGO = "EPIST";

// ── Layout mode hook — syncs useMediaQuery results to the layoutModeAtom ──

function useLayoutMode(): LayoutMode {
  const isWide = useMediaQuery({ minColumns: 130 });
  const isNotCompact = useMediaQuery({ minColumns: 80 });
  const setLayoutMode = useSetAtom(layoutModeAtom);

  const mode: LayoutMode = isWide ? "wide" : isNotCompact ? "narrow" : "compact";

  React.useEffect(() => {
    setLayoutMode(mode);
  }, [mode, setLayoutMode]);

  return mode;
}

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

function Header({ layoutMode }: { layoutMode: LayoutMode }) {
  const { columns: terminalWidth } = useApp();
  const label = useAtomValue(currentLabelAtom);
  const focus = useAtomValue(focusAtom);
  const folderSidebar = useAtomValue(folderSidebarOpenAtom);

  const labelDisplay = label.charAt(0) + label.slice(1).toLowerCase();
  const focusIndicator = focus === "list" ? "◀" : focus === "view" ? "▶" : "○";

  // ── Narrow / compact: single-pane header ──
  if (layoutMode !== "wide") {
    const paneLabel = focus === "view" ? "Email" : labelDisplay;
    return (
      <Box
        style={{
          flexDirection: "row",
          borderBottomWidth: 1,
          borderStyle: "single",
          borderColor: "gray",
          justifyContent: "space-between",
          paddingX: 1,
        }}
      >
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text style={{ bold: true, color: "cyan" }}>{LOGO}</Text>
          <Text style={{ bold: true }}>{paneLabel}</Text>
          <Text style={{ dim: true }}>{focusIndicator}</Text>
        </Box>
        <Text style={{ dim: true }}>
          {focus === "view" ? "Esc:back" : "j/k:nav ↵:open"} ?:help ::cmd
        </Text>
      </Box>
    );
  }

  // ── Wide: two-column header ──
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

// ── Inline folder sidebar (part of the row layout — wide & narrow modes) ──

function InlineFolderSidebar() {
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);
  if (!folderSidebarOpen) return null;
  return (
    <>
      <FolderSidebar />
      <VerticalDivider />
    </>
  );
}

// ── Floating folder sidebar (Portal overlay — compact mode) ──

function FloatingFolderSidebar() {
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);
  if (!folderSidebarOpen) return null;
  return (
    <Portal>
      <Box
        style={{
          width: "100%",
          height: "100%",
          flexDirection: "row",
        }}
      >
        <Box style={{ flexDirection: "column", bg: "black" }}>
          <FolderSidebar />
        </Box>
        {/* Dim overlay on the right side */}
        <Box style={{ flexGrow: 1 }} />
      </Box>
    </Portal>
  );
}

// ── Wide layout: two-column (list + divider + view) ──

function WideLayout() {
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);
  return (
    <Box
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexDirection: "row",
        clip: true,
      }}
    >
      {folderSidebarOpen && (
        <>
          <FolderSidebar />
          <VerticalDivider />
        </>
      )}
      <EmailList />
      <VerticalDivider />
      <EmailView />
    </Box>
  );
}

// ── Narrow / compact layout: single pane based on focus ──

function SinglePaneLayout({ layoutMode }: { layoutMode: LayoutMode }) {
  const focus = useAtomValue(focusAtom);
  const showView = focus === "view";

  return (
    <Box
      style={{
        flexGrow: 1,
        flexShrink: 1,
        flexDirection: "row",
        clip: true,
      }}
    >
      {/* Folder sidebar — inline for narrow, floating for compact */}
      {layoutMode === "narrow" && <InlineFolderSidebar />}
      {layoutMode === "compact" && <FloatingFolderSidebar />}

      {/* Show either the list or the view */}
      {showView ? <EmailView /> : <EmailList fullWidth />}
    </Box>
  );
}

function AppContent() {
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const loadConfig = useSetAtom(loadConfigAtom);
  const checkAuth = useSetAtom(checkAuthAtom);
  const layoutMode = useLayoutMode();

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
            <Header layoutMode={layoutMode} />

            {/* Main content: responsive layout */}
            {layoutMode === "wide" ? (
              <WideLayout />
            ) : (
              <SinglePaneLayout layoutMode={layoutMode} />
            )}

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
