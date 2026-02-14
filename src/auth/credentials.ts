/**
 * Google OAuth 2.0 credentials for Epist (Desktop application type)
 * 
 * Uses PKCE (Proof Key for Code Exchange) for enhanced security.
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 * 
 * Note: Google REQUIRES client_secret even for Desktop apps with PKCE.
 * For desktop apps, the secret is not truly "secret" (it's embedded in the app),
 * but Google still requires it. PKCE provides the actual security.
 * 
 * Credential priority (first available wins):
 * 1. Config file (~/.config/epist/config.toml) - BYO override
 * 2. Environment variables (EPIST_GOOGLE_CLIENT_ID, EPIST_GOOGLE_CLIENT_SECRET)
 * 3. Built-in credentials (embedded at build time) - default for distributed binaries
 */

import { loadConfig } from "../utils/config.ts";

// Built-in credentials - embedded at compile time via --define flag
// These are replaced during CI build with actual values
// @ts-ignore - These are defined at compile time
const BUILTIN_CLIENT_ID: string | undefined = typeof __EPIST_GOOGLE_CLIENT_ID__ !== "undefined" ? __EPIST_GOOGLE_CLIENT_ID__ : undefined;
// @ts-ignore - These are defined at compile time
const BUILTIN_CLIENT_SECRET: string | undefined = typeof __EPIST_GOOGLE_CLIENT_SECRET__ !== "undefined" ? __EPIST_GOOGLE_CLIENT_SECRET__ : undefined;

// Cached credentials
let cachedCredentials: { clientId: string | undefined; clientSecret: string | undefined } | null = null;

/**
 * Load credentials — config > env vars > built-in
 */
async function getCredentials(): Promise<{ clientId: string | undefined; clientSecret: string | undefined }> {
  if (cachedCredentials) return cachedCredentials;

  const config = await loadConfig();

  cachedCredentials = {
    clientId: config.google?.clientId || process.env.EPIST_GOOGLE_CLIENT_ID || BUILTIN_CLIENT_ID,
    clientSecret: config.google?.clientSecret || process.env.EPIST_GOOGLE_CLIENT_SECRET || BUILTIN_CLIENT_SECRET,
  };

  return cachedCredentials;
}

export async function getGoogleClientId(): Promise<string> {
  const { clientId } = await getCredentials();
  if (!clientId) {
    throw new Error(
      "Google Client ID not configured.\n\n" +
      "If you're running from source, set up your Google Cloud credentials:\n" +
      "1. Create a project at https://console.cloud.google.com\n" +
      "2. Enable Gmail API, Google Calendar API, and People API\n" +
      "3. Create OAuth 2.0 credentials (Desktop app type)\n" +
      "4. Add credentials to ~/.config/epist/config.toml:\n\n" +
      "   [google]\n" +
      '   clientId = "your-client-id.apps.googleusercontent.com"\n' +
      '   clientSecret = "your-client-secret"\n\n' +
      "Or set environment variables:\n" +
      "   export EPIST_GOOGLE_CLIENT_ID=your-client-id\n" +
      "   export EPIST_GOOGLE_CLIENT_SECRET=your-client-secret\n"
    );
  }
  return clientId;
}

export async function getGoogleClientSecret(): Promise<string> {
  const { clientSecret } = await getCredentials();
  if (!clientSecret) {
    throw new Error(
      "Google Client Secret not configured.\n\n" +
      "Add your client secret to ~/.config/epist/config.toml:\n\n" +
      "   [google]\n" +
      '   clientId = "your-client-id.apps.googleusercontent.com"\n' +
      '   clientSecret = "your-client-secret"\n'
    );
  }
  return clientSecret;
}

// OAuth configuration
export const OAUTH_CONFIG = {
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  redirectUri: "http://localhost:8086/callback",
  port: 8086,

  // Scopes: mail, calendar, contacts, user info
  scopes: [
    "https://www.googleapis.com/auth/gmail.modify",         // Read/write mail, labels (not delete)
    "https://www.googleapis.com/auth/gmail.send",           // Send mail
    "https://www.googleapis.com/auth/calendar.events",      // Read/write calendar events
    "https://www.googleapis.com/auth/calendar.readonly",    // Read calendars list
    "https://www.googleapis.com/auth/contacts.readonly",    // Read contacts
    "https://www.googleapis.com/auth/userinfo.email",       // Get user email
    "https://www.googleapis.com/auth/userinfo.profile",     // Get user profile
  ],
};

// ===== PKCE (Proof Key for Code Exchange) =====

/**
 * Generate a cryptographically random code verifier for PKCE
 * Must be 43-128 characters, using unreserved URI characters
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generate the code challenge from a code verifier using SHA-256
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Base64 URL encode (RFC 4648 §5)
 */
function base64UrlEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
}

export async function generatePKCE(): Promise<PKCEParams> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge };
}

// ===== Authorization URLs =====

/**
 * Build the authorization URL with PKCE
 */
export async function getAuthUrl(state: string, codeChallenge: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: await getGoogleClientId(),
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Build authorization URL for incremental consent (upgrading permissions) with PKCE
 */
export async function getIncrementalAuthUrl(loginHint: string, state: string, codeChallenge: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: await getGoogleClientId(),
    redirect_uri: OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    login_hint: loginHint,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${OAUTH_CONFIG.authUrl}?${params.toString()}`;
}
