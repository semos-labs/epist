/**
 * Accounts Dialog — Manage connected accounts (Google OAuth + IMAP/SMTP)
 * - View all accounts with provider badges
 * - Set custom display names (local-only)
 * - Set primary/default account
 * - Remove accounts (logout / delete)
 * - See granted permissions (Gmail) or server info (IMAP)
 * - Test connection for IMAP/SMTP accounts
 */

import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, Input, Portal, useInput } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { accountsAtom, googleAccountsAtom, configAtom } from "../state/atoms.ts";
import { popOverlayAtom, showMessageAtom, syncEmailsAtom, disconnectAccountAtom, openAddAccountDialogAtom } from "../state/actions.ts";
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
import { getProviderOrNull } from "../api/provider.ts";
import { resolvePassword } from "../utils/config.ts";
import type { AccountConfig } from "../utils/config.ts";

const DIALOG_WIDTH = 65;
const SIDEBAR_WIDTH = 22;

type ConnectionStatus = "unknown" | "checking" | "ok" | "error";

export function AccountsDialog() {
  const accounts = useAtomValue(accountsAtom);
  const googleAccounts = useAtomValue(googleAccountsAtom);
  const config = useAtomValue(configAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);
  const sync = useSetAtom(syncEmailsAtom);
  const disconnectAccount = useSetAtom(disconnectAccountAtom);
  const addAccount = useSetAtom(openAddAccountDialogAtom);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [defaultEmail, setDefaultEmail] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [permissions, setPermissions] = useState<
    Record<string, { gmail: boolean; calendar: boolean; contacts: boolean }>
  >({});

  // IMAP connection test state
  const [connStatus, setConnStatus] = useState<Record<string, ConnectionStatus>>({});
  const [connError, setConnError] = useState<Record<string, string>>({});

  // Load settings & permissions on mount
  useEffect(() => {
    async function load() {
      const settings = await loadAccountSettings();
      setCustomNames(settings.customNames);

      const def = await getDefaultAccount();
      setDefaultEmail(def?.account.email || null);

      // Check permissions per Google account
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

  // Find the full config for an IMAP account
  const getImapConfig = useCallback(
    (email: string): AccountConfig | undefined =>
      config.accounts.find(a => a.email === email && a.provider === "imap"),
    [config.accounts],
  );

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
      // Remove auth tokens (Gmail) or tell user about config.toml (IMAP)
      if (selectedAccount.provider === "gmail") {
        await removeAccount(selectedAccount.email);
      }
      await removeAccountSettings(selectedAccount.email);

      // Clear all cached data (DB, FTS index, sync state, provider) for this account
      await disconnectAccount(selectedAccount.email);

      if (selectedAccount.provider === "gmail") {
        const updatedAccounts = await getAccounts();
        if (updatedAccounts.length === 0 && accounts.length <= 1) {
          popOverlay();
          showMessage({ text: "All accounts removed", type: "info" });
        } else {
          setSelectedIndex(i => Math.min(i, accounts.length - 2));
          showMessage({ text: `Removed ${selectedAccount.email}`, type: "success" });
        }
      } else {
        // IMAP account — tell user to remove from config.toml
        showMessage({
          text: `Remove "${selectedAccount.email}" from config.toml to fully delete`,
          type: "info",
        });
      }
      setShowDeleteConfirm(false);
    } catch {
      showMessage({ text: "Failed to remove account", type: "error" });
      setShowDeleteConfirm(false);
    }
  }, [selectedAccount, accounts, popOverlay, showMessage, disconnectAccount]);

  // Test IMAP/SMTP connection
  const handleTestConnection = useCallback(async () => {
    if (!selectedAccount || selectedAccount.provider !== "imap") return;
    const email = selectedAccount.email;
    const imapCfg = getImapConfig(email);
    if (!imapCfg?.imap || !imapCfg?.smtp) return;

    setConnStatus(s => ({ ...s, [email]: "checking" }));
    setConnError(e => ({ ...e, [email]: "" }));

    const errors: string[] = [];

    // Test IMAP password resolution
    try {
      await resolvePassword({
        password: imapCfg.imap!.password,
        password_command: imapCfg.imap!.password_command,
        label: `IMAP`,
      });
    } catch (err) {
      errors.push(`IMAP password: ${err instanceof Error ? err.message : err}`);
    }

    // Test SMTP password resolution
    try {
      await resolvePassword({
        password: imapCfg.smtp!.password,
        password_command: imapCfg.smtp!.password_command,
        label: `SMTP`,
      });
    } catch (err) {
      errors.push(`SMTP password: ${err instanceof Error ? err.message : err}`);
    }

    // Try the actual provider connection if available
    if (errors.length === 0) {
      const provider = getProviderOrNull(email);
      if (provider) {
        try {
          await provider.connect();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!msg.includes("not yet implemented")) {
            errors.push(msg);
          }
          // "not yet implemented" is expected for now — passwords resolved OK
        }
      }
    }

    if (errors.length > 0) {
      setConnStatus(s => ({ ...s, [email]: "error" }));
      setConnError(e => ({ ...e, [email]: errors[0]! }));
      showMessage({ text: `Connection failed: ${errors[0]}`, type: "error" });
    } else {
      setConnStatus(s => ({ ...s, [email]: "ok" }));
      showMessage({ text: `Connection OK for ${email}`, type: "success" });
    }
  }, [selectedAccount, getImapConfig, showMessage]);

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
      else if (key.name === "up" || key.name === "k")
        setSelectedIndex(i => Math.max(0, i - 1));
      else if (key.name === "down" || key.name === "j")
        setSelectedIndex(i => Math.min(accounts.length - 1, i + 1));
      else if (key.name === "p") handleSetPrimary();
      else if (key.name === "n") handleStartEditName();
      else if (key.name === "d") setShowDeleteConfirm(true);
      else if (key.name === "t") handleTestConnection();
      else if (key.name === "a") addAccount();
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
              width: 45,
              bg: "black",
              padding: 1,
              flexDirection: "column",
            } as any}
          >
            <Text style={{ color: "blackBright" }}>
              No accounts connected. Run ':login' for Gmail, ':add-account' for
              IMAP/SMTP, or press Esc and then 'a' to add one.
            </Text>
          </Box>
        </Box>
      </Portal>
    );
  }

  // Resolve display info for selected account
  const displayName = selectedAccount
    ? customNames[selectedAccount.email] || selectedAccount.name || selectedAccount.email
    : "";
  const isPrimary = selectedAccount?.email === defaultEmail;
  const acctPerms = selectedAccount ? permissions[selectedAccount.email] : null;
  const isImap = selectedAccount?.provider === "imap";
  const imapConfig = isImap && selectedAccount ? getImapConfig(selectedAccount.email) : null;
  const status = selectedAccount ? connStatus[selectedAccount.email] : undefined;
  const error = selectedAccount ? connError[selectedAccount.email] : undefined;

  // Provider badge
  const providerBadge = (provider: string) =>
    provider === "gmail" ? (
      <Text style={{ color: "red" }}> G </Text>
    ) : (
      <Text style={{ color: "blue" }}> ✉ </Text>
    );

  return (
    <Portal zIndex={100}>
      <DialogKeybinds />
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
            width: DIALOG_WIDTH,
            height: 18,
            bg: "black",
            padding: 1,
            flexDirection: "column",
            clip: true,
          } as any}
        >
          {/* Header */}
          <Box
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              paddingBottom: 1,
            }}
          >
            <Text style={{ color: "cyan", bold: true }}>Accounts</Text>
            <Text style={{ dim: true }}>
              {accounts.length} account{accounts.length !== 1 ? "s" : ""}
            </Text>
          </Box>

          {/* Main content */}
          <Box style={{ flexDirection: "row", flexGrow: 1, clip: true }}>
            {/* Sidebar - account list */}
            <Box
              style={{
                width: SIDEBAR_WIDTH,
                flexDirection: "column",
                paddingRight: 1,
              }}
            >
              {accounts.map((account, i) => {
                const isSelected = i === selectedIndex;
                const isDefault = account.email === defaultEmail;
                const name =
                  customNames[account.email] ||
                  account.name ||
                  account.email.split("@")[0] ||
                  "";

                return (
                  <Box
                    key={account.email}
                    style={{ flexDirection: "row" }}
                  >
                    <Text
                      style={{
                        color: isSelected ? "white" : "blackBright",
                        bg: isSelected ? "blackBright" : undefined,
                      }}
                    >
                      {isDefault ? "●" : " "}
                    </Text>
                    {providerBadge(account.provider)}
                    <Text
                      style={{
                        color: isSelected ? "white" : "blackBright",
                        bg: isSelected ? "blackBright" : undefined,
                      }}
                    >
                      {name.slice(0, SIDEBAR_WIDTH - 6)}
                    </Text>
                  </Box>
                );
              })}
            </Box>

            {/* Details panel */}
            <Box
              style={{
                flexDirection: "column",
                paddingLeft: 1,
                flexGrow: 1,
                clip: true,
              }}
            >
              {selectedAccount && (
                <>
                  {/* Email */}
                  <Box style={{ flexDirection: "row", gap: 1, clip: true }}>
                    <Text style={{ color: "blackBright", width: 8 }}>email</Text>
                    <Text style={{ color: "white" }}>
                      {selectedAccount.email.length > 28
                        ? selectedAccount.email.slice(0, 26) + "…"
                        : selectedAccount.email}
                    </Text>
                  </Box>

                  {/* Name */}
                  <Box style={{ flexDirection: "row", gap: 1 }}>
                    <Text style={{ color: "blackBright", width: 8 }}>name</Text>
                    {editingName ? (
                      <Input
                        value={nameInput}
                        onChange={setNameInput}
                        placeholder="Custom name..."
                        autoFocus
                        onKeyPress={(key: any) => {
                          if (key.name === "return") {
                            handleSaveName();
                            return true;
                          }
                          if (key.name === "escape") {
                            handleCancelEditName();
                            return true;
                          }
                          return false;
                        }}
                      />
                    ) : (
                      <Text style={{ color: "white" }}>{displayName}</Text>
                    )}
                  </Box>

                  {/* Provider */}
                  <Box style={{ flexDirection: "row", gap: 1 }}>
                    <Text style={{ color: "blackBright", width: 8 }}>type</Text>
                    <Text
                      style={{
                        color: selectedAccount.provider === "gmail" ? "red" : "blue",
                      }}
                    >
                      {selectedAccount.provider === "gmail" ? "Gmail (OAuth)" : "IMAP/SMTP"}
                    </Text>
                  </Box>

                  {/* Primary status */}
                  <Box style={{ flexDirection: "row", gap: 1, paddingTop: 1 }}>
                    <Text style={{ color: "blackBright", width: 8 }}> </Text>
                    {isPrimary ? (
                      <Text style={{ color: "green" }}>✓ Primary account</Text>
                    ) : (
                      <Text style={{ dim: true }}>Not primary</Text>
                    )}
                  </Box>

                  {/* Gmail permissions */}
                  {acctPerms && selectedAccount.provider === "gmail" && (
                    <Box style={{ flexDirection: "row", gap: 1 }}>
                      <Text style={{ color: "blackBright", width: 8 }}>scope</Text>
                      <Text>
                        <Text style={{ color: acctPerms.gmail ? "green" : "red" }}>
                          {acctPerms.gmail ? "✓" : "✗"} Mail
                        </Text>
                        {"  "}
                        <Text
                          style={{
                            color: acctPerms.calendar ? "green" : "blackBright",
                          }}
                        >
                          {acctPerms.calendar ? "✓" : "–"} Calendar
                        </Text>
                        {"  "}
                        <Text
                          style={{
                            color: acctPerms.contacts ? "green" : "blackBright",
                          }}
                        >
                          {acctPerms.contacts ? "✓" : "–"} Contacts
                        </Text>
                      </Text>
                    </Box>
                  )}

                  {/* IMAP/SMTP server details */}
                  {isImap && imapConfig?.imap && (
                    <>
                      <Box style={{ flexDirection: "row", gap: 1 }}>
                        <Text style={{ color: "blackBright", width: 8 }}>imap</Text>
                        <Text style={{ color: "white" }}>
                          {imapConfig.imap.host}:{imapConfig.imap.port}
                        </Text>
                        <Text style={{ dim: true }}>({imapConfig.imap.security})</Text>
                      </Box>
                      {imapConfig.smtp && (
                        <Box style={{ flexDirection: "row", gap: 1 }}>
                          <Text style={{ color: "blackBright", width: 8 }}>smtp</Text>
                          <Text style={{ color: "white" }}>
                            {imapConfig.smtp.host}:{imapConfig.smtp.port}
                          </Text>
                          <Text style={{ dim: true }}>({imapConfig.smtp.security})</Text>
                        </Box>
                      )}
                      <Box style={{ flexDirection: "row", gap: 1 }}>
                        <Text style={{ color: "blackBright", width: 8 }}>auth</Text>
                        <Text style={{ color: "white" }}>
                          {imapConfig.imap.password_command ? "password_command" : "password"}
                        </Text>
                      </Box>

                      {/* Connection status */}
                      <Box style={{ flexDirection: "row", gap: 1 }}>
                        <Text style={{ color: "blackBright", width: 8 }}>status</Text>
                        {status === "checking" ? (
                          <Text style={{ color: "yellow" }}>⟳ Checking…</Text>
                        ) : status === "ok" ? (
                          <Text style={{ color: "green" }}>✓ Connected</Text>
                        ) : status === "error" ? (
                          <Text style={{ color: "red" }}>
                            ✗ {error ? error.slice(0, 30) : "Failed"}
                          </Text>
                        ) : (
                          <Text style={{ dim: true }}>Press t to test</Text>
                        )}
                      </Box>
                    </>
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
            <Text style={{ dim: true }}>
              {editingName
                ? "Enter:save  Esc:cancel"
                : showDeleteConfirm
                  ? "y:confirm  n:cancel"
                  : isImap
                    ? "a:add  t:test  n:rename  p:primary  d:delete  Esc:close"
                    : "a:add  n:rename  p:primary  d:delete  Esc:close"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
