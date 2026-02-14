/**
 * Multi-account token storage and refresh logic for Google OAuth
 */

import { getGoogleClientId, getGoogleClientSecret, OAUTH_CONFIG } from "./credentials.ts";
import { authLogger } from "../lib/logger.ts";
import { ACCOUNTS_FILE, ensureDirectories } from "../lib/paths.ts";

export interface TokenData {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at?: number; // Absolute timestamp for expiration
}

export interface AccountInfo {
  email: string;
  name?: string;
  picture?: string;
}

export interface AccountData {
  account: AccountInfo;
  tokens: TokenData;
}

export interface AccountsStore {
  accounts: Record<string, AccountData>; // Keyed by email
  defaultAccount?: string;
}

/**
 * Load accounts store from disk
 */
export async function loadAccountsStore(): Promise<AccountsStore> {
  try {
    const file = Bun.file(ACCOUNTS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content) as AccountsStore;
    }
  } catch {
    // File doesn't exist or is invalid
  }
  return { accounts: {} };
}

/**
 * Save accounts store to disk
 */
async function saveAccountsStore(store: AccountsStore): Promise<void> {
  await ensureDirectories();
  await Bun.write(ACCOUNTS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Get all logged-in accounts
 */
export async function getAccounts(): Promise<AccountData[]> {
  const store = await loadAccountsStore();
  return Object.values(store.accounts);
}

/**
 * Get account by email
 */
export async function getAccount(email: string): Promise<AccountData | null> {
  const store = await loadAccountsStore();
  return store.accounts[email] ?? null;
}

/**
 * Get the default account
 */
export async function getDefaultAccount(): Promise<AccountData | null> {
  const store = await loadAccountsStore();
  if (store.defaultAccount && store.accounts[store.defaultAccount]) {
    return store.accounts[store.defaultAccount] ?? null;
  }
  const accounts = Object.values(store.accounts);
  return accounts[0] ?? null;
}

/**
 * Set the default account
 */
export async function setDefaultAccount(email: string): Promise<void> {
  const store = await loadAccountsStore();
  if (!store.accounts[email]) {
    throw new Error(`Account ${email} not found`);
  }
  store.defaultAccount = email;
  await saveAccountsStore(store);
}

/**
 * Save account tokens
 */
export async function saveAccountTokens(account: AccountInfo, tokens: TokenData): Promise<void> {
  const store = await loadAccountsStore();

  const tokensWithExpiry: TokenData = {
    ...tokens,
    expires_at: Date.now() + (tokens.expires_in * 1000),
  };

  store.accounts[account.email] = {
    account,
    tokens: tokensWithExpiry,
  };

  // Set as default if first account
  if (!store.defaultAccount || Object.keys(store.accounts).length === 1) {
    store.defaultAccount = account.email;
  }

  await saveAccountsStore(store);
}

/**
 * Remove an account
 */
export async function removeAccount(email: string): Promise<void> {
  const store = await loadAccountsStore();
  delete store.accounts[email];

  if (store.defaultAccount === email) {
    const remaining = Object.keys(store.accounts);
    store.defaultAccount = remaining[0];
  }

  await saveAccountsStore(store);
}

/**
 * Check if any accounts exist
 */
export async function hasAnyAccount(): Promise<boolean> {
  const store = await loadAccountsStore();
  return Object.keys(store.accounts).length > 0;
}

/**
 * Check if access token is expired (with 5 minute buffer)
 */
export function isTokenExpired(tokens: TokenData): boolean {
  if (!tokens.expires_at) return true;
  return Date.now() > (tokens.expires_at - 5 * 60 * 1000);
}

/**
 * Refresh the access token for an account
 */
async function refreshAccountToken(email: string, refreshToken: string): Promise<TokenData> {
  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: await getGoogleClientId(),
      client_secret: await getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json() as {
    access_token: string; expires_in: number; token_type: string; scope: string;
  };

  const tokens: TokenData = {
    access_token: data.access_token,
    token_type: data.token_type,
    scope: data.scope,
    expires_in: data.expires_in,
    refresh_token: refreshToken, // Google doesn't return refresh_token on refresh
    expires_at: Date.now() + (data.expires_in * 1000),
  };

  // Update stored tokens
  const store = await loadAccountsStore();
  if (store.accounts[email]) {
    store.accounts[email].tokens = tokens;
    await saveAccountsStore(store);
  }

  return tokens;
}

/**
 * Get a valid access token for a specific account, refreshing if necessary
 */
export async function getValidAccessTokenForAccount(email: string): Promise<string | null> {
  const account = await getAccount(email);
  if (!account) return null;

  if (isTokenExpired(account.tokens)) {
    if (!account.tokens.refresh_token) return null;

    try {
      const refreshed = await refreshAccountToken(email, account.tokens.refresh_token);
      authLogger.info(`Token refreshed for ${email}`);
      return refreshed.access_token;
    } catch (error) {
      authLogger.error(`Failed to refresh token for ${email}`, error);
      return null;
    }
  }

  return account.tokens.access_token;
}

/**
 * Get a valid access token for the default account
 */
export async function getValidAccessToken(): Promise<string | null> {
  const defaultAccount = await getDefaultAccount();
  if (!defaultAccount) return null;
  return getValidAccessTokenForAccount(defaultAccount.account.email);
}

/**
 * Exchange authorization code for tokens (with PKCE)
 */
export async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<TokenData> {
  authLogger.debug("Exchanging authorization code for tokens (with PKCE)");

  const response = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: await getGoogleClientId(),
      client_secret: await getGoogleClientSecret(),
      redirect_uri: OAUTH_CONFIG.redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    authLogger.error("Failed to exchange code for tokens", { status: response.status, error });
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const tokens = await response.json() as TokenData;
  authLogger.info("Successfully exchanged code for tokens");
  return tokens;
}

/**
 * Fetch user info using access token
 */
export async function fetchUserInfo(accessToken: string): Promise<AccountInfo> {
  authLogger.debug("Fetching user info from Google");

  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    authLogger.error("Failed to fetch user info", { status: response.status, error });
    throw new Error(`Failed to fetch user info: ${error}`);
  }

  const data = await response.json() as { email: string; name?: string; picture?: string };
  authLogger.info("User info fetched successfully", { email: data.email });
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

/**
 * Check which scopes were granted for an account
 */
export function getGrantedScopes(account: AccountData): string[] {
  return account.tokens.scope ? account.tokens.scope.split(" ") : [];
}

/**
 * Check if an account has a specific scope
 */
export function hasScope(account: AccountData, scope: string): boolean {
  return getGrantedScopes(account).includes(scope);
}

/**
 * Check if an account has Gmail access
 */
export function hasGmailAccess(account: AccountData): boolean {
  const scopes = getGrantedScopes(account);
  return scopes.some(s =>
    s.includes("gmail.modify") || s.includes("gmail.readonly") || s.includes("mail.google.com")
  );
}

/**
 * Check if an account has calendar access
 */
export function hasCalendarAccess(account: AccountData): boolean {
  const scopes = getGrantedScopes(account);
  return scopes.some(s => s.includes("calendar"));
}

/**
 * Check if an account has contacts access
 */
export function hasContactsAccess(account: AccountData): boolean {
  const scopes = getGrantedScopes(account);
  return scopes.some(s => s.includes("contacts"));
}
