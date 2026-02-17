import { marked, Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import TurndownService from "turndown";
import * as cheerio from "cheerio";

// ===== Line Parts (for inline rendering) =====

/**
 * A segment within a rendered line.
 * Lines can contain a mix of text, inline images, and links.
 */
export interface LinePart {
  type: "text" | "image" | "link";
  /** For text: the rendered text (may include ANSI codes). For image: the alt text. For link: the label. */
  content: string;
  /** For image: the source URL */
  src?: string;
  /** For image: alt text */
  alt?: string;
  /** For image in table lines: the character width the placeholder occupied in the table layout */
  tableWidth?: number;
  /** For link: the destination URL */
  href?: string;
}

// ===== Link Detection =====

export interface ExtractedLink {
  id: string;
  href: string;
  /** Human-readable label for the link */
  label: string;
  /** Line index in the rendered output */
  lineIndex: number;
}

// ===== Placeholder formats =====
//
// Images:  ⬚⟪index⟫⟪alt⟫   — index into imageRegistry
// Links:   🔗⟪index⟫⟪label⟫ — index into linkRegistry
//
// Both use compact index-based placeholders so they survive
// the Turndown → marked-terminal pipeline without mangling.

interface ImageRegistryEntry {
  src: string;
  alt: string;
}

interface LinkRegistryEntry {
  href: string;
  label: string;
}

/** Combined regex for image (⬚) and link (🔗) placeholders */
const PLACEHOLDER_RE = /(?:(⬚)|(🔗))⟪(\d+)⟫⟪([^⟫]*)⟫/g;

// ===== DOM-based HTML Preprocessing =====

/**
 * Heuristic: is this <table> element actual tabular data?
 *
 * Layout signals (→ unwrap):
 *   - role="presentation"
 *   - cellpadding / cellspacing
 *   - width="100%" or fixed email-width (500–800px)
 *   - ≤ 2 columns without headers
 *   - single row
 *
 * Data signals (→ keep):
 *   - has own <th> elements (strongest signal — overrides width)
 *   - has <caption>
 *   - 3+ columns of inline-only content
 *   - 2+ rows
 */
function isDataTableEl($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>): boolean {
  // ── Strongest signals ──────────────────────────────────────────
  if (el.attr("role") === "presentation") return false;
  if (el.attr("cellpadding") || el.attr("cellspacing")) return false;

  if (el.find("> caption").length > 0) return true;

  // Check for OWN <th> (not from nested tables)
  const ownTh = el.find("> thead th, > thead > tr > th, > tbody > tr > th, > tr > th");
  if (ownTh.length > 0) return true;

  // ── Width heuristics (only for tables without <th>) ──────────
  const widthAttr = el.attr("width") || "";
  const styleAttr = el.attr("style") || "";

  if (widthAttr.includes("100%") || /width\s*:\s*100%/i.test(styleAttr)) return false;

  const widthNum = parseInt(widthAttr, 10);
  if (widthNum >= 500 && widthNum <= 800) return false;

  // ── Column / row heuristics ──────────────────────────────────
  const firstRow = el.find("> tbody > tr, > tr").first();
  if (firstRow.length === 0) return false;

  const colCount = firstRow.find("> td, > th").length;
  if (colCount <= 1) return false;
  if (colCount === 2) return false;

  // 3+ columns — check for structural layout blocks in cells
  const LAYOUT_TAGS = new Set(["table", "div", "ul", "ol", "blockquote", "center", "section", "article", "header", "footer", "nav", "aside"]);
  let hasLayoutContent = false;
  firstRow.find("> td").each((_, cell) => {
    $(cell).children().each((_, child) => {
      if (LAYOUT_TAGS.has((child as any).tagName?.toLowerCase())) {
        hasLayoutContent = true;
      }
    });
  });
  if (hasLayoutContent) return false;

  const rowCount = el.find("> tbody > tr, > tr").length;
  if (rowCount <= 1) return false;

  return true;
}

/**
 * Unwrap a single layout table: replace <table>/<tr>/<td>/<th> with <div>s.
 */
function unwrapLayoutTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>) {
  // Remove structural wrapper elements
  table.find("tbody, thead, tfoot, colgroup, col").each((_, el) => {
    const $el = $(el);
    if (["tbody", "thead", "tfoot"].includes((el as any).tagName)) {
      $el.replaceWith($el.contents());
    } else {
      $el.remove();
    }
  });

  // Replace <tr>, <td>, <th> with <div>
  table.find("tr").each((_, el) => {
    const $el = $(el);
    const div = $("<div></div>");
    div.append($el.contents());
    $el.replaceWith(div);
  });
  table.find("td, th").each((_, el) => {
    const $el = $(el);
    const div = $("<div></div>");
    div.append($el.contents());
    $el.replaceWith(div);
  });

  // Replace the <table> itself with its contents
  table.replaceWith(table.contents());
}

/**
 * Pre-process email HTML using a real DOM.
 *
 * This sanitizes HTML, removes tracking pixels, unwraps layout tables,
 * and strips junk attributes — but leaves <img> tags intact for Turndown
 * to convert into standard markdown images `![alt](src)`.
 *
 * Returns cleaned HTML ready for Turndown.
 */
export function preprocessEmailDom(html: string): { html: string } {
  const $ = cheerio.load(html, { xmlMode: false } as any);

  // ── 1. Remove junk blocks ──────────────────────────────────────
  $("style, script, head, xml").remove();
  // Outlook paragraph wrappers
  $("*").filter((_, el) => /^o:/i.test((el as any).tagName || "")).remove();

  // ── 2. Remove hidden / invisible elements ──────────────────────
  $("*").each((_, el) => {
    const $el = $(el);
    const style = ($el.attr("style") || "").toLowerCase();

    if (
      style.includes("display:none") || style.includes("display: none") ||
      style.includes("visibility:hidden") || style.includes("visibility: hidden") ||
      style.includes("font-size:0") || style.includes("font-size: 0") ||
      style.includes("max-height:0") || style.includes("max-height: 0")
    ) {
      $el.remove();
    }
  });

  // ── 3. Remove tracking pixels ──────────────────────────────────
  $("img").each((_, el) => {
    const $el = $(el);
    const w = $el.attr("width");
    const h = $el.attr("height");
    const style = ($el.attr("style") || "").toLowerCase();

    const isTracker =
      (w === "1" && h === "1") ||
      w === "0" || h === "0" ||
      style.includes("display:none") || style.includes("display: none") ||
      style.includes("visibility:hidden") || style.includes("visibility: hidden");

    if (isTracker) $el.remove();
  });

  // ── 4. <img> tags are left intact for Turndown ─────────────────
  // Turndown will convert them to ![alt](src) markdown images.
  // marked-terminal's image handler will output our parseable placeholder.

  // ── 5. Unwrap layout tables (inside-out) ───────────────────────
  const MAX_ITERATIONS = 50;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    $("table").each((_, el) => {
      const $table = $(el);
      if ($table.find("table").length > 0) return;

      if (isDataTableEl($, $table)) return;

      unwrapLayoutTable($, $table);
      changed = true;
    });

    if (!changed) break;
  }

  // ── 6. Strip junk attributes (keep src, alt, title, href) ─────
  const STRIP_ATTRS = ["style", "id", "dir", "align", "bgcolor", "role"];
  $("*").each((_, el) => {
    const $el = $(el);
    for (const attr of STRIP_ATTRS) {
      $el.removeAttr(attr);
    }
    // Strip class on all elements
    $el.removeAttr("class");
    // Remove data-* attributes
    const attribs = (el as any).attribs || {};
    for (const key of Object.keys(attribs)) {
      if (key.startsWith("data-")) {
        $el.removeAttr(key);
      }
    }
  });

  // ── 7. Clean up whitespace / text artefacts ────────────────────
  $("wbr").remove();

  // Unwrap all <span> tags (meaningless inline containers without attributes)
  $("span").each((_, el) => {
    $(el).replaceWith($(el).contents());
  });

  // Remove empty <div>s (but keep ones that contain images)
  $("div").each((_, el) => {
    const $el = $(el);
    if ($el.text().trim() === "" && $el.find("img").length === 0) {
      $el.remove();
    }
  });

  // ── 8. Get the cleaned HTML ────────────────────────────────────
  let output = $("body").html() || $.html();

  // Text-level cleanup
  output = output.replace(/[\u200B\u200C\u200D\uFEFF\u034F\u00AD]/g, "");
  output = output.replace(/&nbsp;/gi, " ");
  output = output.replace(/&#160;/g, " ");
  output = output.replace(/&#12539;/g, " · ");
  output = output.replace(/\u30FB/g, " · ");

  return { html: output };
}

// ===== Turndown (HTML → Markdown) =====

function createTurndownService(linkRegistry: LinkRegistryEntry[]): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
    hr: "---",
  });

  // === Links: emit compact placeholders 🔗⟪index⟫⟪label⟫ ===
  // The URL is stored in the linkRegistry; only the label is visible.
  td.addRule("cleanLinks", {
    filter: "a",
    replacement: (content, node) => {
      const el = node as any;
      const href = (el.getAttribute?.("href") || el.href || "") as string;
      const text = content.trim();

      if (!text && !href) return "";

      // Link wraps an image (e.g. clickable banner) — let the image pass
      // through as-is and emit the link separately after it.
      if (/!\[.*?\]\(.*?\)/.test(text)) {
        if (href && href.startsWith("http")) {
          let linkLabel: string;
          try { linkLabel = new URL(href).hostname; } catch { linkLabel = "link"; }
          const idx = linkRegistry.length;
          linkRegistry.push({ href, label: linkLabel });
          return `${text}\n🔗⟪${idx}⟫⟪${linkLabel}⟫`;
        }
        return text;
      }

      // Determine a readable label
      let label = text;
      if (!label || label === " ") {
        if (href) {
          try { label = new URL(href).hostname; } catch { return ""; }
        } else {
          return "";
        }
      } else if (label === href) {
        // Text IS the URL — show a friendlier version
        try {
          const u = new URL(href);
          label = `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
        } catch { /* keep label as-is */ }
      }

      if (!href || !href.startsWith("http")) {
        return label;
      }

      // Store in registry and emit placeholder
      const idx = linkRegistry.length;
      linkRegistry.push({ href, label });
      return `🔗⟪${idx}⟫⟪${label}⟫`;
    },
  });

  // === Table handling ===
  // Data tables (with <th>) → markdown table syntax.
  // Layout tables that survived preprocessing → plain blocks.

  // Helper: check if a <table> node has its OWN <th> elements.
  const tableHasOwnTh = (tableNode: any): boolean => {
    for (const child of tableNode.childNodes || []) {
      const tag = (child.nodeName || "").toUpperCase();
      if (tag === "THEAD") {
        for (const row of child.childNodes || []) {
          if ((row.nodeName || "").toUpperCase() === "TR") {
            for (const cell of row.childNodes || []) {
              if ((cell.nodeName || "").toUpperCase() === "TH") return true;
            }
          }
        }
      }
      if (tag === "TR") {
        for (const cell of child.childNodes || []) {
          if ((cell.nodeName || "").toUpperCase() === "TH") return true;
        }
      }
      if (tag === "TBODY" || tag === "TFOOT") {
        for (const row of child.childNodes || []) {
          if ((row.nodeName || "").toUpperCase() === "TR") {
            for (const cell of row.childNodes || []) {
              if ((cell.nodeName || "").toUpperCase() === "TH") return true;
            }
          }
        }
      }
    }
    return false;
  };

  // Helper: walk up to find closest <table> ancestor and check if data table.
  const isInDataTable = (node: any): boolean => {
    let parent = node.parentNode;
    while (parent) {
      if (parent.nodeName === "TABLE") {
        return tableHasOwnTh(parent);
      }
      parent = parent.parentNode;
    }
    return false;
  };

  // === Images ===
  // All images flow through Turndown's default: <img> → ![alt](src).
  // marked-terminal's image handler then converts them to compact
  // index-based placeholders ⬚⟪N⟫⟪alt⟫ that work even inside table cells.

  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content, node: any) => {
      if (!isInDataTable(node)) {
        const trimmed = content.trim();
        return trimmed ? `\n${trimmed}\n` : "";
      }
      const trimmed = content.trim().replace(/\n/g, " ");
      return ` ${trimmed} |`;
    },
  });

  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content, node: any) => {
      if (!isInDataTable(node)) return content;
      return `|${content}\n`;
    },
  });

  td.addRule("tableHead", {
    filter: "thead",
    replacement: (content) => {
      const cols = (content.match(/\|/g) || []).length - 1;
      const separator = `|${Array(Math.max(cols, 1)).fill(" --- ").join("|")}|\n`;
      return `${content}${separator}`;
    },
  });

  td.addRule("tableBody", {
    filter: "tbody",
    replacement: (content) => content,
  });

  td.addRule("table", {
    filter: "table",
    replacement: (content, node: any) => {
      if (!tableHasOwnTh(node)) {
        if (!content.replace(/\n/g, "").trim()) return "";
        return `\n${content}\n`;
      }
      return `\n\n${content}\n`;
    },
  });

  // Strip <style> and <script> (safety net — should already be removed by DOM pass)
  td.addRule("removeStyle", {
    filter: ["style", "script"],
    replacement: () => "",
  });

  // Strip empty divs
  td.addRule("emptyDiv", {
    filter: (node: any) => {
      if (node.nodeName !== "DIV") return false;
      const text = ((node.textContent || "") as string).trim();
      return text.length === 0;
    },
    replacement: () => "",
  });

  // Divs as block containers (from unwrapped layout tables).
  td.addRule("divBlock", {
    filter: (node: any) => {
      return node.nodeName === "DIV";
    },
    replacement: (content) => {
      if (!content.replace(/\n/g, "").trim()) return "";
      return `\n${content}\n`;
    },
  });

  return td;
}

// ===== Marked + marked-terminal (Markdown → Terminal) =====

function createMarkedInstance(width: number, imageRegistry: ImageRegistryEntry[]): Marked {
  const instance = new Marked();

  instance.use(
    markedTerminal({
      width,
      reflowText: true,
      showSectionPrefix: false,
      unescape: true,
      emoji: false,
      tab: 2,
      image: (href: string, _title: string, text: string) => {
        // Store image in registry and output a compact index-based placeholder.
        // This keeps placeholders short (critical for table cells!) while
        // preserving the src URL for the UI to render <Image> components.
        const alt = text || "image";
        const idx = imageRegistry.length;
        imageRegistry.push({ src: href, alt });
        return `⬚⟪${idx}⟫⟪${alt}⟫`;
      },
    })
  );

  return instance;
}

// ===== Line segment parsing =====

// Box-drawing characters used by marked-terminal for tables.
export const TABLE_CHARS_RE = /[│┌┐└┘├┤┬┴┼─]/;

/**
 * Parse a rendered line into segments of text, inline images, and links.
 *
 * Placeholders are split out as separate parts:
 *   - Image: ⬚⟪index⟫⟪alt⟫  → { type: "image", src, alt }
 *   - Link:  🔗⟪index⟫⟪label⟫ → { type: "link", href, content: label }
 *
 * For table lines (containing box-drawing characters), images get a `tableWidth`
 * property so the renderer can pad them to preserve column alignment.
 */
export function parseLineSegments(
  rawLine: string,
  imageRegistry: ImageRegistryEntry[],
  linkRegistry: LinkRegistryEntry[] = [],
): LinePart[] {
  const clean = stripAnsi(rawLine);

  // Fast path: no placeholders on this line
  if (!clean.includes("⬚⟪") && !clean.includes("🔗⟪")) {
    return [{ type: "text", content: rawLine }];
  }

  const isTableLine = TABLE_CHARS_RE.test(clean);

  // Parse all placeholders (images + links) in a single pass
  const parts: LinePart[] = [];
  let lastIndex = 0;

  for (const match of clean.matchAll(new RegExp(PLACEHOLDER_RE.source, "g"))) {
    const matchIndex = match.index!;
    const isImage = !!match[1]; // ⬚
    // const isLink = !!match[2]; // 🔗
    const idx = parseInt(match[3]!, 10);
    const text = match[4] || "";

    // Text before this placeholder
    if (matchIndex > lastIndex) {
      const textBefore = clean.slice(lastIndex, matchIndex);
      if (textBefore.trim()) {
        parts.push({ type: "text", content: textBefore });
      }
    }

    if (isImage) {
      const entry = imageRegistry[idx];
      const alt = text || entry?.alt || "image";
      const src = entry?.src || "";
      parts.push({
        type: "image",
        content: alt,
        src,
        alt,
        tableWidth: isTableLine ? match[0].length : undefined,
      });
    } else {
      // Link placeholder
      const entry = linkRegistry[idx];
      const label = text || entry?.label || "";
      const href = entry?.href || "";
      parts.push({
        type: "link",
        content: label,
        href,
      });
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Remaining text after last placeholder
  if (lastIndex < clean.length) {
    const textAfter = clean.slice(lastIndex);
    if (textAfter.trim()) {
      parts.push({ type: "text", content: textAfter });
    }
  }

  return parts.length > 0 ? parts : [{ type: "text", content: rawLine }];
}

// ===== Main Rendering Pipeline =====

export interface RenderResult {
  /** Terminal-formatted text (with ANSI codes), split into lines */
  lines: string[];
  /** Each line parsed into segments (text + inline images + links) */
  parsedLines: LinePart[][];
  /** Extracted links with their positions (for link navigation) */
  links: ExtractedLink[];
}

/**
 * Render an HTML email body to terminal-formatted text.
 *
 * Pipeline:
 *   1. DOM preprocessing (cheerio) — sanitize, remove tracking pixels, unwrap layout tables
 *   2. Turndown — HTML → Markdown (images become ![alt](src), links become 🔗⟪index⟫⟪label⟫)
 *   3. marked-terminal — Markdown → ANSI terminal text (images become ⬚⟪index⟫⟪alt⟫)
 *   4. Post-processing — collapse blank lines, parse inline segments, build link list
 */
export function renderHtmlEmail(html: string, width: number = 80): RenderResult {
  // Step 1: DOM-based preprocessing (leaves <img> intact)
  const { html: cleanedHtml } = preprocessEmailDom(html);

  // Step 2: Convert HTML to Markdown via Turndown
  // Link registry collects href+label; placeholders use compact 🔗⟪index⟫⟪label⟫ format
  const linkRegistry: LinkRegistryEntry[] = [];
  const td = createTurndownService(linkRegistry);
  const markdown = td.turndown(cleanedHtml);

  // Step 3: Render Markdown to terminal text via marked-terminal
  // Image registry collects src URLs; placeholders use compact ⬚⟪index⟫⟪alt⟫ format
  const imageRegistry: ImageRegistryEntry[] = [];
  const markedInstance = createMarkedInstance(width, imageRegistry);
  const terminalText = markedInstance.parse(markdown) as string;

  // Step 4: Collapse excessive blank lines
  const rawLines = terminalText.split("\n");
  const lines: string[] = [];
  let blankCount = 0;
  for (const line of rawLines) {
    const stripped = stripAnsi(line).trim();
    if (stripped === "") {
      blankCount++;
      if (blankCount <= 1) lines.push(line);
    } else {
      blankCount = 0;
      lines.push(line);
    }
  }
  while (lines.length > 0 && stripAnsi(lines[0]!).trim() === "") lines.shift();
  while (lines.length > 0 && stripAnsi(lines[lines.length - 1]!).trim() === "") lines.pop();

  // Step 5: Parse each line into segments (text + images + links)
  const parsedLines: LinePart[][] = lines.map(line =>
    parseLineSegments(line, imageRegistry, linkRegistry),
  );

  // Step 6: Build link list from parsed link parts (for link navigation)
  const links: ExtractedLink[] = [];
  let linkCounter = 0;

  for (let i = 0; i < parsedLines.length; i++) {
    for (const part of parsedLines[i]!) {
      if (part.type === "link" && part.href) {
        const id = `link-${++linkCounter}`;
        links.push({ id, href: part.href, label: part.content, lineIndex: i });
      }
    }
  }

  return { lines, parsedLines, links };
}

/**
 * Render a plain text email body (for emails without HTML).
 */
export function renderPlainTextEmail(text: string): RenderResult {
  const lines = text.split("\n");
  return {
    lines,
    parsedLines: lines.map(l => [{ type: "text" as const, content: l }]),
    links: [],
  };
}

/**
 * Strip ANSI codes from a string (useful for length calculations).
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
