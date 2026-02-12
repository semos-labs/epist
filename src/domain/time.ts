import { DateTime } from "luxon";

// Get local timezone
export function getLocalTimezone(): string {
  return DateTime.local().zoneName || "UTC";
}

// Format date for email list (smart format)
export function formatEmailDate(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate);
  const now = DateTime.now();
  
  // Today: show time only
  if (dt.hasSame(now, "day")) {
    return dt.toFormat("HH:mm");
  }
  
  // Yesterday
  if (dt.hasSame(now.minus({ days: 1 }), "day")) {
    return "Yesterday";
  }
  
  // This week: show day name
  if (dt > now.minus({ days: 7 })) {
    return dt.toFormat("EEE");
  }
  
  // This year: show month and day
  if (dt.year === now.year) {
    return dt.toFormat("MMM d");
  }
  
  // Older: show full date
  return dt.toFormat("MMM d, yyyy");
}

// Format full date for email detail view
export function formatFullDate(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate);
  return dt.toFormat("EEEE, MMMM d, yyyy 'at' HH:mm");
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(isoDate: string): string {
  const dt = DateTime.fromISO(isoDate);
  const now = DateTime.now();
  const diff = now.diff(dt, ["days", "hours", "minutes"]);
  
  if (diff.days >= 1) {
    return `${Math.floor(diff.days)}d ago`;
  }
  if (diff.hours >= 1) {
    return `${Math.floor(diff.hours)}h ago`;
  }
  if (diff.minutes >= 1) {
    return `${Math.floor(diff.minutes)}m ago`;
  }
  return "just now";
}

// Check if date is today
export function isToday(isoDate: string): boolean {
  const dt = DateTime.fromISO(isoDate);
  return dt.hasSame(DateTime.now(), "day");
}

// Parse natural language date
export function parseNaturalDate(input: string): DateTime | null {
  // Basic parsing - can be extended with chrono-node
  const lower = input.toLowerCase().trim();
  const now = DateTime.now();
  
  if (lower === "today") return now.startOf("day");
  if (lower === "yesterday") return now.minus({ days: 1 }).startOf("day");
  if (lower === "tomorrow") return now.plus({ days: 1 }).startOf("day");
  
  // Try ISO format
  const parsed = DateTime.fromISO(input);
  if (parsed.isValid) return parsed;
  
  return null;
}
