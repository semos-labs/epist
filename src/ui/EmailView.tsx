import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { Box, Text, Image, ScrollView, Input, useApp, FocusScope, useFocusable, useScrollIntoView } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  selectedEmailAtom,
  selectedThreadAtom,
  focusAtom,
  viewScrollOffsetAtom,
  expandedHeadersAtom,
  debugHtmlAtom,
  focusedMessageIndexAtom,
  attachmentsFocusedAtom,
  selectedAttachmentIndexAtom,
  focusedImageIndexAtom,
  imageNavModeAtom,
  inlineReplyOpenAtom,
  inlineReplyContentAtom,
  hasOverlayAtom,
  folderSidebarOpenAtom,
  emailLinksAtom,
  activeLinkIndexAtom,
} from "../state/atoms.ts";
import {
  toggleFocusAtom,
  scrollViewAtom,
  toggleStarAtom,
  archiveEmailAtom,
  deleteEmailAtom,
  markUnreadAtom,
  moveSelectionAtom,
  openCommandAtom,
  openSearchAtom,
  openHelpAtom,
  replyEmailAtom,
  replyAllEmailAtom,
  forwardEmailAtom,
  composeEmailAtom,
  toggleHeadersAtom,
  toggleDebugHtmlAtom,
  copyHtmlToClipboardAtom,
  toggleAttachmentsFocusAtom,
  moveAttachmentSelectionAtom,
  openAttachmentAtom,
  saveAttachmentAtom,
  saveAllAttachmentsAtom,
  toggleImageNavAtom,
  moveImageFocusAtom,
  rsvpCalendarInviteAtom,
  openMoveToFolderAtom,
  undoAtom,
  openInlineReplyAtom,
  closeInlineReplyAtom,
  updateInlineReplyContentAtom,
  sendInlineReplyAtom,
  expandInlineReplyAtom,
  moveLinkFocusAtom,
  openActiveLinkAtom,
  resetLinkNavAtom,
  moveFocusedMessageAtom,
} from "../state/actions.ts";
import { ScopedKeybinds } from "../keybinds/useKeybinds.tsx";
import { formatFullDate } from "../domain/time.ts";
import { formatEmailAddress, formatEmailAddresses, type CalendarEvent, type Email, type Thread } from "../domain/email.ts";
import { icons } from "./icons.ts";
import { renderHtmlEmail, renderPlainTextEmail, TABLE_CHARS_RE, type LinePart } from "../utils/htmlRenderer.ts";
import { DateTime } from "luxon";
import { openFile } from "../utils/files.ts";

const InlineLink = React.memo(function InlineLink({ href, isActive, disabled }: { href: string; isActive: boolean; disabled: boolean }) {
  const { ref, isFocused } = useFocusable({
    disabled,
    onKeyPress: (key) => {
      if (key.name === "return" || key.name === " ") {
        openFile(href);
        return true;
      }
      return false;
    },
  });

  const highlighted = isActive || isFocused;

  return (
    <Box ref={ref} focusable style={{ flexDirection: "row" }}>
      <Text style={{ underline: true, bg: highlighted ? (isActive ? "cyan" : "blackBright") : undefined, color: isActive ? "black" : undefined }}>
        {href}
      </Text>
    </Box>
  );
});

function ViewKeybinds({ hasCalendarInvite }: { hasCalendarInvite?: boolean }) {
  const attachmentsFocused = useAtomValue(attachmentsFocusedAtom);
  const imageNavMode = useAtomValue(imageNavModeAtom);
  const toggleFocus = useSetAtom(toggleFocusAtom);
  const scrollView = useSetAtom(scrollViewAtom);
  const toggleStar = useSetAtom(toggleStarAtom);
  const archive = useSetAtom(archiveEmailAtom);
  const deleteEmail = useSetAtom(deleteEmailAtom);
  const markUnread = useSetAtom(markUnreadAtom);
  const moveSelection = useSetAtom(moveSelectionAtom);
  const openCommand = useSetAtom(openCommandAtom);
  const openSearch = useSetAtom(openSearchAtom);
  const openHelp = useSetAtom(openHelpAtom);
  const reply = useSetAtom(replyEmailAtom);
  const replyAll = useSetAtom(replyAllEmailAtom);
  const forward = useSetAtom(forwardEmailAtom);
  const compose = useSetAtom(composeEmailAtom);
  const toggleHeaders = useSetAtom(toggleHeadersAtom);
  const toggleDebugHtml = useSetAtom(toggleDebugHtmlAtom);
  const copyHtmlToClipboard = useSetAtom(copyHtmlToClipboardAtom);
  const setFocus = useSetAtom(focusAtom);
  const toggleAttachments = useSetAtom(toggleAttachmentsFocusAtom);
  const moveAttachment = useSetAtom(moveAttachmentSelectionAtom);
  const openAttachment = useSetAtom(openAttachmentAtom);
  const saveAttachment = useSetAtom(saveAttachmentAtom);
  const saveAllAttachments = useSetAtom(saveAllAttachmentsAtom);
  const toggleImageNav = useSetAtom(toggleImageNavAtom);
  const moveImageFocus = useSetAtom(moveImageFocusAtom);
  const rsvp = useSetAtom(rsvpCalendarInviteAtom);
  const moveToFolder = useSetAtom(openMoveToFolderAtom);
  const undo = useSetAtom(undoAtom);
  const inlineReply = useSetAtom(openInlineReplyAtom);
  const moveLinkFocus = useSetAtom(moveLinkFocusAtom);
  const openActiveLink = useSetAtom(openActiveLinkAtom);
  const resetLinkNav = useSetAtom(resetLinkNavAtom);
  const activeLinkIdx = useAtomValue(activeLinkIndexAtom);
  const emailLinks = useAtomValue(emailLinksAtom);
  const moveFocusedMessage = useSetAtom(moveFocusedMessageAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // ── Attachment sub-mode ──
  const attachmentHandlers = useMemo(() => ({
    nextAttachment: () => moveAttachment("next"),
    prevAttachment: () => moveAttachment("prev"),
    openAttachment: () => openAttachment(),
    saveAttachment: () => saveAttachment(),
    saveAll: () => saveAllAttachments(),
    exitAttachments: () => toggleAttachments(),
  }), [moveAttachment, openAttachment, saveAttachment, saveAllAttachments, toggleAttachments]);

  // ── Image nav sub-mode ──
  const imageNavHandlers = useMemo(() => ({
    nextImage: () => moveImageFocus("next"),
    prevImage: () => moveImageFocus("prev"),
    scrollDown: () => scrollView("down"),
    scrollUp: () => scrollView("up"),
    exitImageNav: () => toggleImageNav(),
  }), [moveImageFocus, scrollView, toggleImageNav]);

  // ── Normal view mode ──
  const viewHandlers = useMemo(() => ({
    // Scroll
    scrollDown: () => scrollView("down"),
    scrollUp: () => scrollView("up"),
    pageDown: () => scrollView("pageDown"),
    pageUp: () => scrollView("pageUp"),
    scrollBottom: () => scrollView("bottom"),
    scrollTop: () => {
      const now = Date.now();
      if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
        scrollView("top");
        lastKeyRef.current = "";
        return;
      }
      lastKeyRef.current = "g";
      lastKeyTimeRef.current = now;
    },

    // Focus
    focusList: () => { resetLinkNav(); setFocus("list"); },
    toggleFocus: () => { resetLinkNav(); toggleFocus(); },

    // Email actions
    toggleStar: () => toggleStar(),
    archive: () => archive(),
    delete: () => deleteEmail(),
    markUnread: () => markUnread(),
    nextEmail: () => moveSelection("down"),
    prevEmail: () => moveSelection("up"),
    reply: () => reply(),
    replyAll: () => replyAll(),
    forward: () => forward(),
    toggleHeaders: () => toggleHeaders(),
    toggleDebugHtml: () => toggleDebugHtml(),
    copyHtmlToClipboard: () => copyHtmlToClipboard(),
    toggleAttachments: () => toggleAttachments(),
    toggleImageNav: () => toggleImageNav(),
    nextMessage: () => moveFocusedMessage("next"),
    prevMessage: () => moveFocusedMessage("prev"),
    moveToFolder: () => moveToFolder(),
    undo: () => undo(),
    inlineReply: () => inlineReply(),

    // Link navigation
    nextLink: emailLinks.length > 0 ? () => moveLinkFocus("next") : undefined,
    prevLink: emailLinks.length > 0 ? () => moveLinkFocus("prev") : undefined,
    openLink: activeLinkIdx >= 0 ? () => openActiveLink() : undefined,

    // Calendar RSVP (conditionally active)
    rsvpAccept: hasCalendarInvite ? () => rsvp("ACCEPTED") : undefined,
    rsvpDecline: hasCalendarInvite ? () => rsvp("DECLINED") : undefined,
    rsvpTentative: hasCalendarInvite ? () => rsvp("TENTATIVE") : undefined,

    // Global-like
    openCommand: () => openCommand(),
    openSearch: () => openSearch(),
    openHelp: () => openHelp(),
    compose: () => compose(),
  }), [scrollView, setFocus, toggleFocus, toggleStar, archive, deleteEmail, markUnread,
    moveSelection, reply, replyAll, forward, compose, toggleHeaders, toggleDebugHtml, copyHtmlToClipboard, toggleAttachments,
    toggleImageNav, moveToFolder, undo, inlineReply, rsvp, openCommand, openSearch,
    openHelp, hasCalendarInvite, emailLinks, activeLinkIdx, moveLinkFocus, openActiveLink,
    moveFocusedMessage]);

  // Determine which keybind scope to render based on active sub-mode
  if (attachmentsFocused) {
    return <ScopedKeybinds scope="viewAttachments" handlers={attachmentHandlers} />;
  }

  if (imageNavMode) {
    return <ScopedKeybinds scope="viewImageNav" handlers={imageNavHandlers} />;
  }

  return <ScopedKeybinds scope="view" handlers={viewHandlers} />;
}

/** Subject bar at the top of the email view */
function SubjectBar() {
  const thread = useAtomValue(selectedThreadAtom);
  const email = useAtomValue(selectedEmailAtom);
  if (!email || !thread) return null;

  return (
    <Box style={{ flexDirection: "row", gap: 1, bg: "white", paddingX: 1 }}>
      {email.labelIds.includes("STARRED") && <Text>{icons.star}</Text>}
      <Text style={{ bold: true }}>{thread.subject}</Text>
      {thread.count > 1 && <Text dim>({thread.count})</Text>}
    </Box>
  );
}

/** Reusable per-message header — used for both single emails and conversations */
function MessageCardHeader({ email, expanded }: {
  email: Email;
  expanded: boolean;
}) {
  const fromName = email.from.name || email.from.email;
  const fromEmail = email.from.email;
  const dateDisplay = formatFullDate(email.date);

  if (!expanded) {
    // Collapsed: from + date + "to Names"
    return (
      <Box style={{ flexDirection: "column", paddingX: 1 }}>
        <Box style={{ flexDirection: "row" }}>
          <Text style={{ bold: true }}>{fromName}</Text>
          <Text style={{ flexGrow: 1 }}></Text>
          <Text dim>{dateDisplay}</Text>
        </Box>
        <Box style={{ flexDirection: "row" }}>
          <Text dim>to </Text>
          <Text dim>{formatEmailAddresses(email.to)}</Text>
          <Text style={{ flexGrow: 1 }}></Text>
          <Text dim>[i:expand]</Text>
        </Box>
      </Box>
    );
  }

  // Expanded: full header details
  return (
    <Box style={{ flexDirection: "column", paddingX: 1 }}>
      {/* From */}
      <Box style={{ flexDirection: "row" }}>
        <Text style={{ bold: true }}>{fromName}</Text>
        {email.from.name && <Text dim> {fromEmail}</Text>}
        <Text style={{ flexGrow: 1 }}></Text>
        <Text dim>{dateDisplay}</Text>
      </Box>

      {/* To */}
      <Box style={{ flexDirection: "row" }}>
        <Text dim>to </Text>
        <Text style={{ bold: true }}>{formatEmailAddresses(email.to)}</Text>
      </Box>

      {/* CC */}
      {email.cc && email.cc.length > 0 && (
        <Box style={{ flexDirection: "row" }}>
          <Text dim>cc </Text>
          <Text>{formatEmailAddresses(email.cc)}</Text>
        </Box>
      )}

      {/* BCC */}
      {email.bcc && email.bcc.length > 0 && (
        <Box style={{ flexDirection: "row" }}>
          <Text dim>bcc </Text>
          <Text>{formatEmailAddresses(email.bcc)}</Text>
        </Box>
      )}

      {/* Reply-To if different */}
      {email.replyTo && email.replyTo.email !== email.from.email && (
        <Box style={{ flexDirection: "row" }}>
          <Text dim>reply-to </Text>
          <Text>{formatEmailAddress(email.replyTo)}</Text>
        </Box>
      )}

      {/* Collapse hint */}
      <Box style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Text dim>[i:collapse]</Text>
      </Box>
    </Box>
  );
}

/** Per-message attachments display */
function MessageAttachments({ email }: { email: Email }) {
  const attachmentsFocused = useAtomValue(attachmentsFocusedAtom);
  const selectedIndex = useAtomValue(selectedAttachmentIndexAtom);

  if (!email.attachments?.length) return null;

  // Collapsed: just show count
  if (!attachmentsFocused) {
    return (
      <Box style={{ flexDirection: "row", paddingX: 1, gap: 1 }}>
        <Text>{icons.attachment}</Text>
        <Text dim>{email.attachments.length} attachment{email.attachments.length > 1 ? "s" : ""}</Text>
        <Text dim>[a:show]</Text>
      </Box>
    );
  }

  // Expanded: full list
  return (
    <FocusScope trap>
      <Box style={{
        flexDirection: "column",
        bg: "blackBright",
        paddingX: 1,
      }}>
        <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Box style={{ flexDirection: "row", gap: 1 }}>
            <Text>{icons.attachment}</Text>
            <Text>
              {email.attachments.length} attachment{email.attachments.length > 1 ? "s" : ""}:
            </Text>
          </Box>
          <Text dim>j/k:nav o:preview s:save S:save all a:exit</Text>
        </Box>
        {email.attachments.map((attachment, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box
              key={index}
              style={{
                flexDirection: "row",
                paddingLeft: 1,
                bg: isSelected ? "white" : undefined,
              }}
            >
              <Text>
                {isSelected ? "> " : "  "}{attachment.filename}
              </Text>
              {attachment.size && (
                <Text dim={!isSelected}>
                  {" "}({formatFileSize(attachment.size)})
                </Text>
              )}
            </Box>
          );
        })}
      </Box>
    </FocusScope>
  );
}

/** Reply/forward action row at the bottom of each message card */
function MessageCardActions() {
  return (
    <Box style={{ flexDirection: "row", justifyContent: "flex-end", paddingX: 1, gap: 2 }}>
      <Text dim>{icons.reply}</Text>
      <Text dim>{icons.forward}</Text>
    </Box>
  );
}

/** Raw HTML debug view — shows the original HTML before any pre-processing */
function DebugHtmlView({ email }: { email: Email }) {
  const rawHtml = email.bodyHtml || email.body;
  // Show first 500 lines max to avoid blowing up the terminal
  const allLines = rawHtml.split("\n");
  const lines = allLines.slice(0, 500);
  const truncated = allLines.length > 500;

  return (
    <Box style={{ flexDirection: "column", paddingX: 1, border: "single", borderColor: "magenta" }}>
      <Box style={{ flexDirection: "row" }}>
        <Text style={{ bold: true, color: "magenta" }}>⬡ RAW HTML</Text>
        <Text style={{ color: "gray" }}> ({rawHtml.length} chars, {allLines.length} lines) — Shift+H to close</Text>
      </Box>
      <Text> </Text>
      {lines.map((line, i) => (
        <Text key={i} style={{ color: "gray" }}>{line}</Text>
      ))}
      {truncated && <Text style={{ color: "magenta" }}>… truncated (500/{allLines.length} lines)</Text>}
    </Box>
  );
}

/** A complete message card — header, calendar invite, attachments, body, actions */
function MessageCard({ email, isFocused, linkIndexOffset, activeLinkIndex, viewFocused }: {
  email: Email;
  isFocused: boolean;
  linkIndexOffset: number;
  activeLinkIndex: number;
  viewFocused: boolean;
}) {
  const expandedHeaders = useAtomValue(expandedHeadersAtom);
  const expanded = !!expandedHeaders[email.id];
  const debugFlags = useAtomValue(debugHtmlAtom);
  const showDebugHtml = !!debugFlags[email.id];

  const cardRef = useRef(null);
  const scrollIntoView = useScrollIntoView(cardRef);
  const wasFocused = useRef(false);

  useEffect(() => {
    if (isFocused && !wasFocused.current) {
      scrollIntoView({ block: "center" });
    }
    wasFocused.current = isFocused;
  }, [isFocused, scrollIntoView]);

  return (
    <Box ref={cardRef} style={{
      flexDirection: "column",
      border: "round",
      borderColor: isFocused ? "yellow" : "gray",
    }}>

      {/* Header */}
      <MessageCardHeader email={email} expanded={expanded} />

      {/* Calendar invite */}
      {email.calendarEvent && (
        <Box style={{ paddingX: 1 }}>
          <CalendarInviteSection
            event={email.calendarEvent}
            inviteFocused={isFocused}
            onRsvp={() => {}}
          />
        </Box>
      )}

      {/* Attachments */}
      <MessageAttachments email={email} />

      {/* Debug: raw HTML view */}
      {showDebugHtml && <DebugHtmlView email={email} />}

      {/* Body content */}
      <Box style={{ paddingX: 1 }}>
        <Box style={{ flexDirection: "column" }}>
          <MessageContent email={email} linkIndexOffset={linkIndexOffset} activeLinkIndex={activeLinkIndex} viewFocused={viewFocused} />
        </Box>
      </Box>

      {/* Reply/forward actions */}
      <MessageCardActions />
    </Box>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ===== Calendar Invite Section =====

function formatEventDateCompact(start: string, end: string, allDay?: boolean): string {
  const startDt = DateTime.fromISO(start);
  const endDt = DateTime.fromISO(end);

  if (allDay) {
    if (startDt.hasSame(endDt, "day") || !end) {
      return startDt.toFormat("EEE, MMM d") + " · All day";
    }
    return `${startDt.toFormat("EEE, MMM d")} – ${endDt.toFormat("EEE, MMM d")}`;
  }

  if (startDt.hasSame(endDt, "day")) {
    return `${startDt.toFormat("EEE, MMM d")} · ${startDt.toFormat("h:mm a")} – ${endDt.toFormat("h:mm a")}`;
  }
  return `${startDt.toFormat("EEE, MMM d, h:mm a")} – ${endDt.toFormat("EEE, MMM d, h:mm a")}`;
}

function CalendarInviteSection({ event, inviteFocused, onRsvp }: {
  event: CalendarEvent;
  inviteFocused: boolean;
  onRsvp: (response: "ACCEPTED" | "DECLINED" | "TENTATIVE") => void;
}) {
  const isCancelled = event.method === "CANCEL" || event.status === "CANCELLED";
  const myStatus = event.myStatus || "NEEDS-ACTION";

  // Determine the location line — prefer conference URL, fall back to location
  const locationLine = event.conferenceUrl || event.location;

  // Find organizer display
  const organizerDisplay = event.organizer
    ? `${event.organizer.email}${event.organizer.name ? ` (${event.organizer.name})` : ""} - Organizer`
    : null;

  return (
    <Box style={{ flexDirection: "column", bg: "blackBright", paddingX: 1, marginBottom: 1 }}>
      <Text dim>{isCancelled ? "Cancelled: " : ""}{formatEventDateCompact(event.start, event.end, event.allDay)}</Text>
      <Text style={{ bold: true }}>{event.summary}</Text>
      {locationLine && (
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text dim>{icons.location}</Text>
          <Text>{locationLine}</Text>
        </Box>
      )}
      {organizerDisplay && (
        <Box style={{ flexDirection: "row", gap: 1 }}>
          <Text dim>{icons.people}</Text>
          <Text>{organizerDisplay}</Text>
        </Box>
      )}
      {!isCancelled && (
        <Box style={{ flexDirection: "row", gap: 2 }}>
          <Text style={{ bold: myStatus === "ACCEPTED" }}>
            {myStatus === "ACCEPTED" ? `${icons.check} Yes` : "y:Yes"}
          </Text>
          <Text style={{ bold: myStatus === "DECLINED" }}>
            {myStatus === "DECLINED" ? `${icons.cross} No` : "n:No"}
          </Text>
          <Text style={{ bold: myStatus === "TENTATIVE" }}>
            {myStatus === "TENTATIVE" ? "~ Maybe" : "t:Maybe"}
          </Text>
        </Box>
      )}
      {isCancelled && <Text dim>This event has been cancelled.</Text>}
    </Box>
  );
}

// ===== Line System =====

interface ExpandedLine {
  /** Inline segments: text and image parts */
  parts: LinePart[];
  /** The raw rendered line (with ANSI codes) */
  rawContent: string;
  /** Index in the original lines[] */
  originalIndex: number;
  /** If this line contains a focusable link */
  linkHref?: string;
}

/** Split a rendered line around a URL, returning [before, after] */
function splitAroundUrl(content: string, href: string): [string, string] {
  const idx = content.indexOf(href);
  if (idx === -1) return [content, ""];
  return [content.slice(0, idx), content.slice(idx + href.length)];
}

// Strip ANSI codes for content analysis
const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;
function stripAnsi(s: string): string { return s.replace(ANSI_RE, ""); }

// Detect if a line is a quoted line
const QUOTE_RE = /^(\s*>)+/;
const ON_WROTE_RE = /^On .+ wrote:$/;
function isQuotedLine(raw: string): boolean {
  const clean = stripAnsi(raw).trim();
  return QUOTE_RE.test(clean) || ON_WROTE_RE.test(clean);
}

// Group expanded lines into segments: { type: "lines" | "quote", items, startIndex }
interface LineSegment {
  kind: "lines";
  items: ExpandedLine[];
  startIndex: number;
}
interface QuoteSegment {
  kind: "quote";
  items: ExpandedLine[];
  startIndex: number;
  lineCount: number;
}
type Segment = LineSegment | QuoteSegment;

function groupQuotedSegments(lines: ExpandedLine[]): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    // A line is "quoted" only if it has no images and its raw content is a quote
    const hasImages = line.parts.some(p => p.type === "image");
    if (!hasImages && isQuotedLine(line.rawContent)) {
      const start = i;
      const quotedItems: ExpandedLine[] = [];
      while (i < lines.length) {
        const l = lines[i]!;
        const lHasImages = l.parts.some(p => p.type === "image");
        if (lHasImages || !isQuotedLine(l.rawContent)) break;
        quotedItems.push(l);
        i++;
      }
      segments.push({ kind: "quote", items: quotedItems, startIndex: start, lineCount: quotedItems.length });
    } else {
      const start = i;
      const items: ExpandedLine[] = [];
      while (i < lines.length) {
        const l = lines[i]!;
        const lHasImages = l.parts.some(p => p.type === "image");
        if (!lHasImages && isQuotedLine(l.rawContent)) break;
        items.push(l);
        i++;
      }
      segments.push({ kind: "lines", items, startIndex: start });
    }
  }
  return segments;
}

/** Collapsible quoted text block */
function QuotedBlock({ items, quoteIndex }: { items: ExpandedLine[]; quoteIndex: number }) {
  const [expanded, setExpanded] = React.useState(false);
  const toggle = useCallback(() => setExpanded(e => !e), []);

  if (!expanded) {
    return (
      <Box style={{ flexDirection: "row" }}>
        <Text dim>
          ··· {items.length} quoted {items.length === 1 ? "line" : "lines"} ···
        </Text>
      </Box>
    );
  }

  return (
    <>
      <Box style={{ flexDirection: "row" }}>
        <Text dim>··· quoted text ···</Text>
      </Box>
      {items.map((item, idx) => (
        <Box key={`q${quoteIndex}-${idx}`} style={{ flexDirection: "row" }}>
          <Text dim>{item.parts[0]?.content || item.rawContent || " "}</Text>
        </Box>
      ))}
    </>
  );
}

/** Renders a single message's body content (lines, images, links) */
function MessageContent({ email, linkIndexOffset, activeLinkIndex, viewFocused }: {
  email: Email;
  linkIndexOffset: number;
  activeLinkIndex: number;
  viewFocused: boolean;
}) {
  const { columns: terminalWidth } = useApp();

  const renderResult = useMemo(() => {
    const width = Math.max(40, terminalWidth - 6);
    if (email.bodyHtml && !email.calendarEvent) {
      return renderHtmlEmail(email.bodyHtml, width);
    }
    return renderPlainTextEmail(email.body);
  }, [email.id, email.bodyHtml, email.body, email.calendarEvent, terminalWidth]);

  const expandedLines: ExpandedLine[] = useMemo(() => {
    if (!renderResult) return [];
    const { lines, parsedLines, linkLineMap, links } = renderResult;
    return lines.map((line, i) => ({
      parts: parsedLines[i] || [{ type: "text" as const, content: line }],
      rawContent: line,
      originalIndex: i,
      linkHref: linkLineMap.has(i) ? links.find(l => l.id === linkLineMap.get(i))?.href : undefined,
    }));
  }, [renderResult]);

  // Group lines into quoted/non-quoted segments
  const segments = useMemo(() => groupQuotedSegments(expandedLines), [expandedLines]);

  if (!renderResult) return null;

  let quoteIdx = 0;
  let linkCounter = 0;

  return (
    <>
      {segments.map((seg, segIdx) => {
        if (seg.kind === "quote") {
          const qi = quoteIdx++;
          for (const item of seg.items) {
            if (item.linkHref) linkCounter++;
          }
          return (
            <QuotedBlock
              key={`quote-${segIdx}`}
              items={seg.items}
              quoteIndex={qi}
            />
          );
        }

        // Regular lines
        return seg.items.map((item, index) => {
          const key = `${seg.startIndex}-${index}`;
          const hasImages = item.parts.some(p => p.type === "image");

          // Line with inline image(s) — render each segment
          if (hasImages) {
            // If images appear inside a box-drawing table line, render them
            // inline (row direction) so the table structure is preserved.
            const isTableLine = item.parts.some(
              p => p.type === "text" && TABLE_CHARS_RE.test(p.content),
            );

            if (isTableLine) {
              return (
                <Box key={key} style={{ flexDirection: "row" }}>
                  {item.parts.map((part, pi) => {
                    if (part.type === "image" && part.src) {
                      return (
                        <Image
                          key={pi}
                          src={part.src}
                          placeholder={part.alt || "image"}
                          style={{ border: "none" }}
                          autoLoad={false}
                          autoSize
                          maxHeight={2}
                          disabled={!viewFocused}
                        />
                      );
                    }
                    return <Text key={pi}>{part.content}</Text>;
                  })}
                </Box>
              );
            }

            return (
              <Box key={key} style={{ flexDirection: "column" }}>
                {item.parts.map((part, pi) => {
                  if (part.type === "image" && part.src) {
                    return (
                      <Image
                        key={pi}
                        src={part.src}
                        placeholder={part.alt || "image"}
                        placeholderStyle={{ paddingX: 1 }}
                        focusedStyle={{ bg: "blackBright" }}
                        style={{ border: "none" }}
                        autoLoad={false}
                        autoSize
                        maxHeight={20}
                        disabled={!viewFocused}
                      />
                    );
                  }
                  return <Text key={pi}>{part.content}</Text>;
                })}
              </Box>
            );
          }

          // Line with a link
          if (item.linkHref) {
            const globalIdx = linkIndexOffset + linkCounter;
            linkCounter++;
            const [before, after] = splitAroundUrl(item.rawContent, item.linkHref);
            return (
              <Box key={key} style={{ flexDirection: "row" }}>
                {before && <Text>{before}</Text>}
                <InlineLink href={item.linkHref} isActive={activeLinkIndex === globalIdx} disabled={!viewFocused} />
                {after && <Text>{after}</Text>}
              </Box>
            );
          }

          // Plain text line
          const textContent = item.parts[0]?.content || item.rawContent || " ";
          return (
            <Box key={key} style={{ flexDirection: "row" }}>
              <Text>{textContent}</Text>
            </Box>
          );
        });
      })}
    </>
  );
}


function EmailBody({ availableHeight, viewFocused }: { availableHeight: number; viewFocused: boolean }) {
  const thread = useAtomValue(selectedThreadAtom);
  const email = useAtomValue(selectedEmailAtom);
  const scrollOffset = useAtomValue(viewScrollOffsetAtom);
  const setScrollOffset = useSetAtom(viewScrollOffsetAtom);
  const imageNavMode = useAtomValue(imageNavModeAtom);
  const setEmailLinks = useSetAtom(emailLinksAtom);
  const activeLinkIdx = useAtomValue(activeLinkIndexAtom);
  const focusedMsgIdx = useAtomValue(focusedMessageIndexAtom);

  // Collect all links from the thread for the link navigation system
  const allLinks = useMemo(() => {
    if (!thread) return [];
    const links: { href: string; lineIndex: number }[] = [];
    const messages = thread.count > 1 ? thread.messages : (email ? [email] : []);
    for (const msg of messages) {
      const width = 80; // approximate
      let result;
      if (msg.bodyHtml && !msg.calendarEvent) {
        result = renderHtmlEmail(msg.bodyHtml, width);
      } else {
        result = renderPlainTextEmail(msg.body);
      }
      if (result) {
        for (const link of result.links) {
          links.push({ href: link.href, lineIndex: links.length });
        }
      }
    }
    return links;
  }, [thread?.id, email?.id]);

  // Push links to atom so actions can access them
  useEffect(() => {
    setEmailLinks(allLinks);
  }, [allLinks, setEmailLinks]);

  if (!thread || !email) return null;

  const isConversation = thread.count > 1;
  // Reverse conversation messages so the latest is on top
  const messages = isConversation ? [...thread.messages].reverse() : [email];
  const resolvedFocusIdx = focusedMsgIdx < 0 ? 0 : focusedMsgIdx;

  // Calculate link index offsets per message
  let linkOffset = 0;

  return (
    <Box style={{ flexGrow: 1, flexDirection: "column" }}>
      <FocusScope trap={imageNavMode}>
        <ScrollView
          style={{ height: availableHeight }}
          scrollOffset={scrollOffset}
          onScroll={setScrollOffset}
          disableKeyboard
          focusable={false}
          virtualized
        >
          {messages.map((msg, idx) => {
            const msgOffset = linkOffset;
            const msgResult = (() => {
              if (msg.bodyHtml && !msg.calendarEvent) return renderHtmlEmail(msg.bodyHtml, 80);
              return renderPlainTextEmail(msg.body);
            })();
            const msgLinkCount = msgResult?.links?.length || 0;
            linkOffset += msgLinkCount;
            const isMsgFocused = idx === resolvedFocusIdx;

            return (
              <Box key={msg.id} style={{ flexDirection: "column", marginBottom: idx < messages.length - 1 ? 1 : 0 }}>
                <MessageCard
                  email={msg}
                  isFocused={isMsgFocused}
                  linkIndexOffset={msgOffset}
                  activeLinkIndex={activeLinkIdx}
                  viewFocused={viewFocused}
                />
              </Box>
            );
          })}
        </ScrollView>
      </FocusScope>
    </Box>
  );
}

function EmptyState() {
  return (
    <Box
      style={{
        flexGrow: 1,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Text dim>No email selected</Text>
      <Text dim style={{ fontSize: 1 }}>
        Press j/k to navigate, Enter to open
      </Text>
    </Box>
  );
}

// Quick inline reply at the bottom of the email view
function InlineReply({ width }: { width: number }) {
  const isOpen = useAtomValue(inlineReplyOpenAtom);
  const content = useAtomValue(inlineReplyContentAtom);
  const updateContent = useSetAtom(updateInlineReplyContentAtom);
  const sendReply = useSetAtom(sendInlineReplyAtom);
  const close = useSetAtom(closeInlineReplyAtom);
  const expand = useSetAtom(expandInlineReplyAtom);

  const handlers = useMemo(() => ({
    send: () => sendReply(),
    cancel: () => close(),
    expand: () => expand(),
  }), [sendReply, close, expand]);

  if (!isOpen) return null;

  return (
    <FocusScope trap>
      <Box style={{
        flexDirection: "column",
        borderWidth: 1,
        borderStyle: "single",
        borderColor: "cyan",
        paddingX: 1,
      }}>
        <Box style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ bold: true, color: "cyan" }}>{icons.reply} Quick Reply</Text>
          <Text dim>Ctrl+Enter:send | Ctrl+F:expand | Esc:cancel</Text>
        </Box>
        <Input
          value={content}
          onChange={updateContent}
          multiline
          placeholder="Type your quick reply..."
          style={{ width: Math.max(10, width - 4), height: 3 }}
          focusedStyle={{ bg: "blackBright" }}
        />
        <ScopedKeybinds scope="inlineReply" handlers={handlers} priority />
      </Box>
    </FocusScope>
  );
}

export function EmailView() {
  const { rows: terminalHeight, columns: terminalWidth } = useApp();
  const thread = useAtomValue(selectedThreadAtom);
  const email = useAtomValue(selectedEmailAtom);
  const focus = useAtomValue(focusAtom);
  const hasOverlay = useAtomValue(hasOverlayAtom);
  const folderSidebarOpen = useAtomValue(folderSidebarOpenAtom);

  const isFocused = focus === "view";

  // Subject bar = 1 line. Everything else (headers, attachments, body) is inside the ScrollView.
  const subjectLine = 1;
  const chrome = subjectLine + 2; // +2 for outer padding/border
  const availableHeight = Math.max(5, terminalHeight - chrome);

  return (
    <Box
      style={{
        flexGrow: 1,
        height: "100%",
        flexDirection: "column",
        paddingX: 1,
      }}
    >
      <Box style={{ flexGrow: 1, flexDirection: "column", clip: true }}>
        {thread ? (
          <>
            <SubjectBar />
            <EmailBody availableHeight={availableHeight} viewFocused={isFocused} />
          </>
        ) : (
          <EmptyState />
        )}
      </Box>

      {/* Quick inline reply box */}
      <InlineReply width={terminalWidth} />

      {isFocused && !hasOverlay && !folderSidebarOpen && <ViewKeybinds hasCalendarInvite={!!email?.calendarEvent} />}
    </Box>
  );
}
