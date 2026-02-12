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

  // Preserve image placeholders
  td.addRule("img-placeholder", {
    filter: (node) => {
      return (
        node.nodeName === "SPAN" &&
        node.getAttribute("class") === "img-placeholder"
      );
    },
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      return el.textContent || "";
    },
  });

  // Better table handling — turndown-plugin-gfm-style
  // Turndown has basic table support but let's improve it
  td.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content, node) => {
      const el = node as HTMLElement;
      const trimmed = content.trim().replace(/\n/g, " ");
      return ` ${trimmed} |`;
    },
  });

  td.addRule("tableRow", {
    filter: "tr",
    replacement: (content) => {
      return `|${content}\n`;
    },
  });

  td.addRule("tableHead", {
    filter: "thead",
    replacement: (content) => {
      // Count columns from the first row
      const cols = (content.match(/\|/g) || []).length - 1;
      const separator = `|${Array(cols).fill(" --- ").join("|")}|\n`;
      return `${content}${separator}`;
    },
  });

  td.addRule("tableBody", {
    filter: "tbody",
    replacement: (content) => content,
  });

  td.addRule("table", {
    filter: "table",
    replacement: (content) => {
      return `\n${content}\n`;
    },
  });

  // Strip <style> and <script> tags
  td.addRule("removeStyle", {
    filter: ["style", "script"],
    replacement: () => "",
  });

  // Handle divs as paragraphs when they have meaningful content
  td.addRule("divBlock", {
    filter: (node) => {
      return node.nodeName === "DIV" && !node.getAttribute("class")?.includes("img-placeholder");
    },
    replacement: (content) => {
      const trimmed = content.trim();
      return trimmed ? `\n${trimmed}\n` : "";
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
  // Step 1: Extract images and replace with placeholders
  const { html: processedHtml, images } = extractImages(html);

  // Step 2: Convert HTML to Markdown via Turndown
  const td = createTurndownService();
  const markdown = td.turndown(processedHtml);

  // Step 3: Render Markdown to terminal text via marked-terminal
  const markedInstance = createMarkedInstance(width);
  const terminalText = markedInstance.parse(markdown) as string;

  // Step 4: Split into lines, build image line map
  const lines = terminalText.split("\n");
  const imageLineMap = new Map<number, string>();
  const linkLineMap = new Map<number, string>();
  const links: ExtractedLink[] = [];
  let linkCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || "";

    // Find image placeholders
    for (const img of images) {
      if (line.includes(`[IMG:`) || line.includes(img.placeholder) || line.includes(`⬚`)) {
        imageLineMap.set(i, img.id);
        break;
      }
    }

    // Skip image lines for link detection
    if (imageLineMap.has(i)) continue;

    // Scan for URLs in the rendered line (strip ANSI first for clean matching)
    const clean = stripAnsi(line);
    const urlMatch = clean.match(URL_REGEX);
    if (urlMatch) {
      const id = `link-${++linkCounter}`;
      const href = urlMatch[0]!;
      links.push({ id, href, lineIndex: i });
      linkLineMap.set(i, id);
    }
  }

  return { lines, images, imageLineMap, links, linkLineMap };
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
