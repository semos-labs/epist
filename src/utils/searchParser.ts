import type { Email } from "../domain/email.ts";

/**
 * Parsed search query with structured filters and free-text terms.
 * 
 * Supported filters:
 *   from:alice        — match sender name or email
 *   to:bob            — match recipient name or email
 *   subject:hello     — match subject line
 *   has:attachment     — emails with attachments
 *   has:star           — starred emails
 *   is:unread          — unread emails
 *   is:read            — read emails
 *   after:2025-01-01   — emails after date (inclusive)
 *   before:2025-12-31  — emails before date (inclusive)
 *   label:INBOX        — emails in specific label
 */

export interface SearchFilters {
  from: string[];
  to: string[];
  subject: string[];
  has: string[];
  is: string[];
  after: string | null;
  before: string | null;
  label: string[];
  freeText: string[];
}

/**
 * Parse a search query string into structured filters.
 * Handles quoted values and multiple filters.
 */
export function parseSearchQuery(query: string): SearchFilters {
  const filters: SearchFilters = {
    from: [],
    to: [],
    subject: [],
    has: [],
    is: [],
    after: null,
    before: null,
    label: [],
    freeText: [],
  };

  if (!query.trim()) return filters;

  // Tokenize: split on spaces but respect quoted strings
  const tokens: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < query.length; i++) {
    const ch = query[i]!;
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === " " && !inQuote) {
      if (current) tokens.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);

  for (const token of tokens) {
    const colonIdx = token.indexOf(":");
    if (colonIdx > 0) {
      const key = token.slice(0, colonIdx).toLowerCase();
      const value = token.slice(colonIdx + 1);
      if (!value) continue;

      switch (key) {
        case "from":
          filters.from.push(value.toLowerCase());
          break;
        case "to":
          filters.to.push(value.toLowerCase());
          break;
        case "subject":
          filters.subject.push(value.toLowerCase());
          break;
        case "has":
          filters.has.push(value.toLowerCase());
          break;
        case "is":
          filters.is.push(value.toLowerCase());
          break;
        case "after":
        case "newer":
        case "newer_than":
          filters.after = value;
          break;
        case "before":
        case "older":
        case "older_than":
          filters.before = value;
          break;
        case "label":
        case "in":
          filters.label.push(value.toUpperCase());
          break;
        default:
          // Unknown filter, treat as free text
          filters.freeText.push(token.toLowerCase());
      }
    } else {
      filters.freeText.push(token.toLowerCase());
    }
  }

  return filters;
}

/**
 * Check if an email matches the given parsed search filters.
 */
export function matchesSearch(email: Email, filters: SearchFilters): boolean {
  // from: filter
  for (const fromFilter of filters.from) {
    const fromName = (email.from.name || "").toLowerCase();
    const fromEmail = email.from.email.toLowerCase();
    if (!fromName.includes(fromFilter) && !fromEmail.includes(fromFilter)) {
      return false;
    }
  }

  // to: filter
  for (const toFilter of filters.to) {
    const toMatch = email.to.some(addr => {
      const name = (addr.name || "").toLowerCase();
      const em = addr.email.toLowerCase();
      return name.includes(toFilter) || em.includes(toFilter);
    });
    if (!toMatch) return false;
  }

  // subject: filter
  for (const subjectFilter of filters.subject) {
    if (!email.subject.toLowerCase().includes(subjectFilter)) {
      return false;
    }
  }

  // has: filter
  for (const hasFilter of filters.has) {
    switch (hasFilter) {
      case "attachment":
      case "attachments":
        if (!email.attachments || email.attachments.length === 0) return false;
        break;
      case "star":
      case "starred":
        if (!email.labelIds.includes("STARRED")) return false;
        break;
      case "calendar":
      case "invite":
        if (!email.calendarEvent) return false;
        break;
    }
  }

  // is: filter
  for (const isFilter of filters.is) {
    switch (isFilter) {
      case "unread":
        if (!email.labelIds.includes("UNREAD")) return false;
        break;
      case "read":
        if (email.labelIds.includes("UNREAD")) return false;
        break;
      case "starred":
      case "star":
        if (!email.labelIds.includes("STARRED")) return false;
        break;
      case "important":
        if (!email.labelIds.includes("IMPORTANT")) return false;
        break;
    }
  }

  // after: filter (date must be >= after)
  if (filters.after) {
    const afterDate = new Date(filters.after);
    if (!isNaN(afterDate.getTime())) {
      const emailDate = new Date(email.date);
      if (emailDate < afterDate) return false;
    }
  }

  // before: filter (date must be <= before)
  if (filters.before) {
    const beforeDate = new Date(filters.before);
    if (!isNaN(beforeDate.getTime())) {
      // Set to end of day
      beforeDate.setHours(23, 59, 59, 999);
      const emailDate = new Date(email.date);
      if (emailDate > beforeDate) return false;
    }
  }

  // label: filter
  for (const labelFilter of filters.label) {
    if (!email.labelIds.includes(labelFilter)) return false;
  }

  // Free text: match against subject, from, snippet, body
  for (const term of filters.freeText) {
    const inSubject = email.subject.toLowerCase().includes(term);
    const inFrom = (email.from.name || "").toLowerCase().includes(term) ||
                   email.from.email.toLowerCase().includes(term);
    const inSnippet = email.snippet.toLowerCase().includes(term);
    const inBody = email.body.toLowerCase().includes(term);
    if (!inSubject && !inFrom && !inSnippet && !inBody) {
      return false;
    }
  }

  return true;
}
