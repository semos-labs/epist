/**
 * Lightweight iCalendar (ICS) parser for Gmail calendar invites.
 *
 * Gmail sends calendar invites as text/calendar MIME parts (RFC 5545).
 * This parser extracts VEVENT data we need for the UI — it does NOT
 * attempt to implement the full RFC 5545 spec.
 *
 * The raw ICS data comes from the MessagePart body with
 * mimeType "text/calendar" in the Gmail API payload.
 */

import type { CalendarEvent, CalendarAttendee, CalendarMethod, AttendeeStatus, AttendeeRole, EmailAddress } from "../domain/email.ts";

/**
 * Parse an ICS string into a CalendarEvent.
 * Returns null if no VEVENT is found.
 */
export function parseICS(icsData: string, currentUserEmail?: string): CalendarEvent | null {
  // Unfold long lines (RFC 5545 §3.1: lines can be folded with CRLF + whitespace)
  const unfolded = icsData.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);

  // Extract the METHOD from VCALENDAR level
  let method: CalendarMethod = "REQUEST";
  for (const line of lines) {
    if (line.startsWith("METHOD:")) {
      method = line.slice(7).trim().toUpperCase() as CalendarMethod;
      break;
    }
  }

  // Find VEVENT block
  const veventStart = lines.findIndex(l => l.trim() === "BEGIN:VEVENT");
  const veventEnd = lines.findIndex((l, i) => i > veventStart && l.trim() === "END:VEVENT");
  if (veventStart === -1 || veventEnd === -1) return null;

  const veventLines = lines.slice(veventStart + 1, veventEnd);
  const props = parseProperties(veventLines);

  const uid = props.get("UID") || "";
  const summary = props.get("SUMMARY") || "(No title)";
  const description = props.get("DESCRIPTION");
  const location = props.get("LOCATION");
  const status = props.get("STATUS") as CalendarEvent["status"];
  const sequence = props.get("SEQUENCE") ? parseInt(props.get("SEQUENCE")!, 10) : undefined;
  const recurrence = props.get("RRULE");

  // Parse dates
  const dtstart = parseDateValue(props.get("DTSTART") || "", props.getParams("DTSTART"));
  const dtend = parseDateValue(props.get("DTEND") || props.get("DURATION") || "", props.getParams("DTEND"));
  const allDay = isAllDayValue(props.getParams("DTSTART"));

  // Parse organizer
  const organizer = parseMailto(props.get("ORGANIZER"), props.getParams("ORGANIZER"));

  // Parse attendees
  const attendees: CalendarAttendee[] = [];
  for (const [key, value, params] of props.getAll("ATTENDEE")) {
    const attendee = parseAttendee(value, params);
    if (attendee) attendees.push(attendee);
  }

  // Try to find conference URL in common properties
  let conferenceUrl: string | undefined;
  // Google Meet uses X-GOOGLE-CONFERENCE
  const googleConf = props.get("X-GOOGLE-CONFERENCE");
  if (googleConf) conferenceUrl = googleConf;
  // Also check LOCATION for URLs
  if (!conferenceUrl && location && /^https?:\/\//.test(location)) {
    conferenceUrl = location;
  }
  // Check description for meet/zoom links
  if (!conferenceUrl && description) {
    const urlMatch = description.match(/https?:\/\/(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\S+/);
    if (urlMatch) conferenceUrl = urlMatch[0];
  }

  // Determine current user's status
  let myStatus: AttendeeStatus | undefined;
  if (currentUserEmail && attendees.length > 0) {
    const me = attendees.find(a => a.email.toLowerCase() === currentUserEmail.toLowerCase());
    if (me) myStatus = me.status;
  }

  return {
    uid,
    summary,
    description: description ? unescapeICS(description) : undefined,
    location: location ? unescapeICS(location) : undefined,
    start: dtstart,
    end: dtend,
    allDay,
    organizer,
    attendees,
    method,
    status,
    recurrence,
    sequence,
    conferenceUrl,
    myStatus: myStatus || "NEEDS-ACTION",
  };
}

// ===== Internal helpers =====

/** Parsed property bag that preserves parameters and multi-valued entries */
class PropertyBag {
  private entries: Array<{ key: string; value: string; params: Map<string, string> }> = [];

  add(key: string, value: string, params: Map<string, string>) {
    this.entries.push({ key, value, params });
  }

  get(key: string): string | undefined {
    return this.entries.find(e => e.key === key)?.value;
  }

  getParams(key: string): Map<string, string> {
    return this.entries.find(e => e.key === key)?.params || new Map();
  }

  getAll(key: string): Array<[string, string, Map<string, string>]> {
    return this.entries
      .filter(e => e.key === key)
      .map(e => [e.key, e.value, e.params]);
  }
}

/** Parse VEVENT lines into a property bag */
function parseProperties(lines: string[]): PropertyBag {
  const bag = new PropertyBag();

  for (const line of lines) {
    // Split "KEY;PARAM=VAL;PARAM2=VAL2:actual value"
    const colonIdx = findPropertyColon(line);
    if (colonIdx === -1) continue;

    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);

    // Parse parameters from the left side
    const parts = left.split(";");
    const key = parts[0]!.toUpperCase();
    const params = new Map<string, string>();
    for (let i = 1; i < parts.length; i++) {
      const eqIdx = parts[i]!.indexOf("=");
      if (eqIdx > 0) {
        params.set(
          parts[i]!.slice(0, eqIdx).toUpperCase(),
          parts[i]!.slice(eqIdx + 1).replace(/^"|"$/g, ""),
        );
      }
    }

    bag.add(key, value, params);
  }

  return bag;
}

/** Find the colon that separates the property name+params from the value.
 *  Must skip colons inside quoted parameter values. */
function findPropertyColon(line: string): number {
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQuote = !inQuote;
    if (line[i] === ":" && !inQuote) return i;
  }
  return -1;
}

/** Parse a DTSTART/DTEND value into an ISO string */
function parseDateValue(value: string, params: Map<string, string>): string {
  if (!value) return "";

  // VALUE=DATE means all-day (YYYYMMDD)
  if (params.get("VALUE") === "DATE" || value.length === 8) {
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // Full datetime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (match) {
    const [, y, mo, d, h, mi, s, z] = match;
    return `${y}-${mo}-${d}T${h}:${mi}:${s}${z || ""}`;
  }

  // Already ISO-ish, return as-is
  return value;
}

/** Check if DTSTART params indicate an all-day event */
function isAllDayValue(params: Map<string, string>): boolean {
  return params.get("VALUE") === "DATE";
}

/** Parse a MAILTO: value + CN parameter into an EmailAddress */
function parseMailto(value: string | undefined, params: Map<string, string>): EmailAddress | undefined {
  if (!value) return undefined;
  const email = value.replace(/^mailto:/i, "").trim();
  if (!email) return undefined;
  const name = params.get("CN");
  return { email, name: name ? unescapeICS(name) : undefined };
}

/** Parse an ATTENDEE line into a CalendarAttendee */
function parseAttendee(value: string, params: Map<string, string>): CalendarAttendee | null {
  const email = value.replace(/^mailto:/i, "").trim();
  if (!email) return null;

  const name = params.get("CN");
  const partstat = (params.get("PARTSTAT") || "NEEDS-ACTION").toUpperCase() as AttendeeStatus;
  const role = params.get("ROLE")?.toUpperCase() as AttendeeRole | undefined;

  return {
    email,
    name: name ? unescapeICS(name) : undefined,
    status: partstat,
    role,
  };
}

/** Unescape ICS text values (backslash escapes) */
function unescapeICS(text: string): string {
  return text
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Detect whether a Gmail message payload contains a calendar invite.
 * Walks the MIME parts tree looking for text/calendar.
 */
export function findCalendarPart(payload: { mimeType: string; body?: { data?: string }; parts?: any[] }): string | null {
  if (payload.mimeType === "text/calendar" && payload.body?.data) {
    // Gmail API returns base64url-encoded data
    return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = findCalendarPart(part);
      if (result) return result;
    }
  }

  return null;
}
