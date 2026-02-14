/**
 * Email sync engine.
 *
 * Responsibilities:
 *   1. Initial load: fetch last 30 messages per account, store in DB
 *   2. Incremental sync: use Gmail history.list to fetch only new changes
 *   3. Polling: run incremental sync every 10 seconds
 *   4. Load more: fetch next page of messages on demand
 *   5. Label counts: fetch from Gmail and cache in DB
 */

import {
  listMessages,
  getMessages,
  getMessage,
  fetchLabelCounts,
  listHistory,
  getProfile,
  type HistoryResponse,
} from "../api/gmail.ts";
import {
  upsertEmails,
  getCachedEmails,
  getSyncState,
  saveSyncState,
  saveLabelCounts,
  getDbLabelCounts,
  removeCachedEmails,
  updateCachedEmailLabels,
  getCachedEmail,
  initDatabase,
  clearAccountData,
  clearAllData,
  type LabelCountRow,
} from "./database.ts";
import { apiLogger } from "./logger.ts";
import type { Email, LabelId } from "../domain/email.ts";

// ===== Constants =====

const INITIAL_FETCH_COUNT = 30;
const LOAD_MORE_COUNT = 30;
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const FOLDER_LABELS: LabelId[] = ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT"];

// ===== Types =====

export interface SyncCallbacks {
  /** Called whenever the local email set changes — push to emailsAtom */
  onEmailsUpdated: (emails: Email[]) => void;
  /** Called whenever label counts are refreshed */
  onLabelCountsUpdated: (counts: Record<string, { total: number; unread: number }>) => void;
  /** Status messages for the UI */
  onStatus: (text: string, type: "info" | "success" | "warning" | "error") => void;
  /** Called when a "load more" page is available */
  onHasMore: (hasMore: boolean) => void;
}

// ===== State =====

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _isSyncing = false;
let _callbacks: SyncCallbacks | null = null;
let _accounts: string[] = [];

// ===== Public API =====

/**
 * Initialize sync engine. Call once on app start after login check.
 */
export async function startSync(accountEmails: string[], callbacks: SyncCallbacks): Promise<void> {
  _callbacks = callbacks;
  _accounts = accountEmails;

  await initDatabase();

  // Load whatever is cached immediately so the UI isn't empty
  const cached = getCachedEmails();
  if (cached.length > 0) {
    callbacks.onEmailsUpdated(cached);
    apiLogger.info(`Loaded ${cached.length} cached emails from DB`);
  }

  // Also load cached label counts
  const cachedCounts = getDbLabelCounts();
  if (Object.keys(cachedCounts).length > 0) {
    callbacks.onLabelCountsUpdated(cachedCounts);
  }

  // Do initial sync (fetches fresh data)
  await doFullSync();

  // Start polling
  startPolling();
}

/**
 * Stop the sync engine (e.g. on logout).
 */
export function stopSync(): void {
  stopPolling();
  _callbacks = null;
  _accounts = [];
}

/**
 * Trigger a manual sync (e.g. user presses a refresh key).
 */
export async function manualSync(): Promise<void> {
  await doFullSync();
}

/**
 * Load more (next page) for the given label across all accounts.
 * Called when the user scrolls near the bottom of the email list.
 */
export async function loadMore(labelId: LabelId = "INBOX"): Promise<void> {
  if (_isSyncing) return;
  _isSyncing = true;

  try {
    let loaded = 0;
    for (const account of _accounts) {
      const state = getSyncState(account, labelId);
      const pageToken = state?.nextPageToken;
      if (!pageToken) continue; // no more pages

      const listing = await listMessages(account, {
        labelIds: [labelId],
        maxResults: LOAD_MORE_COUNT,
        pageToken,
      });

      if (listing.messages.length > 0) {
        const newEmails = await getMessages(account, listing.messages.map(m => m.id));
        upsertEmails(newEmails);
        loaded += newEmails.length;
      }

      // Save updated page token
      saveSyncState({
        accountEmail: account,
        labelId,
        historyId: state?.historyId,
        nextPageToken: listing.nextPageToken,
      });
    }

    if (loaded > 0) {
      pushAllEmails();
      _callbacks?.onStatus(`Loaded ${loaded} more emails`, "success");
    }

    // Check if any account still has more pages for this label
    const hasMore = _accounts.some(account => {
      const s = getSyncState(account, labelId);
      return !!s?.nextPageToken;
    });
    _callbacks?.onHasMore(hasMore);

  } catch (err) {
    apiLogger.error("Load more failed", err);
    _callbacks?.onStatus(`Failed to load more: ${err instanceof Error ? err.message : err}`, "error");
  } finally {
    _isSyncing = false;
  }
}

/**
 * Fetch emails for a specific label/folder.
 * Called when the user switches folders. If we have cached emails for this label,
 * return them immediately and also refresh from the API in the background.
 */
export async function fetchForLabel(labelId: LabelId): Promise<void> {
  if (!_callbacks || _accounts.length === 0) return;

  // Push whatever is cached immediately
  pushAllEmails();

  // Then fetch fresh data from Gmail for this label
  try {
    let loaded = 0;
    for (const account of _accounts) {
      const state = getSyncState(account, labelId);

      // If we already have a historyId for this label, it's been fetched before
      // Just do a quick incremental-ish check. Otherwise do initial fetch for this label.
      if (state?.historyId) continue; // Already synced

      const listing = await listMessages(account, {
        labelIds: [labelId],
        maxResults: INITIAL_FETCH_COUNT,
      });

      if (listing.messages.length > 0) {
        const emails = await getMessages(account, listing.messages.map(m => m.id));
        upsertEmails(emails);
        loaded += emails.length;
        apiLogger.info(`Fetched ${emails.length} ${labelId} messages for ${account}`);
      }

      // Get profile for historyId (for future incremental sync)
      const profile = await getProfile(account);

      saveSyncState({
        accountEmail: account,
        labelId: labelId,
        historyId: profile.historyId,
        nextPageToken: listing.nextPageToken,
      });

      _callbacks?.onHasMore(!!listing.nextPageToken);
    }

    if (loaded > 0) {
      pushAllEmails();
    }
  } catch (err) {
    apiLogger.error(`Failed to fetch label ${labelId}`, err);
    _callbacks?.onStatus(
      `Failed to load ${labelId}: ${err instanceof Error ? err.message : err}`,
      "error",
    );
  }
}

/**
 * Update accounts list (e.g. after new login).
 */
export function updateAccounts(accountEmails: string[]): void {
  _accounts = accountEmails;
}

/**
 * Clear cache and resync from scratch.
 */
export async function resetSync(): Promise<void> {
  clearAllData();
  await doFullSync();
}

/**
 * Clear data for a specific account (after logout).
 */
export function clearAccount(accountEmail: string): void {
  clearAccountData(accountEmail);
  _accounts = _accounts.filter(a => a !== accountEmail);
  pushAllEmails();
}

// ===== Internal =====

function startPolling(): void {
  stopPolling();
  _pollTimer = setInterval(async () => {
    try {
      await doIncrementalSync();
    } catch (err) {
      apiLogger.error("Poll sync failed", err);
    }
  }, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

/** Push the full set of cached emails to the UI */
function pushAllEmails(): void {
  const all = getCachedEmails();
  _callbacks?.onEmailsUpdated(all);
}

/**
 * Full sync: initial fetch + label counts.
 * For each account, check if we have a historyId (= have synced before).
 * If no historyId → initial fetch of INITIAL_FETCH_COUNT messages.
 * If historyId exists → try incremental, fall back to full if history expired.
 */
async function doFullSync(): Promise<void> {
  if (_isSyncing) return;
  _isSyncing = true;

  try {
    for (const account of _accounts) {
      const state = getSyncState(account, "INBOX");

      if (state?.historyId) {
        // Try incremental first
        try {
          await doIncrementalSyncForAccount(account);
          continue; // success, skip initial fetch
        } catch (err: any) {
          // History expired (404) or other error → fall back to full fetch
          if (err?.message?.includes("404")) {
            apiLogger.warn(`History expired for ${account}, doing full fetch`);
          } else {
            apiLogger.error(`Incremental sync failed for ${account}, falling back to full`, err);
          }
        }
      }

      // Initial fetch
      await doInitialFetchForAccount(account);
    }

    // Refresh label counts
    await refreshLabelCounts();

    pushAllEmails();
  } catch (err) {
    apiLogger.error("Full sync failed", err);
    _callbacks?.onStatus(
      `Sync failed: ${err instanceof Error ? err.message : err}`,
      "error",
    );
  } finally {
    _isSyncing = false;
  }
}

/**
 * Initial fetch for one account: list INBOX messages → batch get → store in DB.
 */
async function doInitialFetchForAccount(account: string): Promise<void> {
  _callbacks?.onStatus("Syncing emails…", "info");

  // Get profile to obtain initial historyId
  const profile = await getProfile(account);

  // Fetch INBOX specifically — that's the default view
  const listing = await listMessages(account, {
    labelIds: ["INBOX"],
    maxResults: INITIAL_FETCH_COUNT,
  });

  if (listing.messages.length > 0) {
    const emails = await getMessages(account, listing.messages.map(m => m.id));
    upsertEmails(emails);
    apiLogger.info(`Fetched ${emails.length} INBOX messages for ${account}`);
  }

  // Save sync state with historyId and nextPageToken
  saveSyncState({
    accountEmail: account,
    labelId: "INBOX",
    historyId: profile.historyId,
    nextPageToken: listing.nextPageToken,
  });

  _callbacks?.onHasMore(!!listing.nextPageToken);
  _callbacks?.onStatus(`Synced ${listing.messages.length} emails`, "success");
}

/**
 * Incremental sync across all accounts.
 */
async function doIncrementalSync(): Promise<void> {
  if (_isSyncing) return;
  _isSyncing = true;

  try {
    let totalChanges = 0;
    for (const account of _accounts) {
      totalChanges += await doIncrementalSyncForAccount(account);
    }

    if (totalChanges > 0) {
      pushAllEmails();
      await refreshLabelCounts();
    }
  } catch (err) {
    apiLogger.error("Incremental sync failed", err);
  } finally {
    _isSyncing = false;
  }
}

/**
 * Incremental sync for one account using Gmail history.list.
 * Returns the number of changes applied.
 */
async function doIncrementalSyncForAccount(account: string): Promise<number> {
  const state = getSyncState(account, "INBOX");
  if (!state?.historyId) return 0;

  let changes = 0;
  let pageToken: string | undefined;
  let latestHistoryId = state.historyId;

  do {
    const historyRes: HistoryResponse = await listHistory(account, state.historyId, {
      pageToken,
    });

    latestHistoryId = historyRes.historyId;

    if (historyRes.history) {
      for (const record of historyRes.history) {
        // New messages
        if (record.messagesAdded) {
          const newIds = record.messagesAdded.map(m => m.message.id);
          const newEmails = await getMessages(account, newIds);
          upsertEmails(newEmails);
          changes += newEmails.length;
        }

        // Deleted messages
        if (record.messagesDeleted) {
          const deletedIds = record.messagesDeleted.map(m => m.message.id);
          removeCachedEmails(deletedIds);
          changes += deletedIds.length;
        }

        // Labels added
        if (record.labelsAdded) {
          for (const entry of record.labelsAdded) {
            // Re-fetch the message to get fresh labels
            try {
              const fresh = await getMessage(account, entry.message.id);
              upsertEmails([fresh]);
              changes++;
            } catch {
              // Message may have been deleted
            }
          }
        }

        // Labels removed
        if (record.labelsRemoved) {
          for (const entry of record.labelsRemoved) {
            try {
              const fresh = await getMessage(account, entry.message.id);
              upsertEmails([fresh]);
              changes++;
            } catch {
              // Message may have been deleted
            }
          }
        }
      }
    }

    pageToken = historyRes.nextPageToken;
  } while (pageToken);

  // Update historyId
  saveSyncState({
    accountEmail: account,
    labelId: "INBOX",
    historyId: latestHistoryId,
    nextPageToken: state.nextPageToken,
  });

  if (changes > 0) {
    apiLogger.info(`Incremental sync: ${changes} changes for ${account}`);
  }

  return changes;
}

/**
 * Refresh label counts from Gmail and push to UI + DB.
 */
async function refreshLabelCounts(): Promise<void> {
  const allCounts: Record<string, { total: number; unread: number }> = {};

  for (const account of _accounts) {
    try {
      const counts = await fetchLabelCounts(account, FOLDER_LABELS as string[]);

      // Save to DB
      const rows: LabelCountRow[] = Object.entries(counts).map(([labelId, c]) => ({
        labelId,
        total: c.total,
        unread: c.unread,
      }));
      saveLabelCounts(account, rows);

      // Aggregate
      for (const [labelId, c] of Object.entries(counts)) {
        if (!allCounts[labelId]) {
          allCounts[labelId] = { total: 0, unread: 0 };
        }
        allCounts[labelId].total += c.total;
        allCounts[labelId].unread += c.unread;
      }
    } catch (err) {
      apiLogger.error(`Failed to fetch label counts for ${account}`, err);
    }
  }

  _callbacks?.onLabelCountsUpdated(allCounts);
}
