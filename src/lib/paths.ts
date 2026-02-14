/**
 * Centralized path management with XDG Base Directory Specification support
 * 
 * XDG directories:
 *   - Config: $XDG_CONFIG_HOME/epist (default: ~/.config/epist)
 *   - Data: $XDG_DATA_HOME/epist (default: ~/.local/share/epist)
 *   - Cache: $XDG_CACHE_HOME/epist (default: ~/.cache/epist)
 */

import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";

const home = homedir();

// XDG Base Directories with defaults
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(home, ".config");
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || join(home, ".local", "share");
const XDG_CACHE_HOME = process.env.XDG_CACHE_HOME || join(home, ".cache");

// Epist directories
export const EPIST_CONFIG_DIR = join(XDG_CONFIG_HOME, "epist");
export const EPIST_DATA_DIR = join(XDG_DATA_HOME, "epist");
export const EPIST_CACHE_DIR = join(XDG_CACHE_HOME, "epist");

// Config files (user-editable)
export const CONFIG_FILE = join(EPIST_CONFIG_DIR, "config.toml");

// Data files (app-managed)
export const ACCOUNTS_FILE = join(EPIST_DATA_DIR, "accounts.json");
export const ACCOUNT_SETTINGS_FILE = join(EPIST_DATA_DIR, "account-settings.json");
export const DRAFTS_DIR = join(EPIST_DATA_DIR, "drafts");

// Logs directory
export const LOGS_DIR = join(EPIST_DATA_DIR, "logs");

/**
 * Ensure all Epist directories exist
 */
export async function ensureDirectories(): Promise<void> {
  await mkdir(EPIST_CONFIG_DIR, { recursive: true });
  await mkdir(EPIST_DATA_DIR, { recursive: true });
  await mkdir(EPIST_CACHE_DIR, { recursive: true });
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(DRAFTS_DIR, { recursive: true });
}
