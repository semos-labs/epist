import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { Box, Text, Image, ScrollView, Keybind, useApp, FocusScope, useFocusable } from "@nick-skriabin/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import {
  selectedEmailAtom,
  focusAtom,
  viewScrollOffsetAtom,
  headersExpandedAtom,
  attachmentsFocusedAtom,
  selectedAttachmentIndexAtom,
  focusedImageIndexAtom,
  imageNavModeAtom,
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
  toggleHeadersAtom,
  toggleAttachmentsFocusAtom,
  moveAttachmentSelectionAtom,
  openAttachmentAtom,
  saveAttachmentAtom,
  saveAllAttachmentsAtom,
  toggleImageNavAtom,
  moveImageFocusAtom,
  rsvpCalendarInviteAtom,
} from "../state/actions.ts";
import { formatFullDate } from "../domain/time.ts";
import { formatEmailAddress, formatEmailAddresses, type CalendarEvent } from "../domain/email.ts";
import { icons } from "./icons.ts";
import { renderHtmlEmail, renderPlainTextEmail, type ExtractedImage, type ExtractedLink, type RenderResult } from "../utils/htmlRenderer.ts";
import { DateTime } from "luxon";
import { openFile } from "../utils/files.ts";

const InlineLink = React.memo(function InlineLink({ href, active }: { href: string; active: boolean }) {
  const { ref, isFocused } = useFocusable({
    onKeyPress: (key) => {
      if (key.name === "return" || key.name === " ") {
        openFile(href);
        return true;
      }
      return false;
    },
  });

  if (!active) {
    return <Text style={{ underline: true }}>{href}</Text>;
  }

  return (
    <Box ref={ref} focusable style={{ flexDirection: "row" }}>
      <Text style={{ underline: true, bg: isFocused ? "blackBright" : undefined }}>{href}</Text>
    </Box>
  );
});

function ViewKeybinds({ images, hasCalendarInvite }: { images?: ExtractedImage[]; hasCalendarInvite?: boolean }) {
  const attachmentsFocused = useAtomValue(attachmentsFocusedAtom);
  const imageNavMode = useAtomValue(imageNavModeAtom);
  const focusedImageIdx = useAtomValue(focusedImageIndexAtom);
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
  const toggleHeaders = useSetAtom(toggleHeadersAtom);
  const setFocus = useSetAtom(focusAtom);
  const toggleAttachments = useSetAtom(toggleAttachmentsFocusAtom);
  const moveAttachment = useSetAtom(moveAttachmentSelectionAtom);
  const openAttachment = useSetAtom(openAttachmentAtom);
  const saveAttachment = useSetAtom(saveAttachmentAtom);
  const saveAllAttachments = useSetAtom(saveAllAttachmentsAtom);
  const toggleImageNav = useSetAtom(toggleImageNavAtom);
  const moveImageFocus = useSetAtom(moveImageFocusAtom);
  const rsvp = useSetAtom(rsvpCalendarInviteAtom);

  const lastKeyRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Memoize all handlers to keep stable references for Keybind components
  const scrollDown = useCallback(() => scrollView("down"), [scrollView]);
  const scrollUp = useCallback(() => scrollView("up"), [scrollView]);
  const pageDown = useCallback(() => scrollView("pageDown"), [scrollView]);
  const pageUp = useCallback(() => scrollView("pageUp"), [scrollView]);
  const scrollBottom = useCallback(() => scrollView("bottom"), [scrollView]);
  const handleG = useCallback(() => {
    const now = Date.now();
    if (lastKeyRef.current === "g" && now - lastKeyTimeRef.current < 500) {
      scrollView("top");
      lastKeyRef.current = "";
      return;
    }
    lastKeyRef.current = "g";
    lastKeyTimeRef.current = now;
  }, [scrollView]);
  const focusList = useCallback(() => setFocus("list"), [setFocus]);
  const handleToggleFocus = useCallback(() => toggleFocus(), [toggleFocus]);
  const handleToggleStar = useCallback(() => toggleStar(), [toggleStar]);
  const handleArchive = useCallback(() => archive(), [archive]);
  const handleDelete = useCallback(() => deleteEmail(), [deleteEmail]);
  const handleMarkUnread = useCallback(() => markUnread(), [markUnread]);
  const nextEmail = useCallback(() => moveSelection("down"), [moveSelection]);
  const prevEmail = useCallback(() => moveSelection("up"), [moveSelection]);
  const handleReply = useCallback(() => reply(), [reply]);
  const handleReplyAll = useCallback(() => replyAll(), [replyAll]);
  const handleForward = useCallback(() => forward(), [forward]);
  const handleToggleHeaders = useCallback(() => toggleHeaders(), [toggleHeaders]);
  const handleToggleAttachments = useCallback(() => toggleAttachments(), [toggleAttachments]);
  const handleToggleImageNav = useCallback(() => toggleImageNav(), [toggleImageNav]);
  const handleOpenCommand = useCallback(() => openCommand(), [openCommand]);
  const handleOpenSearch = useCallback(() => openSearch(), [openSearch]);
  const handleOpenHelp = useCallback(() => openHelp(), [openHelp]);
  const attNext = useCallback(() => moveAttachment("next"), [moveAttachment]);
  const attPrev = useCallback(() => moveAttachment("prev"), [moveAttachment]);
  const handleOpenAttachment = useCallback(() => openAttachment(), [openAttachment]);
  const handleSaveAttachment = useCallback(() => saveAttachment(), [saveAttachment]);
  const handleSaveAll = useCallback(() => saveAllAttachments(), [saveAllAttachments]);
  const imgNext = useCallback(() => moveImageFocus("next"), [moveImageFocus]);
  const imgPrev = useCallback(() => moveImageFocus("prev"), [moveImageFocus]);
  const rsvpAccept = useCallback(() => rsvp("ACCEPTED"), [rsvp]);
  const rsvpTentative = useCallback(() => rsvp("TENTATIVE"), [rsvp]);

  // Determine which keybind set to render based on mode
  if (attachmentsFocused) {
    return (
      <>
        <Keybind keypress="j" onPress={attNext} />
        <Keybind keypress="down" onPress={attNext} />
        <Keybind keypress="k" onPress={attPrev} />
        <Keybind keypress="up" onPress={attPrev} />
        <Keybind keypress="return" onPress={handleOpenAttachment} />
        <Keybind keypress="o" onPress={handleOpenAttachment} />
        <Keybind keypress="s" onPress={handleSaveAttachment} />
        <Keybind keypress="shift+s" onPress={handleSaveAll} />
        <Keybind keypress="a" onPress={handleToggleAttachments} />
      </>
    );
  }

  if (imageNavMode && images && images.length > 0) {
    return (
      <>
        <Keybind keypress="tab" onPress={imgNext} />
        <Keybind keypress="shift+tab" onPress={imgPrev} />
        <Keybind keypress="j" onPress={scrollDown} />
        <Keybind keypress="down" onPress={scrollDown} />
        <Keybind keypress="k" onPress={scrollUp} />
        <Keybind keypress="up" onPress={scrollUp} />
        <Keybind keypress="escape" onPress={handleToggleImageNav} />
        <Keybind keypress="shift+i" onPress={handleToggleImageNav} />
      </>
    );
  }

  return (
    <>
      {/* Scroll */}
      <Keybind keypress="j" onPress={scrollDown} />
      <Keybind keypress="down" onPress={scrollDown} />
      <Keybind keypress="k" onPress={scrollUp} />
      <Keybind keypress="up" onPress={scrollUp} />
      <Keybind keypress="ctrl+d" onPress={pageDown} />
      <Keybind keypress="ctrl+u" onPress={pageUp} />
      <Keybind keypress="g" onPress={handleG} />
      <Keybind keypress="shift+g" onPress={scrollBottom} />

      {/* Focus */}
      <Keybind keypress="h" onPress={focusList} />
      <Keybind keypress="left" onPress={focusList} />
      <Keybind keypress="tab" onPress={handleToggleFocus} />
      <Keybind keypress="`" onPress={handleToggleFocus} />
      <Keybind keypress="escape" onPress={focusList} />

      {/* Email actions */}
      <Keybind keypress="s" onPress={handleToggleStar} />
      <Keybind keypress="e" onPress={handleArchive} />
      <Keybind keypress="shift+d" onPress={handleDelete} />
      <Keybind keypress="u" onPress={handleMarkUnread} />
      <Keybind keypress="n" onPress={nextEmail} />
      <Keybind keypress="p" onPress={prevEmail} />
      <Keybind keypress="r" onPress={handleReply} />
      <Keybind keypress="shift+r" onPress={handleReplyAll} />
      <Keybind keypress="f" onPress={handleForward} />
      <Keybind keypress="i" onPress={handleToggleHeaders} />
      <Keybind keypress="a" onPress={handleToggleAttachments} />

      {/* Image nav toggle */}
      {images && images.length > 0 && (
        <Keybind keypress="shift+i" onPress={handleToggleImageNav} />
      )}

      {/* Calendar RSVP */}
      {hasCalendarInvite && (
        <>
          <Keybind keypress="y" onPress={rsvpAccept} />
          <Keybind keypress="m" onPress={rsvpTentative} />
        </>
      )}

      {/* Global */}
      <Keybind keypress=":" onPress={handleOpenCommand} />
      <Keybind keypress="/" onPress={handleOpenSearch} />
      <Keybind keypress="?" onPress={handleOpenHelp} />
    </>
  );
}

function EmailHeader() {
  const email = useAtomValue(selectedEmailAtom);
  const expanded = useAtomValue(headersExpandedAtom);

  if (!email) return null;

  const fromDisplay = formatEmailAddress(email.from);
  const toDisplay = formatEmailAddresses(email.to);
  const dateDisplay = formatFullDate(email.date);

  return (
    <Box style={{ flexDirection: "column", gap: 0 }}>
      {/* Subject line - highlighted */}
      <Box style={{ flexDirection: "row", gap: 1, bg: "white", paddingX: 1 }}>
        {email.labelIds.includes("STARRED") && <Text>{icons.star}</Text>}
        <Text style={{ bold: true }}>{email.subject}</Text>
      </Box>

      {/* Collapsed: single line with from and toggle hint */}
      {!expanded && (
        <Box style={{ flexDirection: "row", paddingX: 1, borderBottomWidth: 1, borderStyle: "single", borderColor: "gray" }}>
          <Text dim>From: </Text>
          <Text>{fromDisplay}</Text>
          <Text style={{ flexGrow: 1 }}></Text>
          <Text dim>[i:expand]</Text>
        </Box>
      )}

      {/* Expanded: full meta info block */}
      {expanded && (
        <Box style={{ flexDirection: "column", paddingX: 1, paddingY: 1, borderBottomWidth: 1, borderStyle: "single", borderColor: "gray" }}>
          {/* From */}
          <Box style={{ flexDirection: "row" }}>
            <Text dim style={{ width: 6 }}>From: </Text>
            <Text>{fromDisplay}</Text>
            <Text dim> &lt;{email.from.email}&gt;</Text>
          </Box>

          {/* To */}
          <Box style={{ flexDirection: "row" }}>
            <Text dim style={{ width: 6 }}>To: </Text>
            <Text>{toDisplay}</Text>
          </Box>

          {/* CC if present */}
          {email.cc && email.cc.length > 0 && (
            <Box style={{ flexDirection: "row" }}>
              <Text dim style={{ width: 6 }}>Cc: </Text>
              <Text>{formatEmailAddresses(email.cc)}</Text>
            </Box>
          )}

          {/* Date */}
          <Box style={{ flexDirection: "row" }}>
            <Text dim style={{ width: 6 }}>Date: </Text>
            <Text>{dateDisplay}</Text>
          </Box>

          {/* Collapse hint */}
          <Box style={{ flexDirection: "row", justifyContent: "flex-end" }}>
            <Text dim>[i:collapse]</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}

function AttachmentsSection() {
  const email = useAtomValue(selectedEmailAtom);
  const attachmentsFocused = useAtomValue(attachmentsFocusedAtom);
  const selectedIndex = useAtomValue(selectedAttachmentIndexAtom);

  if (!email?.attachments?.length) return null;

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

  // Expanded: full list with focus trap
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
            {myStatus === "TENTATIVE" ? "~ Maybe" : "m:Maybe"}
          </Text>
        </Box>
      )}
      {isCancelled && <Text dim>This event has been cancelled.</Text>}
    </Box>
  );
}

// ===== Line System =====

interface ExpandedLine {
  type: "text" | "image-marker";
  content: string;
  originalIndex: number; // index in the original lines[]
  imageId?: string;
  linkHref?: string;
}

/** Split a rendered line around a URL, returning [before, after] */
function splitAroundUrl(content: string, href: string): [string, string] {
  const idx = content.indexOf(href);
  if (idx === -1) return [content, ""];
  return [content.slice(0, idx), content.slice(idx + href.length)];
}

function EmailBody({ availableHeight, viewFocused, onRenderResult }: { availableHeight: number; viewFocused: boolean; onRenderResult?: (result: RenderResult) => void }) {
  const email = useAtomValue(selectedEmailAtom);
  const scrollOffset = useAtomValue(viewScrollOffsetAtom);
  const setScrollOffset = useSetAtom(viewScrollOffsetAtom);
  const imageNavMode = useAtomValue(imageNavModeAtom);
  const focusedImageIdx = useAtomValue(focusedImageIndexAtom);
  const rsvp = useSetAtom(rsvpCalendarInviteAtom);
  const attachmentsFocused = useAtomValue(attachmentsFocusedAtom);
  const { columns: terminalWidth } = useApp();

  // Render email body through the pipeline (memoized)
  // When a calendar invite is present, skip HTML body (it's just the invite as a table)
  // and use the plain text body instead — the CalendarInviteSection already shows the details.
  const renderResult = useMemo(() => {
    if (!email) return null;

    const width = Math.max(40, terminalWidth - 6);
    if (email.bodyHtml && !email.calendarEvent) {
      return renderHtmlEmail(email.bodyHtml, width);
    }
    return renderPlainTextEmail(email.body);
  }, [email?.id, email?.bodyHtml, email?.body, email?.calendarEvent, terminalWidth]);

  // Notify parent of render result (for image list)
  useEffect(() => {
    if (renderResult && onRenderResult) {
      onRenderResult(renderResult);
    }
  }, [renderResult, onRenderResult]);

  // Build line list: mark image lines, attach link info to text lines
  const expandedLines: ExpandedLine[] = useMemo(() => {
    if (!renderResult) return [];

    const { lines, imageLineMap, linkLineMap, links } = renderResult;
    const result: ExpandedLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const imageId = imageLineMap.get(i);
      const linkId = linkLineMap.get(i);

      if (imageId) {
        result.push({
          type: "image-marker",
          content: lines[i] || " ",
          originalIndex: i,
          imageId,
        });
      } else {
        const link = linkId ? links.find(l => l.id === linkId) : undefined;
        result.push({
          type: "text",
          content: lines[i] || "",
          originalIndex: i,
          linkHref: link?.href,
        });
      }
    }

    return result;
  }, [renderResult]);

  if (!email || !renderResult) return null;

  const { images } = renderResult;

  const calendarEvent = email.calendarEvent;

  return (
    <Box style={{ flexGrow: 1, flexDirection: "column" }}>
      {/* Body content */}
      <FocusScope trap={imageNavMode}>
        <ScrollView
          style={{ height: availableHeight }}
          scrollOffset={scrollOffset}
          onScroll={setScrollOffset}
          disableKeyboard
          focusable={false}
          virtualized
        >
          {/* Calendar Invite (rendered above email body in the same scroll) */}
          {calendarEvent && (
            <CalendarInviteSection
              event={calendarEvent}
              inviteFocused={!attachmentsFocused && !imageNavMode}
              onRsvp={rsvp}
            />
          )}

          {expandedLines.map((item, index) => {
            const key = `${item.type}-${index}`;

            // Image line — use Glyph's native <Image> component
            if (item.type === "image-marker" && item.imageId) {
              const img = images.find(i => i.id === item.imageId);
              if (img?.src) {
                const label = img.alt || img.title || "image";
                return (
                  <Box key={key} style={{ flexDirection: "row" }}>
                    <Image
                      src={img.src}
                      placeholder={`${label}`}
                      placeholderStyle={{ paddingX: 1 }}
                      focusedStyle={{ bg: "blackBright" }}
                      style={{ border: "none" }}
                      autoLoad={false}
                      autoSize
                      maxHeight={20}
                    />
                  </Box>
                );
              }
            }

            // Text line with inline link — split around URL, focusable link
            if (item.linkHref) {
              const [before, after] = splitAroundUrl(item.content, item.linkHref);
              return (
                <Box key={key} style={{ flexDirection: "row" }}>
                  {before && <Text>{before}</Text>}
                  <InlineLink href={item.linkHref} active={viewFocused} />
                  {after && <Text>{after}</Text>}
                </Box>
              );
            }

            // Regular text line
            return (
              <Box key={key} style={{ flexDirection: "row" }}>
                <Text>{item.content || " "}</Text>
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

export function EmailView() {
  const { rows: terminalHeight } = useApp();
  const email = useAtomValue(selectedEmailAtom);
  const focus = useAtomValue(focusAtom);
  const headersExpanded = useAtomValue(headersExpandedAtom);
  const [currentImages, setCurrentImages] = React.useState<ExtractedImage[]>([]);

  const isFocused = focus === "view";

  // Calculate available height for the scrollable body area
  // Subject line (1) + header row(s) + border (1) + attachments + image hint (1) + padding
  const headerLines = headersExpanded ? 7 : 3; // subject + expanded/collapsed header + border
  const attachmentLines = email?.attachments?.length
    ? 1 + email.attachments.length
    : 0;
  const imageHintLine = 1;
  const chrome = headerLines + attachmentLines + imageHintLine + 2; // +2 for outer padding
  const availableHeight = Math.max(5, terminalHeight - chrome);

  const handleRenderResult = React.useCallback((result: RenderResult) => {
    setCurrentImages(result.images);
  }, []);

  return (
    <Box
      style={{
        flexGrow: 1,
        height: "100%",
        flexDirection: "column",
        paddingX: 1,
      }}
    >
      {/* Content */}
      <Box style={{ flexGrow: 1, flexDirection: "column", clip: true }}>
        {email ? (
          <>
            <EmailHeader />
            <AttachmentsSection />
            <EmailBody availableHeight={availableHeight} viewFocused={isFocused} onRenderResult={handleRenderResult} />
          </>
        ) : (
          <EmptyState />
        )}
      </Box>

      {/* Keybinds handler */}
      {isFocused && <ViewKeybinds images={currentImages} hasCalendarInvite={!!email?.calendarEvent} />}
    </Box>
  );
}
