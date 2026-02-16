/**
 * GmailProvider — MailProvider implementation backed by the Gmail REST API.
 *
 * Wraps the existing functions in gmail.ts behind the MailProvider interface
 * so the rest of the app can treat Gmail the same as IMAP.
 */

import type { MailProvider, MessageListing, FolderInfo, SendOptions, SendAsAlias, SyncCursor, SyncDelta } from "./provider.ts";
import type { Email, LabelId } from "../domain/email.ts";
import {
  listMessages as gmailListMessages,
  getMessage as gmailGetMessage,
  getMessages as gmailGetMessages,
  getThread as gmailGetThread,
  searchMessages as gmailSearchMessages,
  markAsRead,
  markAsUnread,
  starMessage,
  unstarMessage,
  archiveMessage,
  trashMessage,
  untrashMessage,
  moveToLabel,
  sendMessage as gmailSendMessage,
  listLabels,
  fetchLabelCounts,
  getAttachment as gmailGetAttachment,
  getProfile,
  listHistory,
  listSendAs,
  type HistoryResponse,
  type GmailLabel,
} from "./gmail.ts";
import { apiLogger } from "../lib/logger.ts";

const DEFAULT_LABEL_IDS = ["INBOX", "SENT", "DRAFT", "TRASH", "SPAM", "STARRED", "IMPORTANT"];

export class GmailProvider implements MailProvider {
  readonly type = "gmail" as const;
  readonly accountEmail: string;

  constructor(accountEmail: string) {
    this.accountEmail = accountEmail;
  }

  // ----- Lifecycle -----

  async connect(): Promise<void> {
    // Gmail is stateless REST — just validate we can reach the API
    try {
      await getProfile(this.accountEmail);
    } catch (err) {
      apiLogger.error(`Gmail connect check failed for ${this.accountEmail}`, err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    // No-op for REST
  }

  // ----- Reading -----

  async listMessages(options?: {
    folder?: LabelId;
    query?: string;
    maxResults?: number;
    pageToken?: string;
  }): Promise<MessageListing> {
    const labelIds = options?.folder ? [options.folder] : undefined;
    return gmailListMessages(this.accountEmail, {
      labelIds,
      q: options?.query,
      maxResults: options?.maxResults,
      pageToken: options?.pageToken,
    });
  }

  async getMessage(messageId: string): Promise<Email> {
    return gmailGetMessage(this.accountEmail, messageId);
  }

  async getMessages(messageIds: string[]): Promise<Email[]> {
    return gmailGetMessages(this.accountEmail, messageIds);
  }

  async getThread(threadId: string): Promise<Email[]> {
    return gmailGetThread(this.accountEmail, threadId);
  }

  async searchMessages(query: string, maxResults = 50): Promise<Email[]> {
    return gmailSearchMessages(this.accountEmail, query, maxResults);
  }

  // ----- Mutations -----

  async markRead(messageId: string): Promise<void> {
    await markAsRead(this.accountEmail, messageId);
  }

  async markUnread(messageId: string): Promise<void> {
    await markAsUnread(this.accountEmail, messageId);
  }

  async star(messageId: string): Promise<void> {
    await starMessage(this.accountEmail, messageId);
  }

  async unstar(messageId: string): Promise<void> {
    await unstarMessage(this.accountEmail, messageId);
  }

  async archive(messageId: string): Promise<void> {
    await archiveMessage(this.accountEmail, messageId);
  }

  async trash(messageId: string): Promise<void> {
    await trashMessage(this.accountEmail, messageId);
  }

  async untrash(messageId: string): Promise<void> {
    await untrashMessage(this.accountEmail, messageId);
  }

  async moveToFolder(messageId: string, targetFolder: string, sourceFolder?: string): Promise<void> {
    await moveToLabel(this.accountEmail, messageId, targetFolder, sourceFolder ?? "INBOX");
  }

  // ----- Sending -----

  async sendMessage(options: SendOptions): Promise<void> {
    await gmailSendMessage(this.accountEmail, {
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      body: options.body,
      inReplyTo: options.inReplyTo,
      references: options.references,
      threadId: options.threadId,
    });
  }

  // ----- Folders / Labels -----

  async listFolders(): Promise<FolderInfo[]> {
    const labels = await listLabels(this.accountEmail);
    return labels.map(labelToFolderInfo);
  }

  async getFolderCounts(folderIds?: string[]): Promise<Record<string, { total: number; unread: number }>> {
    return fetchLabelCounts(this.accountEmail, folderIds ?? DEFAULT_LABEL_IDS);
  }

  // ----- Attachments -----

  async getAttachment(messageId: string, attachmentId: string): Promise<Uint8Array> {
    return gmailGetAttachment(this.accountEmail, messageId, attachmentId);
  }

  // ----- Sync -----

  async getInitialSyncCursor(): Promise<SyncCursor> {
    const profile = await getProfile(this.accountEmail);
    return { value: profile.historyId };
  }

  async getChangesSince(cursor: SyncCursor): Promise<SyncDelta> {
    const upsert: Email[] = [];
    const deleted: string[] = [];
    let latestHistoryId = cursor.value;
    let pageToken: string | undefined;

    do {
      const historyRes: HistoryResponse = await listHistory(
        this.accountEmail,
        cursor.value,
        { pageToken },
      );

      latestHistoryId = historyRes.historyId;

      if (historyRes.history) {
        for (const record of historyRes.history) {
          // New messages
          if (record.messagesAdded) {
            const newIds = record.messagesAdded.map(m => m.message.id);
            const emails = await this.getMessages(newIds);
            upsert.push(...emails);
          }

          // Deleted messages
          if (record.messagesDeleted) {
            deleted.push(...record.messagesDeleted.map(m => m.message.id));
          }

          // Label changes — re-fetch the message to get fresh state
          if (record.labelsAdded) {
            for (const entry of record.labelsAdded) {
              try {
                const fresh = await this.getMessage(entry.message.id);
                upsert.push(fresh);
              } catch {
                // Message may have been deleted
              }
            }
          }

          if (record.labelsRemoved) {
            for (const entry of record.labelsRemoved) {
              try {
                const fresh = await this.getMessage(entry.message.id);
                upsert.push(fresh);
              } catch {
                // Message may have been deleted
              }
            }
          }
        }
      }

      pageToken = historyRes.nextPageToken;
    } while (pageToken);

    return {
      upsert,
      deleted,
      cursor: { value: latestHistoryId, nextPageToken: cursor.nextPageToken },
    };
  }

  // ----- Optional -----

  async getSendAsAliases(): Promise<SendAsAlias[]> {
    const aliases = await listSendAs(this.accountEmail);
    return aliases.map(a => ({
      email: a.sendAsEmail,
      name: a.displayName,
      signature: a.signature || undefined,
      isPrimary: a.isPrimary,
    }));
  }
}

// ===== Helpers =====

function labelToFolderInfo(label: GmailLabel): FolderInfo {
  return {
    id: label.id,
    name: label.name,
    type: label.type,
    messagesTotal: label.messagesTotal,
    messagesUnread: label.messagesUnread,
    color: label.color?.backgroundColor,
  };
}
