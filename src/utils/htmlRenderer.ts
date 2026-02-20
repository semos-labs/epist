import TurndownService from "turndown";
import { tables as turndownTables } from "@truto/turndown-plugin-gfm";
import * as cheerio from "cheerio";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent } from "mdast";

// ===== Exported types =====

export type { Root, RootContent, PhrasingContent } from "mdast";

export interface ExtractedLink {
  id: string;
  href: string;
  /** Human-readable label for the link */
  label: string;
  /** Sequential index in the flat link list */
  lineIndex: number;
}

export interface EmailRenderResult {
  /** Parsed markdown AST */
  root: Root;
  /** All links found in the content (for Tab-navigation) */
  links: ExtractedLink[];
}

// ===== Mdast helpers =====

const remarkParser = unified().use(remarkParse).use(remarkGfm);

function parseMarkdown(md: string): Root {
  return remarkParser.parse(md);
}

/** Extract plain text content from any mdast node */
export function getTextContent(node: any): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value || "";
  if (node.type === "break") return "\n";
  if (node.children) return node.children.map(getTextContent).join("");
  return "";
}

/** Walk the mdast tree and collect all links */
export function extractLinks(root: Root): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  function walk(node: any) {
    if (node.type === "link") {
      let label = getTextContent(node).replace(/\s+/g, " ").trim();
      if (!label) {
        try { label = new URL(node.url).hostname; } catch { label = node.url; }
      }
      links.push({
        id: `link-${links.length}`,
        href: node.url,
        label,
        lineIndex: links.length,
      });
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(root);
  return links;
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
 * Shallow-unwrap a single layout table: replace only THIS table's own
 * structural elements (<tr>, <td>, <th>) with <div>s — nested child
 * tables (data tables) are left untouched.
 */
function unwrapLayoutTable($: cheerio.CheerioAPI, table: cheerio.Cheerio<any>) {
  // 1. Unwrap direct structural wrappers (tbody/thead/tfoot/colgroup/col)
  table.children("tbody, thead, tfoot").each((_, el) => {
    $(el).replaceWith($(el).contents());
  });
  table.children("colgroup, col").remove();

  // 2. Replace this table's own <tr> and their direct <td>/<th> with <div>
  //    (children() only selects direct children, preserving nested tables)
  table.children("tr").each((_, el) => {
    const $row = $(el);
    $row.children("td, th").each((_, cell) => {
      const $cell = $(cell);
      const div = $("<div></div>");
      div.append($cell.contents());
      $cell.replaceWith(div);
    });
    const div = $("<div></div>");
    div.append($row.contents());
    $row.replaceWith(div);
  });

  // 3. Replace the <table> itself with its contents
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

  // ── 5. Unwrap layout tables ─────────────────────────────────────
  // Shallow-unwrap: each pass only touches the table's own rows/cells,
  // so nested data tables survive.  Iterate until stable.
  const MAX_ITERATIONS = 50;
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;

    $("table").each((_, el) => {
      const $table = $(el);
      if (isDataTableEl($, $table)) return; // keep genuine data tables

      unwrapLayoutTable($, $table);
      changed = true;
    });

    if (!changed) break;
  }

  // ── 6. Extract color info, then strip junk attributes ─────────
  // Before stripping styles, extract meaningful color from inline elements
  // and preserve it as a data-color attribute for downstream rendering.
  const INLINE_TAGS = new Set(["SPAN", "FONT", "B", "I", "EM", "STRONG", "U", "S", "A", "TD", "TH", "P", "LI", "DIV", "H1", "H2", "H3", "H4", "H5", "H6"]);
  $("*").each((_, el) => {
    const $el = $(el);
    const tag = ((el as any).tagName || "").toUpperCase();
    const style = $el.attr("style") || "";

    // Extract color from inline style
    const colorMatch = style.match(/(?:^|;)\s*color\s*:\s*([^;!]+)/i);
    if (colorMatch && INLINE_TAGS.has(tag)) {
      const colorVal = colorMatch[1]!.trim();
      if (colorVal) {
        $el.attr("data-color", colorVal);
      }
    }

    // Also check <font color="..."> attribute
    const fontColor = $el.attr("color");
    if (fontColor && tag === "FONT") {
      $el.attr("data-color", fontColor);
    }
  });

  const STRIP_ATTRS = ["style", "id", "dir", "align", "bgcolor", "role", "color"];
  $("*").each((_, el) => {
    const $el = $(el);
    for (const attr of STRIP_ATTRS) {
      $el.removeAttr(attr);
    }
    // Strip class on all elements
    $el.removeAttr("class");
    // Remove data-* attributes EXCEPT data-color
    const attribs = (el as any).attribs || {};
    for (const key of Object.keys(attribs)) {
      if (key.startsWith("data-") && key !== "data-color") {
        $el.removeAttr(key);
      }
    }
  });

  // ── 7. Clean up whitespace / text artefacts ────────────────────
  $("wbr").remove();

  // Unwrap <span> tags — but keep colored spans (they carry data-color)
  $("span").each((_, el) => {
    const $el = $(el);
    if ($el.attr("data-color")) return; // keep colored spans
    $el.replaceWith($el.contents());
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

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
    hr: "---",
  });

  // === Links: emit standard markdown links with clean labels ===
  td.addRule("cleanLinks", {
    filter: "a",
    replacement: (content, node) => {
      const el = node as any;
      const href = (el.getAttribute?.("href") || el.href || "") as string;
      const text = content.trim();

      if (!text && !href) return "";

      // Link wraps an image — let image through, add separate link below
      if (/!\[.*?\]\(.*?\)/.test(text)) {
        if (href && href.startsWith("http")) {
          let linkLabel: string;
          try { linkLabel = new URL(href).hostname; } catch { linkLabel = "link"; }
          const safeLabel = linkLabel.replace(/[\[\]]/g, "");
          return `${text}\n[${safeLabel}](<${href}>)`;
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

      // Emit standard markdown link — use angle brackets to handle URLs with parens
      const safeLabel = label.replace(/[\[\]]/g, "\\$&");
      return `[${safeLabel}](<${href}>)`;
    },
  });

  // === Colored inline elements: preserve as inline HTML for remark ===
  // Spans/fonts with data-color survive preprocessing.
  // Emit them as <span data-color="...">content</span> inline HTML
  // so remark keeps them and the renderer can extract colors.
  td.addRule("coloredInline", {
    filter: (node: any) => {
      const tag = (node.nodeName || "").toUpperCase();
      return (tag === "SPAN" || tag === "FONT") && !!node.getAttribute?.("data-color");
    },
    replacement: (content, node) => {
      const el = node as any;
      const color = (el.getAttribute?.("data-color") || "") as string;
      if (!content.trim() || !color) return content;
      // Emit inline HTML — remark will preserve this as html phrasing nodes
      return `<span data-color="${color}">${content}</span>`;
    },
  });

  // === Table handling ===
  // Use @truto/turndown-plugin-gfm for robust GFM table conversion.
  // Layout tables are already unwrapped in preprocessEmailDom, so
  // only genuine data tables reach Turndown.
  td.use(turndownTables);

  // Strip <style> and <script> (safety net)
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

  // Divs as block containers
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

// ===== Main Rendering Pipeline =====

// Singleton Turndown service (no mutable state unlike before)
const turndownService = createTurndownService();

/**
 * Render an HTML email body to a markdown AST.
 *
 * Pipeline:
 *   1. DOM preprocessing (cheerio) — sanitize, remove tracking pixels, unwrap layout tables
 *   2. Turndown — HTML → Markdown (standard syntax, no placeholders)
 *   3. remark — Markdown → mdast (abstract syntax tree)
 *   4. Extract links for Tab-navigation
 */
export function htmlToMdast(html: string): EmailRenderResult {
  // Step 1: DOM-based preprocessing
  const { html: cleanedHtml } = preprocessEmailDom(html);

  // Step 2: Convert HTML to Markdown via Turndown
  const markdown = turndownService.turndown(cleanedHtml);

  // Step 3: Parse Markdown to mdast via remark
  const root = parseMarkdown(markdown);

  // Step 4: Extract links for navigation
  const links = extractLinks(root);

  return { root, links };
}

/**
 * Parse a plain text email body into a markdown AST.
 * Plain text is parsed through remark so that any natural markdown-like
 * formatting (lists, emphasis, URLs) is preserved.
 */
export function textToMdast(text: string): EmailRenderResult {
  const root = parseMarkdown(text);
  const links = extractLinks(root);
  return { root, links };
}

/**
 * Strip ANSI codes from a string (useful for length calculations).
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
