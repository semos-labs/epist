/**
 * Drizzle ORM schema for the local SQLite email cache.
 *
 * Tables:
 *   emails      — cached full email objects
 *   sync_state  — per-account sync cursors (historyId, page tokens)
 *   label_counts — cached Gmail label counters
 */

import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

// ===== Emails table =====

export const emails = sqliteTable("emails", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  accountEmail: text("account_email").notNull(),
  date: text("date").notNull(),
  /** JSON-encoded string[] of label IDs */
  labelIds: text("label_ids").notNull(),
  /** Full Email object serialized as JSON */
  data: text("data").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  index("idx_emails_thread").on(table.threadId),
  index("idx_emails_account").on(table.accountEmail),
  index("idx_emails_date").on(table.date),
]);

// ===== Sync state table =====

export const syncState = sqliteTable("sync_state", {
  accountEmail: text("account_email").notNull(),
  labelId: text("label_id").notNull(),
  /** Gmail historyId — used for incremental sync */
  historyId: text("history_id"),
  /** Gmail nextPageToken — for resuming initial page loads */
  nextPageToken: text("next_page_token"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),
}, (table) => [
  primaryKey({ columns: [table.accountEmail, table.labelId] }),
]);

// ===== Label counts table =====

export const labelCounts = sqliteTable("label_counts", {
  accountEmail: text("account_email").notNull(),
  labelId: text("label_id").notNull(),
  total: integer("total").notNull().default(0),
  unread: integer("unread").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.accountEmail, table.labelId] }),
]);

// ===== User labels table (cached Gmail labels) =====

export const userLabels = sqliteTable("user_labels", {
  /** Gmail label ID (e.g. "Label_123") */
  id: text("id").notNull(),
  accountEmail: text("account_email").notNull(),
  name: text("name").notNull(),
  /** Terminal color name — pre-converted from hex */
  color: text("color"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => [
  primaryKey({ columns: [table.id, table.accountEmail] }),
  index("idx_user_labels_account").on(table.accountEmail),
]);
