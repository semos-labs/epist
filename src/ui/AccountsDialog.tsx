/**
 * Accounts Dialog — Manage connected Google accounts
 * - View all accounts
 * - Set custom display names (local-only)
 * - Set primary/default account
 * - Remove accounts (logout)
 * - See granted permissions
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, Text, Input, Portal, useInput } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { googleAccountsAtom } from "../state/atoms.ts";
import { popOverlayAtom, showMessageAtom, syncEmailsAtom } from "../state/actions.ts";
import {
  loadAccountSettings,
  setCustomAccountName,
  removeAccountSettings,
} from "../config/accountSettings.ts";
import {
  getDefaultAccount,
  setDefaultAccount,
  removeAccount,
  getAccounts,
  hasGmailAccess,
  hasCalendarAccess,
  hasContactsAccess,
} from "../auth/index.ts";

const DIALOG_WIDTH = 65;
const SIDEBAR_WIDTH = 22;

export function AccountsDialog() {
  const accounts = useAtomValue(googleAccountsAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);
  const sync = useSetAtom(syncEmailsAtom);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [defaultEmail, setDefaultEmail] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, { gmail: boolean; calendar: boolean; contacts: boolean }>>({});

  // Load settings & permissions on mount
  useEffect(() => {
    async function load() {
      const settings = await loadAccountSettings();
      setCustomNames(settings.customNames);

      const def = await getDefaultAccount();
      setDefaultEmail(def?.account.email || null);

      // Check permissions per account
      const accts = await getAccounts();
      const perms: Record<string, { gmail: boolean; calendar: boolean; contacts: boolean }> = {};
      for (const a of accts) {
        perms[a.account.email] = {
          gmail: hasGmailAccess(a),
          calendar: hasCalendarAccess(a),
          contacts: hasContactsAccess(a),
        };
      }
      setPermissions(perms);
    }
    load();
  }, []);

  const selectedAccount = accounts[selectedIndex];

  const handleClose = useCallback(() => {
    popOverlay();
  }, [popOverlay]);

  const handleSetPrimary = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      await setDefaultAccount(selectedAccount.email);
      setDefaultEmail(selectedAccount.email);
      showMessage({ text: `${selectedAccount.email} is now primary`, type: "success" });
    } catch {
      showMessage({ text: "Failed to set primary account", type: "error" });
    }
  }, [selectedAccount, showMessage]);

  const handleStartEditName = useCallback(() => {
    if (!selectedAccount) return;
    setNameInput(customNames[selectedAccount.email] || "");
    setEditingName(true);
  }, [selectedAccount, customNames]);

  const handleSaveName = useCallback(async () => {
    if (!selectedAccount) return;
    await setCustomAccountName(selectedAccount.email, nameInput);
    setCustomNames(prev => ({
      ...prev,
      [selectedAccount.email]: nameInput.trim() || selectedAccount.name || "",
    }));
    setEditingName(false);
    showMessage({ text: "Account name updated", type: "success" });
  }, [selectedAccount, nameInput, showMessage]);

  const handleCancelEditName = useCallback(() => {
    setEditingName(false);
    setNameInput("");
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccount) return;
    try {
      await removeAccount(selectedAccount.email);
      await removeAccountSettings(selectedAccount.email);

      const updatedAccounts = await getAccounts();
      if (updatedAccounts.length === 0) {
        popOverlay();
        showMessage({ text: "All accounts removed", type: "info" });
      } else {
        setSelectedIndex(i => Math.min(i, updatedAccounts.length - 1));
        showMessage({ text: `Removed ${selectedAccount.email}`, type: "success" });
        sync();
      }
      setShowDeleteConfirm(false);
    } catch {
      showMessage({ text: "Failed to remove account", type: "error" });
      setShowDeleteConfirm(false);
    }
  }, [selectedAccount, popOverlay, showMessage, sync]);

  // Keyboard handler
  function DialogKeybinds() {
    useInput((key) => {
      if (showDeleteConfirm) {
        if (key.name === "escape" || key.name === "n") setShowDeleteConfirm(false);
        else if (key.name === "y") handleDeleteAccount();
        return;
      }

      if (editingName) {
        if (key.name === "escape") handleCancelEditName();
        return;
      }

      if (key.name === "escape") handleClose();
      else if (key.name === "up" || key.name === "k") setSelectedIndex(i => Math.max(0, i - 1));
      else if (key.name === "down" || key.name === "j") setSelectedIndex(i => Math.min(accounts.length - 1, i + 1));
      else if (key.name === "p") handleSetPrimary();
      else if (key.name === "n") handleStartEditName();
      else if (key.name === "d") setShowDeleteConfirm(true);
    });
    return null;
  }

  if (accounts.length === 0) {
    return (
      <Portal zIndex={100}>
        <DialogKeybinds />
        <Box
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Box
            style={{
              width: 45,
              bg: "black",
              padding: 1,
              flexDirection: "column",
              border: "round",
              borderColor: "cyan",
            } as any}
          >
            <Text style={{ color: "blackBright" }}>
              No accounts connected. Run ':login' to add one.
            </Text>
          </Box>
        </Box>
      </Portal>
    );
  }

  const displayName = selectedAccount
    ? customNames[selectedAccount.email] || selectedAccount.name || selectedAccount.email
    : "";
  const isPrimary = selectedAccount?.email === defaultEmail;
  const acctPerms = selectedAccount ? permissions[selectedAccount.email] : null;

  return (
    <Portal zIndex={100}>
      <DialogKeybinds />
      <Box
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Box
          style={{
            width: DIALOG_WIDTH,
            height: 16,
            bg: "black",
            padding: 1,
            flexDirection: "column",
            clip: true,
            border: "round",
            borderColor: "cyan",
          } as any}
        >
          {/* Header */}
          <Box style={{ flexDirection: "row", justifyContent: "space-between", paddingBottom: 1 }}>
            <Text style={{ color: "cyan", bold: true }}>Accounts</Text>
            <Text dim>{accounts.length} connected</Text>
          </Box>

          {/* Main content */}
          <Box style={{ flexDirection: "row", flexGrow: 1, clip: true }}>
            {/* Sidebar - account list */}
            <Box style={{ width: SIDEBAR_WIDTH, flexDirection: "column", paddingRight: 1 }}>
              {accounts.map((account, i) => {
                const isSelected = i === selectedIndex;
                const isDefault = account.email === defaultEmail;
                const name = customNames[account.email] || account.name || account.email.split("@")[0] || "";

                return (
                  <Text
                    key={account.email}
                    style={{
                      color: isSelected ? "white" : "blackBright",
                      bg: isSelected ? "blackBright" : undefined,
                    }}
                  >
                    {isDefault ? "● " : "  "}
                    {name.slice(0, SIDEBAR_WIDTH - 4)}
                  </Text>
                );
              })}
            </Box>

            {/* Details panel */}
            <Box style={{ flexDirection: "column", paddingLeft: 1, flexGrow: 1, clip: true }}>
              {selectedAccount && (
                <>
                  {/* Email */}
                  <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                    <Text style={{ color: "blackBright", width: 6 }}>email</Text>
                    <Text style={{ color: "white" }}>
                      {selectedAccount.email.length > 30
                        ? selectedAccount.email.slice(0, 28) + "…"
                        : selectedAccount.email}
                    </Text>
                  </Box>

                  {/* Name */}
                  <Box style={{ flexDirection: "row", gap: 1 }}>
                    <Text style={{ color: "blackBright", width: 6 }}>name</Text>
                    {editingName ? (
                      <Input
                        value={nameInput}
                        onChange={setNameInput}
                        placeholder="Custom name..."
                        autoFocus
                        onKeyPress={(key: any) => {
                          if (key.name === "return") { handleSaveName(); return true; }
                          if (key.name === "escape") { handleCancelEditName(); return true; }
                          return false;
                        }}
                      />
                    ) : (
                      <Text style={{ color: "white" }}>{displayName}</Text>
                    )}
                  </Box>

                  {/* Primary status */}
                  <Box style={{ flexDirection: "row", gap: 1, paddingTop: 1 }}>
                    <Text style={{ color: "blackBright", width: 6 }}> </Text>
                    {isPrimary ? (
                      <Text style={{ color: "green" }}>✓ Primary account</Text>
                    ) : (
                      <Text dim>Not primary</Text>
                    )}
                  </Box>

                  {/* Permissions */}
                  {acctPerms && (
                    <Box style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: "blackBright", width: 6 }}>scope</Text>
                      <Text>
                        <Text style={{ color: acctPerms.gmail ? "green" : "red" }}>
                          {acctPerms.gmail ? "✓" : "✗"} Mail
                        </Text>
                        {"  "}
                        <Text style={{ color: acctPerms.calendar ? "green" : "blackBright" }}>
                          {acctPerms.calendar ? "✓" : "–"} Calendar
                        </Text>
                        {"  "}
                        <Text style={{ color: acctPerms.contacts ? "green" : "blackBright" }}>
                          {acctPerms.contacts ? "✓" : "–"} Contacts
                        </Text>
                      </Text>
                    </Box>
                  )}

                  {/* Delete confirmation */}
                  {showDeleteConfirm && (
                    <Box style={{ paddingTop: 1 }}>
                      <Text style={{ color: "red" }}>
                        Remove this account? (y/n)
                      </Text>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* Footer */}
          <Box style={{ flexDirection: "row", gap: 2, paddingTop: 1 }}>
            <Text dim>
              {editingName
                ? "Enter:save  Esc:cancel"
                : showDeleteConfirm
                  ? "y:confirm  n:cancel"
                  : "n:rename  p:primary  d:delete  Esc:close"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
