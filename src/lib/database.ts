/**
 * Local SQLite database for email caching — powered by Drizzle ORM.
 *
 * Uses Bun's built-in bun:sqlite as the driver.
 * Stored at $XDG_DATA_HOME/epist/emails.db
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { join } from "path";
import { EPIST_DATA_DIR, ensureDirectories } from "./paths.ts";
import { emails, syncState, labelCounts, userLabels } from "./schema.ts";
import type { Email, LabelId } from "../domain/email.ts";
import { apiLogger } from "./logger.ts";

const DB_PATH = join(EPIST_DATA_DIR, "emails.db");

let _sqlite: Database | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (_db) return _db;

  _sqlite = new Database(DB_PATH, { create: true });
  _sqlite.run("PRAGMA journal_mode = WAL");
  _sqlite.run("PRAGMA synchronous = NORMAL");

  _db = drizzle(_sqlite, { schema: { emails, syncState, labelCounts, userLabels } });

  // Auto-create tables via raw SQL (drizzle-kit push is for dev, this is runtime)
  _sqlite.run(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      account_email TEXT NOT NULL,
      date TEXT NOT NULL,
      label_ids TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
  _sqlite.run(`CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id)`);
  _sqlite.run(`CREATE INDEX IF NOT EXISTS idx_emails_account ON emails(account_email)`);
  _sqlite.run(`CREATE INDEX IF NOT EXISTS idx_emails_date ON emails(date DESC)`);

  _sqlite.run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      account_email TEXT NOT NULL,
      label_id TEXT NOT NULL,
      history_id TEXT,
      next_page_token TEXT,
      last_sync_at INTEGER,
      PRIMARY KEY (account_email, label_id)
    )
  `);

  _sqlite.run(`
    CREATE TABLE IF NOT EXISTS label_counts (
      account_email TEXT NOT NULL,
      label_id TEXT NOT NULL,
      total INTEGER NOT NULL DEFAULT 0,
      unread INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (account_email, label_id)
    )
  `);

  _sqlite.run(`
    CREATE TABLE IF NOT EXISTS user_labels (
      id TEXT NOT NULL,
      account_email TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (id, account_email)
    )
  `);
  _sqlite.run(`CREATE INDEX IF NOT EXISTS idx_user_labels_account ON user_labels(account_email)`);

  return _db;
}

// ===== Email CRUD =====

/** Upsert a batch of emails into the local cache */
export function upsertEmails(emailList: Email[]): void {
  const db = getDb();
  for (const email of emailList) {
    db.insert(emails)
      .values({
        id: email.id,
        threadId: email.threadId,
        accountEmail: email.accountEmail || "",
        date: email.date,
        labelIds: JSON.stringify(email.labelIds),
        data: JSON.stringify(email),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: emails.id,
        set: {
          threadId: email.threadId,
          accountEmail: email.accountEmail || "",
          date: email.date,
          labelIds: JSON.stringify(email.labelIds),
          data: JSON.stringify(email),
          updatedAt: new Date(),
        },
      })
      .run();
  }
}

/** Get all cached emails, newest first, with optional limit + offset */
export function getCachedEmails(limit?: number, offset = 0): Email[] {
  const db = getDb();
  let query = db.select({ data: emails.data })
    .from(emails)
    .orderBy(desc(emails.date));

  if (limit != null) {
    query = query.limit(limit).offset(offset) as any;
  }

  const rows = query.all();
  return rows.map(r => JSON.parse(r.data) as Email);
}

/** Get cached emails for a specific account */
export function getCachedEmailsForAccount(accountEmail: string, limit?: number): Email[] {
  const db = getDb();
  let query = db.select({ data: emails.data })
    .from(emails)
    .where(eq(emails.accountEmail, accountEmail))
    .orderBy(desc(emails.date));

  if (limit != null) {
    query = query.limit(limit) as any;
  }

  const rows = query.all();
  return rows.map(r => JSON.parse(r.data) as Email);
}

/** Get cached emails whose label_ids JSON array contains a given label, with pagination */
export function getCachedEmailsByLabel(
  labelId: LabelId,
  limit: number,
  offset = 0,
): Email[] {
  const db = getDb();
  // Use SQLite json_each to check membership in the JSON array
  const rows = db.select({ data: emails.data })
    .from(emails)
    .where(sql`EXISTS (SELECT 1 FROM json_each(${emails.labelIds}) WHERE value = ${labelId})`)
    .orderBy(desc(emails.date))
    .limit(limit)
    .offset(offset)
    .all();

  return rows.map(r => JSON.parse(r.data) as Email);
}

/** Get a single email by ID */
export function getCachedEmail(id: string): Email | null {
  const db = getDb();
  const row = db.select({ data: emails.data })
    .from(emails)
    .where(eq(emails.id, id))
    .get();

  return row ? JSON.parse(row.data) as Email : null;
}

/** Remove emails by ID */
export function removeCachedEmails(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  db.delete(emails).where(inArray(emails.id, ids)).run();
}

/** Update label_ids for a cached email (optimistic local update) */
export function updateCachedEmailLabels(id: string, newLabelIds: LabelId[]): void {
  const db = getDb();
  const row = db.select({ data: emails.data })
    .from(emails)
    .where(eq(emails.id, id))
    .get();

  if (!row) return;

  const email = JSON.parse(row.data) as Email;
  email.labelIds = newLabelIds;

  db.update(emails)
    .set({
      labelIds: JSON.stringify(newLabelIds),
      data: JSON.stringify(email),
      updatedAt: new Date(),
    })
    .where(eq(emails.id, id))
    .run();
}

/** Count total cached emails */
export function getCachedEmailCount(): number {
  const db = getDb();
  const row = db.select({ count: sql<number>`COUNT(*)` })
    .from(emails)
    .get();
  return row?.count ?? 0;
}

// ===== Sync State =====

export interface SyncStateRow {
  accountEmail: string;
  labelId: string;
  historyId?: string;
  nextPageToken?: string;
  lastSyncAt?: Date;
}

/** Get sync state for an account+label pair */
export function getSyncState(accountEmail: string, labelId: string): SyncStateRow | null {
  const db = getDb();
  const row = db.select()
    .from(syncState)
    .where(and(eq(syncState.accountEmail, accountEmail), eq(syncState.labelId, labelId)))
    .get();

  if (!row) return null;
  return {
    accountEmail: row.accountEmail,
    labelId: row.labelId,
    historyId: row.historyId ?? undefined,
    nextPageToken: row.nextPageToken ?? undefined,
    lastSyncAt: row.lastSyncAt ?? undefined,
  };
}

/** Save sync state */
export function saveSyncState(state: SyncStateRow): void {
  const db = getDb();
  db.insert(syncState)
    .values({
      accountEmail: state.accountEmail,
      labelId: state.labelId,
      historyId: state.historyId ?? null,
      nextPageToken: state.nextPageToken ?? null,
      lastSyncAt: state.lastSyncAt ?? new Date(),
    })
    .onConflictDoUpdate({
      target: [syncState.accountEmail, syncState.labelId],
      set: {
        historyId: state.historyId ?? null,
        nextPageToken: state.nextPageToken ?? null,
        lastSyncAt: state.lastSyncAt ?? new Date(),
      },
    })
    .run();
}

// ===== Label Counts =====

export interface LabelCountRow {
  labelId: string;
  total: number;
  unread: number;
}

/** Save label counts for an account */
export function saveLabelCounts(accountEmail: string, counts: LabelCountRow[]): void {
  const db = getDb();
  for (const c of counts) {
    db.insert(labelCounts)
      .values({
        accountEmail,
        labelId: c.labelId,
        total: c.total,
        unread: c.unread,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [labelCounts.accountEmail, labelCounts.labelId],
        set: {
          total: c.total,
          unread: c.unread,
          updatedAt: new Date(),
        },
      })
      .run();
  }
}

/** Get label counts, optionally filtered by account. Aggregates across all accounts when no filter. */
export function getDbLabelCounts(accountEmail?: string): Record<string, { total: number; unread: number }> {
  const db = getDb();
  const result: Record<string, { total: number; unread: number }> = {};

  if (accountEmail) {
    const rows = db.select()
      .from(labelCounts)
      .where(eq(labelCounts.accountEmail, accountEmail))
      .all();

    for (const row of rows) {
      result[row.labelId] = { total: row.total, unread: row.unread };
    }
  } else {
    // Aggregate across all accounts
    const rows = db.select({
      labelId: labelCounts.labelId,
      total: sql<number>`SUM(${labelCounts.total})`,
      unread: sql<number>`SUM(${labelCounts.unread})`,
    })
      .from(labelCounts)
      .groupBy(labelCounts.labelId)
      .all();

    for (const row of rows) {
      result[row.labelId] = { total: row.total, unread: row.unread };
    }
  }

  return result;
}

// ===== User Labels Cache =====

export interface CachedUserLabel {
  id: string;
  name: string;
  color: string | null;
  accountEmail: string;
}

/** Upsert a batch of user labels for an account (replaces all labels for that account) */
export function upsertUserLabels(accountEmail: string, labels: Omit<CachedUserLabel, "accountEmail">[]): void {
  const db = getDb();
  // Delete existing labels for this account, then insert fresh
  db.delete(userLabels).where(eq(userLabels.accountEmail, accountEmail)).run();
  for (const l of labels) {
    db.insert(userLabels)
      .values({
        id: l.id,
        accountEmail,
        name: l.name,
        color: l.color,
        updatedAt: new Date(),
      })
      .run();
  }
}

/** Get all cached user labels, optionally filtered by account */
export function getCachedUserLabels(accountEmail?: string): CachedUserLabel[] {
  const db = getDb();
  if (accountEmail) {
    return db.select()
      .from(userLabels)
      .where(eq(userLabels.accountEmail, accountEmail))
      .all()
      .map(r => ({ id: r.id, name: r.name, color: r.color, accountEmail: r.accountEmail }));
  }
  return db.select()
    .from(userLabels)
    .all()
    .map(r => ({ id: r.id, name: r.name, color: r.color, accountEmail: r.accountEmail }));
}

// ===== Housekeeping =====

/** Clear all cached data for an account (e.g. after logout) */
export function clearAccountData(accountEmail: string): void {
  const db = getDb();
  db.delete(emails).where(eq(emails.accountEmail, accountEmail)).run();
  db.delete(syncState).where(eq(syncState.accountEmail, accountEmail)).run();
  db.delete(labelCounts).where(eq(labelCounts.accountEmail, accountEmail)).run();
  db.delete(userLabels).where(eq(userLabels.accountEmail, accountEmail)).run();
}

/** Clear all cached data */
export function clearAllData(): void {
  const db = getDb();
  db.delete(emails).run();
  db.delete(syncState).run();
  db.delete(labelCounts).run();
  db.delete(userLabels).run();
}

/** Initialize the database (call on app start) */
export async function initDatabase(): Promise<void> {
  await ensureDirectories();
  getDb(); // triggers table creation
  apiLogger.info("Database initialized", { path: DB_PATH });
}

/** Close the database connection */
export function closeDatabase(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}
