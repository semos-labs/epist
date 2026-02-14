/**
 * Authentication module exports
 */

export { startLoginFlow, logoutAccount, logoutAll, isLoggedIn, upgradePermissions } from "./oauth.ts";
export {
  getValidAccessToken,
  getValidAccessTokenForAccount,
  hasAnyAccount,
  getAccounts,
  getAccount,
  getDefaultAccount,
  setDefaultAccount,
  removeAccount,
  loadAccountsStore,
  hasGmailAccess,
  hasCalendarAccess,
  hasContactsAccess,
  getGrantedScopes,
} from "./tokens.ts";
export { getGoogleClientId, OAUTH_CONFIG } from "./credentials.ts";
export type { TokenData, AccountInfo, AccountData, AccountsStore } from "./tokens.ts";
export type { LoginResult } from "./oauth.ts";
