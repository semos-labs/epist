import React, { useCallback } from "react";
import { Box, Text, useApp, Keybind } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { focusAtom, isAuthLoadingAtom } from "../state/atoms.ts";
import { loginAtom, openHelpAtom, openAddAccountDialogAtom } from "../state/actions.ts";

const LOGO_ART = [
  "┌─────────────────────────────────────┐",
  "│                                     │",
  "│   ╔═╗╔═╗╦╔═╗╔╦╗                    │",
  "│   ║╣ ╠═╝║╚═╗ ║                     │",
  "│   ╚═╝╩  ╩╚═╝ ╩                     │",
  "│                                     │",
  "│   Your email. In the terminal.      │",
  "│                                     │",
  "└─────────────────────────────────────┘",
];

export function WelcomeScreen() {
  const { rows, exit } = useApp();
  const focus = useAtomValue(focusAtom);
  const isLoading = useAtomValue(isAuthLoadingAtom);
  const login = useSetAtom(loginAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const addAccount = useSetAtom(openAddAccountDialogAtom);

  const handleLogin = useCallback(() => {
    if (!isLoading) login();
  }, [isLoading, login]);

  // Center vertically
  const contentHeight = LOGO_ART.length + 12;
  const topPad = Math.max(0, Math.floor((rows - contentHeight) / 2));

  // Only handle keys when not in command/search mode
  const canHandleKeys = focus === "list" || focus === "view";

  return (
    <Box
      style={{
        width: "100%",
        height: "100%",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: topPad,
      }}
    >
      {/* Keybinds */}
      {canHandleKeys && (
        <>
          <Keybind keypress="return" onPress={handleLogin} />
          <Keybind keypress="i" onPress={() => addAccount()} />
          <Keybind keypress="?" onPress={() => openHelp()} />
          <Keybind keypress="q" onPress={() => exit()} />
        </>
      )}

      {/* Logo */}
      <Box style={{ flexDirection: "column", alignItems: "center" }}>
        {LOGO_ART.map((line, i) => (
          <Text key={i} style={{ color: "cyan" }}>{line}</Text>
        ))}
      </Box>

      <Box style={{ height: 2 }} />

      {/* Status */}
      {isLoading ? (
        <Text style={{ color: "yellow" }}>⟳ Signing in with Google…</Text>
      ) : (
        <Box style={{ flexDirection: "column", alignItems: "center" }}>
          <Text>No accounts connected.</Text>
          <Box style={{ height: 1 }} />
          <Text style={{ color: "cyan", bold: true }}>
            Press  Enter  to sign in with Google
          </Text>
          <Text style={{ color: "blue", bold: true }}>
            Press  i  to add an IMAP/SMTP account
          </Text>
          <Box style={{ height: 1 }} />
          <Text style={{ dim: true }}>or run  :add-account  /  :login  from the command bar</Text>
        </Box>
      )}

      <Box style={{ height: 2 }} />

      {/* Hints */}
      <Box style={{ flexDirection: "column", alignItems: "center" }}>
        <Text style={{ dim: true }}>───────────────────────────────</Text>
        <Box style={{ height: 1 }} />
        <Text style={{ dim: true }}>  i  add IMAP/SMTP account</Text>
        <Text style={{ dim: true }}>  :  open command bar</Text>
        <Text style={{ dim: true }}>  ?  show help</Text>
        <Text style={{ dim: true }}>  q  quit</Text>
      </Box>
    </Box>
  );
}
