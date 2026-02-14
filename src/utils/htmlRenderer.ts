import { marked, Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import TurndownService from "turndown";

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

let _imageCounter = 0;

/**
 * Extract <img> tags from HTML and replace them with numbered placeholders.
 * Returns the modified HTML and a list of extracted images.
 */
function extractImages(html: string): { html: string; images: ExtractedImage[] } {
  const images: ExtractedImage[] = [];
  _imageCounter = 0;

  const imgRegex = /<img\s+[^>]*?(?:src=["']([^"']*)["'])?[^>]*?(?:alt=["']([^"']*)["'])?[^>]*?(?:title=["']([^"']*)["'])?[^>]*?\/?>/gi;
  // Also match when alt comes before src
  const imgRegex2 = /<img\s+[^>]*?\/?>/gi;

  const modifiedHtml = html.replace(imgRegex2, (match) => {
    const srcMatch = match.match(/src=["']([^"']*?)["']/i);
    const altMatch = match.match(/alt=["']([^"']*?)["']/i);
    const titleMatch = match.match(/title=["']([^"']*?)["']/i);

    const src = srcMatch?.[1] || "";
    const alt = altMatch?.[1] || "image";
    const title = titleMatch?.[1];
    const id = `img-${++_imageCounter}`;
    const placeholder = `[IMG:${_imageCounter}] ${alt}`;

    images.push({ id, src, alt, title, placeholder });

    // Replace <img> with a placeholder text node
    return `<span class="img-placeholder" data-img-id="${id}">⬚ ${placeholder}</span>`;
  });

  return { html: modifiedHtml, images };
}

// ===== Layout Table Detection =====

/**
 * Heuristic: is this table actual tabular data (not layout)?
 *
 * Layout signals (→ unwrap):
 *   - role="presentation"
 *   - width="100%" or fixed email-width (500–800px)
 *   - ≤ 2 columns (sidebar + content, or spacer patterns)
 *   - cells contain block elements (<table>, <div>, <p>, <img>, etc.)
 *   - single row
 *
 * Data signals (→ keep):
 *   - has <th> elements
 *   - has <caption>
 *   - 3+ columns of short inline content
 *   - 2+ rows with consistent structure
 */
function isDataTable(attrs: string, inner: string): boolean {
  // role="presentation" → definitely layout
  if (/role=["']presentation["']/i.test(attrs)) return false;

  // Full-width or typical email-width → layout (attribute or inline style)
  if (/width=["']?\s*100%/i.test(attrs)) return false;
  if (/style=["'][^"']*width\s*:\s*100%/i.test(attrs)) return false;
  // 500–800px range is the classic email body width
  const widthMatch = attrs.match(/width=["']?\s*(\d+)/i);
  if (widthMatch) {
    const w = +(widthMatch[1] ?? "0");
    if (w >= 500 && w <= 800) return false;
  }

  // cellpadding / cellspacing present → layout (data tables rarely set these)
  if (/cellpadding|cellspacing/i.test(attrs)) return false;

  // <caption> → strong data signal
  if (/<caption[\s>]/i.test(inner)) return true;

  // Has <th> elements → strong data signal
  const hasTh = /<th[\s>]/i.test(inner);

  // Count columns in first row
  const firstRowMatch = inner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!firstRowMatch) return false; // empty table → layout

  const colCount = (firstRowMatch[1]?.match(/<t[dh][\s>]/gi) || []).length;

  // Single column → layout (wrapper pattern)
  if (colCount <= 1) return false;

  // 2 columns without headers → layout (label + value, sidebar + main)
  if (colCount === 2 && !hasTh) return false;

  // Headers + 2+ columns → data
  if (hasTh && colCount >= 2) return true;

  // 3+ columns — check if cells contain *structural* block elements
  // (table, div, section, article, etc. indicate layout; but img, p, br, b
  // are fine inside data table cells)
  const LAYOUT_BLOCK_RE = /<(table|div|ul|ol|blockquote|center|section|article|header|footer|nav|aside)\b/i;
  const cellContents = firstRowMatch[1]?.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
  for (const cell of cellContents) {
    const content = cell.replace(/<\/?td[^>]*>/gi, "");
    if (LAYOUT_BLOCK_RE.test(content)) return false;
  }

  // Count rows
  const rowCount = (inner.match(/<tr[\s>]/gi) || []).length;
  if (rowCount <= 1) return false; // single-row → layout spacer

  // 3+ columns, 2+ rows, inline-only content → data table
  return true;
}

/**
 * Detect and unwrap layout tables in email HTML.
 *
 * Works inside-out: finds the innermost <table> (no nested tables),
 * decides if it's layout, and replaces table tags with <div> blocks.
 * Repeats until only data tables remain.
 */
function unwrapLayoutTables(html: string): string {
  let h = html;
  const MAX_ITERATIONS = 50; // safety net for deeply nested emails

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    // Match innermost <table> — one that does NOT contain another <table>
    h = h.replace(
      /<table([^>]*)>((?:(?!<\/?table[\s>])[\s\S])*?)<\/table>/gi,
      (match, attrs: string, inner: string) => {
        if (isDataTable(attrs, inner)) return match;

        changed = true;

        // Unwrap: replace table structure tags with <div> blocks
        let u = inner;
        u = u.replace(/<\/?tbody[^>]*>/gi, "");
        u = u.replace(/<\/?thead[^>]*>/gi, "");
        u = u.replace(/<\/?tfoot[^>]*>/gi, "");
        u = u.replace(/<\/?colgroup[^>]*>/gi, "");
        u = u.replace(/<col[^>]*\/?>/gi, "");
        u = u.replace(/<tr[^>]*>/gi, "<div>");
        u = u.replace(/<\/tr>/gi, "</div>");
        u = u.replace(/<td[^>]*>/gi, "<div>");
        u = u.replace(/<\/td>/gi, "</div>");
        u = u.replace(/<th[^>]*>/gi, "<div>");
        u = u.replace(/<\/th>/gi, "</div>");
        return u;
      },
    );

    if (!changed) break;
  }

  return h;
}

// ===== HTML Pre-processing =====

/**
 * Pre-process email HTML before conversion.
 *
 * Order matters:
 *   1. Strip blocks that are entirely junk (<style>, <script>, <head>, comments)
 *   2. Remove hidden / invisible elements (while style= is still present)
 *   3. Remove tracking pixels
 *   4. Unwrap layout tables (needs attrs like role=, width= still present)
 *   5. Strip ALL class, id, style attributes from remaining tags
 *   6. Clean up whitespace artefacts
 */
export function sanitizeEmailHtml(html: string): string {
  let h = html;

  // ── 1. Remove entire junk blocks ──────────────────────────────────────

  // HTML comments (Outlook conditional blocks live here)
  h = h.replace(/<!--[\s\S]*?-->/g, "");

  // <style> blocks
  h = h.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // <script> blocks
  h = h.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // <head> blocks (meta, link, title…)
  h = h.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");

  // <xml> blocks (MS Office)
  h = h.replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, "");

  // <o:p> (Outlook paragraph wrappers)
  h = h.replace(/<\/?o:[^>]*>/gi, "");

  // ── 2. Remove hidden / invisible elements (need style= for detection) ─

  // Self-closing elements with display:none / visibility:hidden
  h = h.replace(/<[^>]+style=["'][^"']*display\s*:\s*none[^"']*["'][^>]*?\/?>/gi, "");
  h = h.replace(/<[^>]+style=["'][^"']*visibility\s*:\s*hidden[^"']*["'][^>]*?\/?>/gi, "");

  // Block elements with display:none + their content (div, span, td, p)
  // Uses a non-greedy match — won't catch deeply nested same-tag, but good enough
  for (const tag of ["div", "span", "td", "p", "table", "tr"]) {
    h = h.replace(
      new RegExp(`<${tag}[^>]+style=["'][^"']*display\\s*:\\s*none[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
    h = h.replace(
      new RegExp(`<${tag}[^>]+style=["'][^"']*visibility\\s*:\\s*hidden[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
    h = h.replace(
      new RegExp(`<${tag}[^>]+style=["'][^"']*font-size\\s*:\\s*0[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
    h = h.replace(
      new RegExp(`<${tag}[^>]+style=["'][^"']*max-height\\s*:\\s*0[^"']*["'][^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"),
      "",
    );
  }

  // ── 3. Remove tracking pixels ─────────────────────────────────────────

  // <img> with width="1" height="1" or width="0" (either order)
  h = h.replace(/<img\s+[^>]*?width=["']?[01](px)?["']?[^>]*?height=["']?[01](px)?["']?[^>]*?\/?>/gi, "");
  h = h.replace(/<img\s+[^>]*?height=["']?[01](px)?["']?[^>]*?width=["']?[01](px)?["']?[^>]*?\/?>/gi, "");

  // ── 4. Unwrap layout tables ──────────────────────────────────────────
  // Email HTML abuses <table> for layout (nested grids, sidebars, spacers).
  // Detect layout tables and replace with <div> blocks so that Turndown
  // only converts actual data tables to markdown tables.
  h = unwrapLayoutTables(h);

  // ── 5. Strip class, id, style, dir, align, bgcolor, data-* attributes ─

  // Remove style="..." (double or single quotes, or unquoted)
  h = h.replace(/\s+style=["'][^"']*["']/gi, "");
  h = h.replace(/\s+style=[^\s>]+/gi, "");

  // Remove class="..."
  h = h.replace(/\s+class=["'][^"']*["']/gi, "");
  h = h.replace(/\s+class=[^\s>]+/gi, "");

  // Remove id="..."
  h = h.replace(/\s+id=["'][^"']*["']/gi, "");
  h = h.replace(/\s+id=[^\s>]+/gi, "");

  // Remove dir="..."
  h = h.replace(/\s+dir=["'][^"']*["']/gi, "");

  // Remove align="..."
  h = h.replace(/\s+align=["'][^"']*["']/gi, "");

  // Remove bgcolor="..."
  h = h.replace(/\s+bgcolor=["'][^"']*["']/gi, "");

  // Remove data-* attributes
  h = h.replace(/\s+data-[\w-]+=["'][^"']*["']/gi, "");
  h = h.replace(/\s+data-[\w-]+=[^\s>]+/gi, "");

  // Remove role="..."
  h = h.replace(/\s+role=["'][^"']*["']/gi, "");

  // ── 6. Clean up whitespace artefacts ──────────────────────────────────

  // <wbr> tags (word break opportunities)
  h = h.replace(/<wbr\s*\/?>/gi, "");

  // Zero-width / invisible Unicode characters
  // U+200B zero-width space, U+200C zero-width non-joiner,
  // U+200D zero-width joiner, U+FEFF BOM / zero-width no-break space,
  // U+034F combining grapheme joiner (used as preheader padding),
  // U+00AD soft hyphen (used as preheader padding)
  h = h.replace(/[\u200B\u200C\u200D\uFEFF\u034F\u00AD]/g, "");

  // &nbsp; / &#160; → regular space
  h = h.replace(/&nbsp;/g, " ");
  h = h.replace(/&#160;/g, " ");

  // Katakana middle dot (U+30FB ・) and its HTML entity → regular separator
  // GitHub uses &#12539; in footers, which garbles in terminals
  h = h.replace(/&#12539;/g, " · ");
  h = h.replace(/\u30FB/g, " · ");

  // Collapse runs of whitespace within tags (e.g. `<td    >` → `<td>`)
  h = h.replace(/<(\w+)\s{2,}>/g, "<$1>");

  // ── 7. Remove email preheader / preview text ────────────────────────
  // Email clients add a "preview" or "preheader" at the top of the body.
  // It's normally hidden via CSS classes in <style> blocks, but since we
  // strip <style> in step 1, the hiding info is lost. Detect common patterns:

  // 7a. Strip all <span> / </span> tags (they're meaningless inline
  //     containers once class/style/id are gone — removing them also
  //     eliminates orphaned </span> from preheader structures)
  h = h.replace(/<\/?span[^>]*>/gi, "");

  // 7b. Remove text-only <div>s containing raw markdown bold (**text**)
  //     These are truncated plain-text preview summaries that duplicate
  //     the formatted HTML content below.
  h = h.replace(/<div>([^<]*)<\/div>/gi, (match, inner: string) => {
    const text = inner.trim();
    // Must have at least 2 **bold** patterns to be a markdown summary
    const boldCount = (text.match(/\*\*[^*]+\*\*/g) || []).length;
    if (boldCount >= 2) return "";
    // Also strip if content is only whitespace after invisible char removal
    if (text.length === 0) return "";
    return match;
  });

  // 7c. Remove divs that are now empty or contain only whitespace
  //     (preheader padding blocks become empty after invisible char stripping)
  h = h.replace(/<div[^>]*>\s*<\/div>/gi, "");

  return h;
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

      // Skip empty links / invisible links
      if (!text && !href) return "";
      if (!text || text === " ") {
        if (href) {
          try { return `[${new URL(href).hostname}]`; } catch { return ""; }
        }
        return "";
      }

      // If the link text IS the URL, show a shortened version
      if (text === href) {
        try {
          const u = new URL(href);
          return `${u.hostname}${u.pathname === "/" ? "" : u.pathname}`;
        } catch {
          return text;
        }
      }

      // For links with meaningful text: include the URL if it's "readable"
      // (short, not a tracking redirect with base64 gibberish)
      if (href && href.startsWith("http") && href.length < 80) {
        return `${text} (${href})`;
      }

      // For long/tracking URLs: just show the text, URL is lost
      // (acceptable trade-off — tracking URLs are not useful to the user)
      return text;
    },
  });

  // Preserve image placeholders — force them onto their own lines
  // so surrounding text is never swallowed when the UI replaces the line
  // with an Image component
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
      return `\n\n${text}\n\n`;
    },
  });

  // Strip tracking pixels (1x1 images, hidden images)
  td.addRule("trackingPixel", {
    filter: (node: any) => {
      if (node.nodeName !== "IMG") return false;
      const width = node.getAttribute?.("width");
      const height = node.getAttribute?.("height");
      // 1x1 images are tracking pixels
      if (width === "1" && height === "1") return true;
      if (width === "0" || height === "0") return true;
      // Hidden images
      const style = (node.getAttribute?.("style") || "") as string;
      if (style.includes("display:none") || style.includes("display: none")) return true;
      if (style.includes("visibility:hidden") || style.includes("visibility: hidden")) return true;
      return false;
    },
    replacement: () => "",
  });

  // Strip hidden elements (display:none, visibility:hidden, font-size:0)
  td.addRule("hiddenElements", {
    filter: (node: any) => {
      if (node.nodeType !== 1) return false; // Not an element
      const style = ((node.getAttribute?.("style") || "") as string).toLowerCase();
      if (style.includes("display:none") || style.includes("display: none")) return true;
      if (style.includes("visibility:hidden") || style.includes("visibility: hidden")) return true;
      if (style.includes("font-size:0") || style.includes("font-size: 0")) return true;
      if (style.includes("max-height:0") || style.includes("max-height: 0")) return true;
      return false;
    },
    replacement: () => "",
  });

  // === Data table handling (layout tables are already unwrapped to <div>s) ===
  // These rules only fire for genuine data tables that survived preprocessing.

  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => {
      const trimmed = content.trim().replace(/\n/g, " ");
      return ` ${trimmed} |`;
    },
  });

  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content) => `|${content}\n`,
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
    replacement: (content) => `\n\n${content}\n`,
  });

  // Strip <style> and <script> tags
  td.addRule("removeStyle", {
    filter: ["style", "script"],
    replacement: () => "",
  });

  // Strip empty divs (remnants of unwrapped layout table cells/rows)
  td.addRule("emptyDiv", {
    filter: (node: any) => {
      if (node.nodeName !== "DIV") return false;
      const text = ((node.textContent || "") as string).trim();
      return text.length === 0;
    },
    replacement: () => "",
  });

  // Handle divs (from unwrapped layout tables) as block containers.
  // Don't trim content — preserve \n\n paragraph breaks from inner <p> elements.
  // Only add a single \n boundary to avoid excessive spacing from nested divs.
  td.addRule("divBlock", {
    filter: (node: any) => {
      return node.nodeName === "DIV" && !node.getAttribute?.("class")?.includes("img-placeholder");
    },
    replacement: (content) => {
      // Check if there's any visible text (after stripping whitespace)
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
      // Colors / styles — keep minimal to match our flat terminal aesthetic
      width,
      reflowText: true,
      showSectionPrefix: false,
      unescape: true,
      emoji: false,
      tab: 2,
      // Override image handler to preserve our placeholders
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

/**
 * Render an HTML email body to terminal-formatted text.
 * 
 * Pipeline: HTML → extract images → turndown (MD) → marked-terminal → lines
 */
/** Regex to find URLs in rendered text (stripping ANSI codes first) */
const URL_REGEX = /https?:\/\/[^\s)\]>]+/g;

export function renderHtmlEmail(html: string, width: number = 80): RenderResult {
  // Step 0: Pre-process HTML to strip common email junk
  let cleanedHtml = sanitizeEmailHtml(html);

  // Step 1: Extract images and replace with placeholders
  const { html: processedHtml, images } = extractImages(cleanedHtml);

  // Step 2: Convert HTML to Markdown via Turndown
  const td = createTurndownService();
  const markdown = td.turndown(processedHtml);

  // Step 3: Render Markdown to terminal text via marked-terminal
  const markedInstance = createMarkedInstance(width);
  const terminalText = markedInstance.parse(markdown) as string;

  // Step 4: Post-process — collapse excessive blank lines, trim trailing whitespace
  const rawLines = terminalText.split("\n");
  const lines: string[] = [];
  let blankCount = 0;
  for (const line of rawLines) {
    const stripped = stripAnsi(line).trim();
    if (stripped === "") {
      blankCount++;
      // Allow at most 1 consecutive blank line (paragraph break)
      if (blankCount <= 1) lines.push(line);
    } else {
      blankCount = 0;
      lines.push(line);
    }
  }
  // Trim leading/trailing blank lines
  while (lines.length > 0 && stripAnsi(lines[0]!).trim() === "") lines.shift();
  while (lines.length > 0 && stripAnsi(lines[lines.length - 1]!).trim() === "") lines.pop();

  // Step 5: Split lines that mix text with image placeholders so each image
  // gets its own dedicated line (prevents surrounding text from being swallowed
  // when the UI replaces image lines with Image components).
  //
  // marked-terminal may reflow text so that an image placeholder and its alt
  // text end up on different lines. We match both:
  //   a) Known full placeholders: "⬚ [IMG:N] alt-text"
  //   b) Partial placeholders: "⬚ [IMG:N]" (alt text was reflowed to next line)
  const knownPlaceholders = images.map(img => `⬚ ${img.placeholder}`);
  const finalLines: string[] = [];
  for (const line of lines) {
    const clean = stripAnsi(line).trim();
    if (!clean.includes("⬚ [IMG:")) {
      finalLines.push(line);
      continue;
    }

    // Find all placeholder occurrences (try full match first, then partial)
    const found: { text: string; index: number }[] = [];
    let searchFrom = 0;
    while (searchFrom < clean.length) {
      // Try to match a known full placeholder at the earliest position
      let best: { text: string; index: number } | null = null;
      for (const ph of knownPlaceholders) {
        const idx = clean.indexOf(ph, searchFrom);
        if (idx !== -1 && (!best || idx < best.index)) {
          best = { text: ph, index: idx };
        }
      }
      // If no full placeholder, try partial "⬚ [IMG:N]" (without alt)
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

    // If line is exactly one placeholder, keep as-is
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

  // Re-trim after splitting
  while (finalLines.length > 0 && stripAnsi(finalLines[0]!).trim() === "") finalLines.shift();
  while (finalLines.length > 0 && stripAnsi(finalLines[finalLines.length - 1]!).trim() === "") finalLines.pop();

  // Step 6: Build image / link maps
  const imageLineMap = new Map<number, string>();
  const linkLineMap = new Map<number, string>();
  const links: ExtractedLink[] = [];
  let linkCounter = 0;

  // Match lines that ARE an image placeholder (full or partial, no extra text)
  const IMG_LINE_RE = /^⬚ \[IMG:(\d+)\]( .+)?$/;

  for (let i = 0; i < finalLines.length; i++) {
    const line = finalLines[i] || "";
    const cleanLine = stripAnsi(line).trim();

    // Only match lines that are entirely an image placeholder
    const imgMatch = cleanLine.match(IMG_LINE_RE);
    if (imgMatch) {
      const imgNum = parseInt(imgMatch[1]!, 10);
      const img = images.find((_, idx) => idx + 1 === imgNum);
      if (img) {
        imageLineMap.set(i, img.id);
      }
    }

    // Skip image lines for link detection
    if (imageLineMap.has(i)) continue;

    // Scan for URLs in the rendered line (strip ANSI first for clean matching)
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
 * Just splits into lines with no special processing.
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
