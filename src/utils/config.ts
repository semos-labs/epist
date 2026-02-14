import { parse, stringify } from "smol-toml";
import { existsSync } from "fs";

// ===== Configuration Schema =====

export interface AccountConfig {
  name: string;
  email: string;
  provider: string; // "gmail" | "outlook" | "imap"
  signature?: string; // Per-account signature (overrides global)
  is_default?: boolean;
}

export interface GoogleConfig {
  clientId?: string;
  clientSecret?: string;
}

export interface EpistConfig {
  general: {
    downloads_path: string;
    auto_mark_read: boolean;
    auto_save_interval: number; // seconds
    undo_timeout: number; // seconds
  };
  signature: {
    enabled: boolean;
    text: string;
  };
  theme: {
    accent_color: string;
    header_bg: string;
    selected_bg: string;
    starred_color: string;
    unread_style: string; // "bold" | "color" | "both"
  };
  google?: GoogleConfig;
  keybinds: Record<string, string>; // action -> key override
  accounts: AccountConfig[];
}

// Default configuration values
const DEFAULT_CONFIG: EpistConfig = {
  general: {
    downloads_path: "~/Downloads",
    auto_mark_read: true,
    auto_save_interval: 5,
    undo_timeout: 5,
  },
  signature: {
    enabled: true,
    text: "--\nSent from Epist",
  },
  theme: {
    accent_color: "cyan",
    header_bg: "white",
    selected_bg: "blackBright",
    starred_color: "yellow",
    unread_style: "bold",
  },
  keybinds: {},
  accounts: [
    {
      name: "Personal",
      email: "me@example.com",
      provider: "gmail",
      is_default: true,
    },
    {
      name: "Work",
      email: "me@work.com",
      provider: "gmail",
      signature: "--\nSent from my work account",
    },
  ],
};

// ===== Config File Path =====

function getConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
  return `${home}/.config/epist`;
}

function getConfigPath(): string {
  return `${getConfigDir()}/config.toml`;
}

// ===== Load / Save / Initialize =====

/**
 * Load config from ~/.config/epist/config.toml
 * Returns defaults merged with user overrides.
 */
export async function loadConfig(): Promise<EpistConfig> {
  const configPath = getConfigPath();

  try {
    if (!existsSync(configPath)) {
      // Create default config file
      await initConfig();
      return { ...DEFAULT_CONFIG };
    }

    const raw = await Bun.file(configPath).text();
    const parsed = parse(raw) as Record<string, any>;

    // Deep merge with defaults
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (err) {
    // If parsing fails, return defaults
    console.error(`Failed to load config: ${err}`);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save the current config to disk.
 */
export async function saveConfig(config: EpistConfig): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  try {
    await Bun.write(configPath, generateConfigToml(config));
  } catch (err) {
    console.error(`Failed to save config: ${err}`);
  }
}

/**
 * Initialize config file with defaults + comments.
 */
export async function initConfig(): Promise<void> {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  try {
    // Ensure directory exists
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });

    if (!existsSync(configPath)) {
      await Bun.write(configPath, generateConfigToml(DEFAULT_CONFIG));
    }
  } catch (err) {
    console.error(`Failed to init config: ${err}`);
  }
}

/**
 * Generate a commented TOML string for the config.
 */
function generateConfigToml(config: EpistConfig): string {
  const lines: string[] = [
    "# Epist — Terminal Email Client Configuration",
    "# ~/.config/epist/config.toml",
    "",
    "# ===== General Settings =====",
    "[general]",
    `downloads_path = "${config.general.downloads_path}"`,
    `auto_mark_read = ${config.general.auto_mark_read}`,
    `auto_save_interval = ${config.general.auto_save_interval}  # seconds`,
    `undo_timeout = ${config.general.undo_timeout}  # seconds`,
    "",
    "# ===== Email Signature =====",
    "[signature]",
    `enabled = ${config.signature.enabled}`,
    `text = """`,
    config.signature.text,
    `"""`,
    "",
    "# ===== Theme =====",
    "# Colors: black, red, green, yellow, blue, magenta, cyan, white, blackBright, etc.",
    "[theme]",
    `accent_color = "${config.theme.accent_color}"`,
    `header_bg = "${config.theme.header_bg}"`,
    `selected_bg = "${config.theme.selected_bg}"`,
    `starred_color = "${config.theme.starred_color}"`,
    `unread_style = "${config.theme.unread_style}"  # bold, color, or both`,
    "",
    "# ===== Google OAuth =====",
    "# Get credentials from https://console.cloud.google.com",
    "# Enable Gmail API, Calendar API, and People API",
    "[google]",
    `# clientId = ""`,
    `# clientSecret = ""`,
    "",
    "# ===== Keybind Overrides =====",
    "# Override default keybinds. Format: action = \"key\"",
    "# Example: archive = \"a\"",
    "[keybinds]",
    ...Object.entries(config.keybinds).map(([k, v]) => `${k} = "${v}"`),
    "",
    "# ===== Accounts =====",
    "# Configure email accounts. The first default account is used for sending.",
    "# Per-account signature overrides the global signature.",
    "",
    ...config.accounts.flatMap(acc => [
      "[[accounts]]",
      `name = "${acc.name}"`,
      `email = "${acc.email}"`,
      `provider = "${acc.provider}"`,
      ...(acc.is_default ? [`is_default = true`] : []),
      ...(acc.signature ? [`signature = "${acc.signature}"`] : []),
      "",
    ]),
    ...(config.accounts.length === 0 ? [
      "# [[accounts]]",
      "# name = \"Personal\"",
      "# email = \"me@example.com\"",
      "# provider = \"gmail\"",
      "# is_default = true",
      "",
    ] : []),
  ];

  return lines.join("\n");
}

/**
 * Deep merge user config overrides onto defaults.
 */
function mergeConfig(defaults: EpistConfig, overrides: Record<string, any>): EpistConfig {
  const result = { ...defaults };

  if (overrides.general) {
    result.general = { ...defaults.general, ...overrides.general };
  }
  if (overrides.signature) {
    result.signature = { ...defaults.signature, ...overrides.signature };
  }
  if (overrides.theme) {
    result.theme = { ...defaults.theme, ...overrides.theme };
  }
  if (overrides.google) {
    result.google = { ...defaults.google, ...overrides.google };
  }
  if (overrides.keybinds) {
    result.keybinds = { ...defaults.keybinds, ...overrides.keybinds };
  }
  if (overrides.accounts && Array.isArray(overrides.accounts)) {
    result.accounts = overrides.accounts;
  }

  return result;
}

/**
 * Get default config (useful for resetting).
 */
export function getDefaultConfig(): EpistConfig {
  return { ...DEFAULT_CONFIG };
}

/**
 * Resolve ~ in paths to home directory.
 */
export function resolvePath(path: string): string {
  if (path.startsWith("~/")) {
    const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
    return `${home}${path.slice(1)}`;
  }
  return path;
}
