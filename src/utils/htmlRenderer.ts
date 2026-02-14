import { marked, Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import TurndownService from "turndown";
import * as cheerio from "cheerio";

// ===== Image Extraction =====

export interface ExtractedImage {
  id: string;
  src: string;
  alt: string;
  title?: string;
  /** Placeholder text used in the rendered body */
  placeholder: string;
}

// ===== Link Detection =====

export interface ExtractedLink {
  id: string;
  href: string;
  /** Line index in the rendered output */
  lineIndex: number;
}

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
 * This replaces the old regex-based sanitizeEmailHtml(), extractImages(),
 * and unwrapLayoutTables() with proper DOM operations via cheerio.
 *
 * Returns cleaned HTML and extracted images.
 */
export function preprocessEmailDom(html: string): {
  html: string;
  images: ExtractedImage[];
} {
  const $ = cheerio.load(html, { xmlMode: false } as any);
  const images: ExtractedImage[] = [];
  let imageCounter = 0;

  // ── 1. Remove junk blocks ──────────────────────────────────────
  $("style, script, head, xml").remove();
  // Outlook paragraph wrappers
  $("*").filter((_, el) => /^o:/i.test((el as any).tagName || "")).remove();
  // HTML comments are removed by cheerio's parser automatically

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

  // ── 4. Extract images → placeholders ───────────────────────────
  $("img").each((_, el) => {
    const $el = $(el);
    const src = $el.attr("src") || "";
    const alt = $el.attr("alt") || "image";
    const title = $el.attr("title");
    const id = `img-${++imageCounter}`;
    const placeholder = `[IMG:${imageCounter}] ${alt}`;

    images.push({ id, src, alt, title, placeholder });

    $el.replaceWith(
      `<span class="img-placeholder" data-img-id="${id}">⬚ ${placeholder}</span>`
    );
  });

  // ── 5. Unwrap layout tables (inside-out) ───────────────────────
  // Repeatedly find the innermost tables (those without nested tables)
  // and unwrap the layout ones. Data tables are left intact.
  const MAX_ITERATIONS = 50;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    // Find tables that don't contain nested tables (innermost first)
    $("table").each((_, el) => {
      const $table = $(el);
      if ($table.find("table").length > 0) return; // has nested tables, skip for now

      if (isDataTableEl($, $table)) return; // genuine data table

      unwrapLayoutTable($, $table);
      changed = true;
    });

    if (!changed) break;
  }

  // Any remaining tables that are layout wrappers around data tables:
  // Turndown rules will handle them (isInDataTable check).

  // ── 6. Strip junk attributes ───────────────────────────────────
  const STRIP_ATTRS = ["style", "id", "dir", "align", "bgcolor", "role"];
  $("*").each((_, el) => {
    const $el = $(el);
    for (const attr of STRIP_ATTRS) {
      $el.removeAttr(attr);
    }
    // Strip class (except our img-placeholder marker)
    const cls = $el.attr("class") || "";
    if (cls && cls !== "img-placeholder") {
      $el.removeAttr("class");
    }
    // Remove data-* attributes (except our data-img-id)
    const attribs = (el as any).attribs || {};
    for (const key of Object.keys(attribs)) {
      if (key.startsWith("data-") && key !== "data-img-id") {
        $el.removeAttr(key);
      }
    }
  });

  // ── 7. Clean up whitespace / text artefacts ────────────────────

  // Remove <wbr> tags
  $("wbr").remove();

  // Unwrap all <span> tags (meaningless inline containers without attributes)
  $("span").each((_, el) => {
    const $el = $(el);
    // Preserve our image placeholders
    if ($el.hasClass("img-placeholder")) return;
    $el.replaceWith($el.contents());
  });

  // Remove empty <div>s (remnants of unwrapped layout tables)
  $("div").each((_, el) => {
    const $el = $(el);
    if ($el.text().trim() === "" && $el.find("img, span.img-placeholder").length === 0) {
      $el.remove();
    }
  });

  // ── 8. Get the cleaned HTML ────────────────────────────────────
  let output = $("body").html() || $.html();

  // Text-level cleanup (these are simpler as string ops)
  // Zero-width / invisible Unicode characters
  output = output.replace(/[\u200B\u200C\u200D\uFEFF\u034F\u00AD]/g, "");
  // &nbsp; / &#160; → regular space
  output = output.replace(/&nbsp;/gi, " ");
  output = output.replace(/&#160;/g, " ");
  // Katakana middle dot
  output = output.replace(/&#12539;/g, " · ");
  output = output.replace(/\u30FB/g, " · ");

  return { html: output, images };
}

// ===== Turndown (HTML → Markdown) =====

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
    hr: "---",
  });

  // === Links: preserve readable URLs, hide ugly tracking URLs ===
  td.addRule("cleanLinks", {
    filter: "a",
    replacement: (content, node) => {
      const el = node as any;
      const href = (el.getAttribute?.("href") || el.href || "") as string;
      const text = content.trim();

      if (!text && !href) return "";
      if (!text || text === " ") {
        if (href) {
          try { return `[${new URL(href).hostname}]`; } catch { return ""; }
        }
        return "";
      }

      if (text === href) {
        try {
          const u = new URL(href);
          return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
        } catch {
          return text;
        }
      }

      if (href && href.startsWith("http") && href.length < 80) {
        return `${text} (${href})`;
      }

      return text;
    },
  });

  // === Image placeholder handling ===

  // Side-channel: images extracted from data table cells.
  const pendingTableImages: string[] = [];

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

  td.addRule("img-placeholder", {
    filter: (node: any) => {
      return (
        node.nodeName === "SPAN" &&
        node.getAttribute?.("class") === "img-placeholder"
      );
    },
    replacement: (_content, node) => {
      const el = node as any;
      const text = (el.textContent || "") as string;

      // Inside a data table cell → extract to side-channel
      if (isInDataTable(el)) {
        pendingTableImages.push(text);
        return "";
      }

      return `\n\n${text}\n\n`;
    },
  });

  // === Table handling ===
  // Data tables (with <th>) → markdown table syntax.
  // Layout tables that survived preprocessing → plain blocks.

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
      // Emit extracted table images after the table
      let suffix = "";
      if (pendingTableImages.length > 0) {
        suffix = "\n" + pendingTableImages.map(t => `\n${t}\n`).join("");
        pendingTableImages.length = 0;
      }
      return `\n\n${content}\n${suffix}`;
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
      return node.nodeName === "DIV" && !node.getAttribute?.("class")?.includes("img-placeholder");
    },
    replacement: (content) => {
      if (!content.replace(/\n/g, "").trim()) return "";
      return `\n${content}\n`;
    },
  });

  return td;
}

// ===== Marked + marked-terminal (Markdown → Terminal) =====

function createMarkedInstance(width: number = 80): Marked {
  const instance = new Marked();

  instance.use(
    markedTerminal({
      width,
      reflowText: true,
      showSectionPrefix: false,
      unescape: true,
      emoji: false,
      tab: 2,
      image: (_href: string, _title: string, text: string) => {
        return text || "";
      },
    })
  );

  return instance;
}

// ===== Main Rendering Pipeline =====

export interface RenderResult {
  /** Terminal-formatted text (with ANSI codes), split into lines */
  lines: string[];
  /** Extracted images with their positions */
  images: ExtractedImage[];
  /** Map from line index to image ID (for tabbable images) */
  imageLineMap: Map<number, string>;
  /** Extracted links with their positions */
  links: ExtractedLink[];
  /** Map from line index to link ID (for focusable links) */
  linkLineMap: Map<number, string>;
}

/** Regex to find URLs in rendered text (stripping ANSI codes first) */
const URL_REGEX = /https?:\/\/[^\s)\]>]+/g;

/**
 * Render an HTML email body to terminal-formatted text.
 *
 * Pipeline:
 *   1. DOM preprocessing (cheerio) — sanitize, extract images, unwrap layout tables
 *   2. Turndown — HTML → Markdown (with smart table/link/image rules)
 *   3. marked-terminal — Markdown → ANSI terminal text
 *   4. Post-processing — collapse blank lines, build image/link maps
 */
export function renderHtmlEmail(html: string, width: number = 80): RenderResult {
  // Step 1: DOM-based preprocessing
  const { html: cleanedHtml, images } = preprocessEmailDom(html);

  // Step 2: Convert HTML to Markdown via Turndown
  const td = createTurndownService();
  const markdown = td.turndown(cleanedHtml);

  // Step 3: Render Markdown to terminal text via marked-terminal
  const markedInstance = createMarkedInstance(width);
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

  // Step 5: Split lines that mix text with image placeholders
  const knownPlaceholders = images.map(img => `⬚ ${img.placeholder}`);
  const finalLines: string[] = [];
  for (const line of lines) {
    const clean = stripAnsi(line).trim();
    if (!clean.includes("⬚ [IMG:")) {
      finalLines.push(line);
      continue;
    }

    // Don't touch table rows (images already extracted at Turndown stage)
    if (/[│┌┐└┘├┤┬┴┼]/.test(clean)) {
      finalLines.push(line);
      continue;
    }

    // Find all placeholder occurrences
    const found: { text: string; index: number }[] = [];
    let searchFrom = 0;
    while (searchFrom < clean.length) {
      let best: { text: string; index: number } | null = null;
      for (const ph of knownPlaceholders) {
        const idx = clean.indexOf(ph, searchFrom);
        if (idx !== -1 && (!best || idx < best.index)) {
          best = { text: ph, index: idx };
        }
      }
      if (!best) {
        const partialMatch = clean.slice(searchFrom).match(/⬚ \[IMG:\d+\]/);
        if (partialMatch && partialMatch.index !== undefined) {
          best = { text: partialMatch[0]!, index: searchFrom + partialMatch.index };
        }
      }
      if (!best) break;
      found.push(best);
      searchFrom = best.index + best.text.length;
    }

    if (found.length === 0) {
      finalLines.push(line);
      continue;
    }

    if (found.length === 1 && clean.trim() === found[0]!.text) {
      finalLines.push(line);
      continue;
    }

    // Split around each placeholder
    let cursor = 0;
    for (const { text, index } of found) {
      const before = clean.slice(cursor, index).trim();
      if (before) finalLines.push(before);
      finalLines.push(text);
      cursor = index + text.length;
    }
    const after = clean.slice(cursor).trim();
    if (after) finalLines.push(after);
  }

  while (finalLines.length > 0 && stripAnsi(finalLines[0]!).trim() === "") finalLines.shift();
  while (finalLines.length > 0 && stripAnsi(finalLines[finalLines.length - 1]!).trim() === "") finalLines.pop();

  // Step 6: Build image / link maps
  const imageLineMap = new Map<number, string>();
  const linkLineMap = new Map<number, string>();
  const links: ExtractedLink[] = [];
  let linkCounter = 0;

  const IMG_LINE_RE = /^⬚ \[IMG:(\d+)\]( .+)?$/;

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i] || "";
    const cleanLine = stripAnsi(line).trim();

    const imgMatch = cleanLine.match(IMG_LINE_RE);
    if (imgMatch) {
      const imgNum = parseInt(imgMatch[1]!, 10);
      const img = images.find((_, idx) => idx + 1 === imgNum);
      if (img) {
        imageLineMap.set(i, img.id);
      }
    }

    if (imageLineMap.has(i)) continue;

    const cleanForUrl = stripAnsi(line);
    const urlMatch = cleanForUrl.match(URL_REGEX);
    if (urlMatch) {
      const id = `link-${++linkCounter}`;
      const href = urlMatch[0]!;
      links.push({ id, href, lineIndex: i });
      linkLineMap.set(i, id);
    }
  }

  return { lines: finalLines, images, imageLineMap, links, linkLineMap };
}

/**
 * Render a plain text email body (for emails without HTML).
 */
export function renderPlainTextEmail(text: string): RenderResult {
  return {
    lines: text.split("\n"),
    images: [],
    imageLineMap: new Map(),
    links: [],
    linkLineMap: new Map(),
  };
}

/**
 * Strip ANSI codes from a string (useful for length calculations).
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
