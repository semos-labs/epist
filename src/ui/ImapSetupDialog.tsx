/**
 * IMAP/SMTP Account Setup Dialog
 *
 * Collects server settings, credentials, and auth method for IMAP/SMTP account setup.
 * Supports presets for common providers (Outlook, Yahoo, iCloud, Fastmail, etc.)
 * Supports connection testing before saving.
 * Saves the account to config.toml and initializes the provider.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Box, Text, Input, Select, Button, Portal, FocusScope, useInput } from "@semos-labs/glyph";
import { useSetAtom, useAtomValue } from "jotai";
import { configAtom } from "../state/atoms.ts";
import {
  popOverlayAtom,
  showMessageAtom,
  updateConfigAtom,
  checkAuthAtom,
} from "../state/actions.ts";
import { resolvePassword } from "../utils/config.ts";
import type { AccountConfig, ImapConfig, SmtpConfig } from "../utils/config.ts";

// ===== Known provider presets =====

interface ServerPreset {
  imap: { host: string; port: number; security: Security };
  smtp: { host: string; port: number; security: Security };
}

const KNOWN_PROVIDERS: Record<string, ServerPreset> = {
  "gmail.com":      { imap: { host: "imap.gmail.com",        port: 993, security: "tls" }, smtp: { host: "smtp.gmail.com",        port: 587, security: "starttls" } },
  "googlemail.com": { imap: { host: "imap.gmail.com",        port: 993, security: "tls" }, smtp: { host: "smtp.gmail.com",        port: 587, security: "starttls" } },
  "outlook.com":    { imap: { host: "outlook.office365.com", port: 993, security: "tls" }, smtp: { host: "smtp.office365.com", port: 587, security: "starttls" } },
  "hotmail.com":    { imap: { host: "outlook.office365.com", port: 993, security: "tls" }, smtp: { host: "smtp.office365.com", port: 587, security: "starttls" } },
  "live.com":       { imap: { host: "outlook.office365.com", port: 993, security: "tls" }, smtp: { host: "smtp.office365.com", port: 587, security: "starttls" } },
  "yahoo.com":      { imap: { host: "imap.mail.yahoo.com",   port: 993, security: "tls" }, smtp: { host: "smtp.mail.yahoo.com",   port: 587, security: "starttls" } },
  "icloud.com":     { imap: { host: "imap.mail.me.com",      port: 993, security: "tls" }, smtp: { host: "smtp.mail.me.com",      port: 587, security: "starttls" } },
  "me.com":         { imap: { host: "imap.mail.me.com",      port: 993, security: "tls" }, smtp: { host: "smtp.mail.me.com",      port: 587, security: "starttls" } },
  "fastmail.com":   { imap: { host: "imap.fastmail.com",     port: 993, security: "tls" }, smtp: { host: "smtp.fastmail.com",     port: 587, security: "starttls" } },
  "protonmail.com": { imap: { host: "127.0.0.1",             port: 1143, security: "starttls" }, smtp: { host: "127.0.0.1",            port: 1025, security: "starttls" } },
  "proton.me":      { imap: { host: "127.0.0.1",             port: 1143, security: "starttls" }, smtp: { host: "127.0.0.1",            port: 1025, security: "starttls" } },
  "zoho.com":       { imap: { host: "imap.zoho.com",         port: 993, security: "tls" }, smtp: { host: "smtp.zoho.com",         port: 587, security: "starttls" } },
  "yandex.ru":      { imap: { host: "imap.yandex.ru",        port: 993, security: "tls" }, smtp: { host: "smtp.yandex.ru",        port: 465, security: "tls" } },
  "yandex.com":     { imap: { host: "imap.yandex.com",       port: 993, security: "tls" }, smtp: { host: "smtp.yandex.com",       port: 465, security: "tls" } },
  "gmx.com":        { imap: { host: "imap.gmx.com",          port: 993, security: "tls" }, smtp: { host: "mail.gmx.com",          port: 587, security: "starttls" } },
  "mail.com":       { imap: { host: "imap.mail.com",         port: 993, security: "tls" }, smtp: { host: "smtp.mail.com",         port: 587, security: "starttls" } },
};

function guessPreset(email: string): ServerPreset | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  return KNOWN_PROVIDERS[domain] ?? null;
}

function guessFallback(email: string): ServerPreset {
  const domain = email.split("@")[1]?.toLowerCase() ?? "example.com";
  return {
    imap: { host: `imap.${domain}`, port: 993, security: "tls" },
    smtp: { host: `smtp.${domain}`, port: 587, security: "starttls" },
  };
}

// ===== Form types =====

type Security = "tls" | "starttls" | "none";
type AuthMethod = "password_command" | "password";

const SECURITY_ITEMS = [
  { label: "TLS", value: "tls" as Security },
  { label: "STARTTLS", value: "starttls" as Security },
  { label: "None", value: "none" as Security },
];

const AUTH_ITEMS = [
  { label: "password_command", value: "password_command" as AuthMethod },
  { label: "password", value: "password" as AuthMethod },
];

interface FormState {
  name: string;
  email: string;
  imap_host: string;
  imap_port: string;
  imap_security: Security;
  smtp_host: string;
  smtp_port: string;
  smtp_security: Security;
  auth_method: AuthMethod;
  auth_value: string;
}

const INITIAL_STATE: FormState = {
  name: "",
  email: "",
  imap_host: "",
  imap_port: "993",
  imap_security: "tls",
  smtp_host: "",
  smtp_port: "587",
  smtp_security: "starttls",
  auth_method: "password_command",
  auth_value: "",
};

const DIALOG_WIDTH = 60;
const LABEL_WIDTH = 10;

type TestStatus = "idle" | "testing" | "ok" | "error";

// ===== Keybinds =====

function DialogKeybinds({ onCancel }: { onCancel: () => void }) {
  useInput((key) => {
    if (key.name === "escape") {
      onCancel();
    }
  });
  return null;
}

// ===== Main component =====

export function ImapSetupDialog() {
  const config = useAtomValue(configAtom);
  const popOverlay = useSetAtom(popOverlayAtom);
  const showMessage = useSetAtom(showMessageAtom);
  const updateConfig = useSetAtom(updateConfigAtom);
  const checkAuth = useSetAtom(checkAuthAtom);

  const [form, setForm] = useState<FormState>({ ...INITIAL_STATE });
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  const setField = useCallback((key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  // Auto-detect server settings when email changes
  const prevEmailRef = useRef("");
  useEffect(() => {
    if (form.email === prevEmailRef.current) return;
    prevEmailRef.current = form.email;

    const preset = guessPreset(form.email);
    if (preset) {
      setForm(prev => ({
        ...prev,
        imap_host: preset.imap.host,
        imap_port: String(preset.imap.port),
        imap_security: preset.imap.security,
        smtp_host: preset.smtp.host,
        smtp_port: String(preset.smtp.port),
        smtp_security: preset.smtp.security,
      }));
      setAutoDetected(true);
    } else if (form.email.includes("@")) {
      const fallback = guessFallback(form.email);
      setForm(prev => ({
        ...prev,
        imap_host: prev.imap_host || fallback.imap.host,
        smtp_host: prev.smtp_host || fallback.smtp.host,
      }));
      setAutoDetected(false);
    }
  }, [form.email]);

  // ── Validate ──

  const validate = useCallback((): string | null => {
    if (!form.email.includes("@")) return "Email is required";
    if (!form.imap_host) return "IMAP host is required";
    if (!form.smtp_host) return "SMTP host is required";
    if (!form.auth_value) return `${form.auth_method === "password_command" ? "Password command" : "Password"} is required`;

    const existingEmails = config.accounts.map(a => a.email.toLowerCase());
    if (existingEmails.includes(form.email.toLowerCase())) {
      return `Account ${form.email} already exists`;
    }
    return null;
  }, [form, config.accounts]);

  // ── Test connection ──

  const handleTest = useCallback(async () => {
    const error = validate();
    if (error) { showMessage({ text: error, type: "error" }); return; }

    setTestStatus("testing");
    setTestError("");

    try {
      const passwordOpts = form.auth_method === "password_command"
        ? { password_command: form.auth_value }
        : { password: form.auth_value };
      await resolvePassword({ ...passwordOpts, label: "IMAP" });

      const { ImapSmtpProvider } = await import("../api/imap-provider.ts");

      const imapConfig: ImapConfig = {
        host: form.imap_host,
        port: parseInt(form.imap_port, 10) || 993,
        security: form.imap_security,
        username: form.email,
        ...(form.auth_method === "password_command"
          ? { password_command: form.auth_value }
          : { password: form.auth_value }),
      };
      const smtpConfig: SmtpConfig = {
        host: form.smtp_host,
        port: parseInt(form.smtp_port, 10) || 587,
        security: form.smtp_security,
        username: form.email,
        ...(form.auth_method === "password_command"
          ? { password_command: form.auth_value }
          : { password: form.auth_value }),
      };

      const provider = new ImapSmtpProvider(form.email, imapConfig, smtpConfig);
      await provider.connect();
      await provider.disconnect();

      setTestStatus("ok");
      showMessage({ text: `✓ Connection successful for ${form.email}`, type: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStatus("error");
      setTestError(msg.length > 60 ? msg.slice(0, 57) + "…" : msg);
      showMessage({ text: `Connection failed: ${msg}`, type: "error" });
    }
  }, [form, validate, showMessage]);

  // ── Save ──

  const handleSave = useCallback(async () => {
    const error = validate();
    if (error) { showMessage({ text: error, type: "error" }); return; }

    setSaving(true);
    try {
      const imapConfig: ImapConfig = {
        host: form.imap_host,
        port: parseInt(form.imap_port, 10) || 993,
        security: form.imap_security,
        username: form.email,
        ...(form.auth_method === "password_command"
          ? { password_command: form.auth_value }
          : { password: form.auth_value }),
      };
      const smtpConfig: SmtpConfig = {
        host: form.smtp_host,
        port: parseInt(form.smtp_port, 10) || 587,
        security: form.smtp_security,
        username: form.email,
        ...(form.auth_method === "password_command"
          ? { password_command: form.auth_value }
          : { password: form.auth_value }),
      };

      const newAccount: AccountConfig = {
        name: form.name || form.email.split("@")[0] || "IMAP Account",
        email: form.email,
        provider: "imap",
        imap: imapConfig,
        smtp: smtpConfig,
        is_default: config.accounts.length === 0,
      };

      await updateConfig({ accounts: [...config.accounts, newAccount] });
      showMessage({ text: `Account ${form.email} added — syncing…`, type: "success" });
      popOverlay();
      checkAuth();
    } catch (err) {
      showMessage({
        text: `Failed to save: ${err instanceof Error ? err.message : err}`,
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }, [form, config, validate, updateConfig, showMessage, popOverlay, checkAuth]);

  const handleCancel = useCallback(() => { popOverlay(); }, [popOverlay]);

  // Ctrl+S / Ctrl+T inside inputs
  const handleInputKeyPress = useCallback(
    (key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "s") { handleSave(); return true; }
      if (key.ctrl && key.name === "t") { handleTest(); return true; }
      return false;
    },
    [handleSave, handleTest],
  );

  // ── Styles ──

  const inputStyle = { color: "blackBright" as const };
  const focusedInputStyle = { color: "white" as const };

  // ── Status line ──

  const statusLine = testStatus === "testing" ? (
    <Text style={{ color: "yellow" }}>⟳ Testing connection…</Text>
  ) : testStatus === "ok" ? (
    <Text style={{ color: "green" }}>✓ Connection OK</Text>
  ) : testStatus === "error" ? (
    <Text style={{ color: "red" }}>✗ {testError || "Failed"}</Text>
  ) : null;

  return (
    <Portal zIndex={100}>
      <DialogKeybinds onCancel={handleCancel} />
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
            width: DIALOG_WIDTH,
            flexDirection: "column",
            padding: 1,
            bg: "black",
            clip: true,
          } as any}
        >
          <FocusScope trap>
            {/* Header */}
            <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ bold: true, color: "cyan" }}>Add IMAP/SMTP Account</Text>
              <Text style={{ color: "blackBright", dim: true }}>
                {autoDetected ? "auto-detected ✓" : "^S save  ^T test"}
              </Text>
            </Box>

            {/* Form */}
            <Box style={{ flexDirection: "column", paddingY: 1 }}>
              {/* Account */}
              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>name</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.name}
                    onChange={(v: string) => setField("name", v)}
                    placeholder="My Work Account"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>email</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.email}
                    onChange={(v: string) => setField("email", v)}
                    placeholder="me@example.com"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              {/* IMAP */}
              <Box style={{ paddingTop: 1 }}>
                <Text style={{ color: "blackBright", dim: true }}>imap</Text>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>host</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.imap_host}
                    onChange={(v: string) => setField("imap_host", v)}
                    placeholder="imap.example.com"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>port</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.imap_port}
                    onChange={(v: string) => setField("imap_port", v)}
                    placeholder="993"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>security</Text>
                <Select
                  items={SECURITY_ITEMS}
                  value={form.imap_security}
                  onChange={(v: string) => setField("imap_security", v)}
                  style={{ border: "none" } as any}
                  dropdownStyle={{ border: "none", bg: "#1a1a1a" } as any}
                  focusedStyle={{ bg: "blackBright" }}
                  highlightColor="cyan"
                  searchable={false}
                />
              </Box>

              {/* SMTP */}
              <Box style={{ paddingTop: 1 }}>
                <Text style={{ color: "blackBright", dim: true }}>smtp</Text>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>host</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.smtp_host}
                    onChange={(v: string) => setField("smtp_host", v)}
                    placeholder="smtp.example.com"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>port</Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.smtp_port}
                    onChange={(v: string) => setField("smtp_port", v)}
                    placeholder="587"
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={handleInputKeyPress}
                  />
                </Box>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>security</Text>
                <Select
                  items={SECURITY_ITEMS}
                  value={form.smtp_security}
                  onChange={(v: string) => setField("smtp_security", v)}
                  style={{ border: "none" } as any}
                  dropdownStyle={{ border: "none", bg: "#1a1a1a" } as any}
                  focusedStyle={{ bg: "blackBright" }}
                  highlightColor="cyan"
                  searchable={false}
                />
              </Box>

              {/* Auth */}
              <Box style={{ paddingTop: 1 }}>
                <Text style={{ color: "blackBright", dim: true }}>auth</Text>
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>method</Text>
                <Select
                  items={AUTH_ITEMS}
                  value={form.auth_method}
                  onChange={(v: string) => setField("auth_method", v)}
                  style={{ border: "none" } as any}
                  dropdownStyle={{ border: "none", bg: "#1a1a1a" } as any}
                  focusedStyle={{ bg: "blackBright" }}
                  highlightColor="cyan"
                  searchable={false}
                />
              </Box>

              <Box style={{ flexDirection: "row", gap: 1 }}>
                <Text style={{ color: "blackBright", width: LABEL_WIDTH }}>
                  {form.auth_method === "password_command" ? "command" : "password"}
                </Text>
                <Box style={{ flexGrow: 1 }}>
                  <Input
                    value={form.auth_value}
                    onChange={(v: string) => setField("auth_value", v)}
                    placeholder={form.auth_method === "password_command" ? "pass show email/work" : "••••••••"}
                    style={inputStyle}
                    focusedStyle={focusedInputStyle}
                    onKeyPress={(key) => {
                      if (key.ctrl && key.name === "s") { handleSave(); return true; }
                      if (key.ctrl && key.name === "t") { handleTest(); return true; }
                      if (key.name === "return") { handleSave(); return true; }
                      return false;
                    }}
                  />
                </Box>
              </Box>
            </Box>

            {/* Status */}
            {statusLine && (
              <Box style={{ paddingBottom: 1 }}>
                {statusLine}
              </Box>
            )}

            {/* Footer buttons */}
            <Box style={{ flexDirection: "row", gap: 1, justifyContent: "flex-end" }}>
              <Button
                onPress={handleCancel}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: "blackBright", color: "black" }}
              >
                <Text>cancel</Text>
              </Button>
              <Button
                onPress={handleTest}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: "yellow", color: "black" }}
              >
                <Text>{testStatus === "testing" ? "testing…" : "test"}</Text>
              </Button>
              <Button
                onPress={handleSave}
                style={{ paddingX: 1 }}
                focusedStyle={{ bg: "cyan", color: "black", bold: true }}
              >
                <Text>{saving ? "saving…" : "save"}</Text>
              </Button>
            </Box>
          </FocusScope>
        </Box>
      </Box>
    </Portal>
  );
}
