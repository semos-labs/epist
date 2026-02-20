import React, { useMemo } from "react";
import {
  Box,
  Text,
  Image,
  Link,
  Table as GlyphTable,
  TableRow,
  TableHeaderRow,
  TableCell,
} from "@semos-labs/glyph";
import type {
  Root,
  RootContent,
  PhrasingContent,
  Table,
  Paragraph,
  Heading,
  Blockquote,
  List,
  ListItem,
  Code,
} from "mdast";
import { getTextContent } from "../utils/htmlRenderer.ts";

// ===== CSS → Terminal color mapping =====

const NAMED_COLORS: Record<string, string> = {
  red: "red", darkred: "red", crimson: "red", firebrick: "red", indianred: "red",
  blue: "blue", darkblue: "blue", navy: "blue", royalblue: "blue", mediumblue: "blue",
  green: "green", darkgreen: "green", forestgreen: "green", seagreen: "green", limegreen: "greenBright",
  yellow: "yellow", gold: "yellow", goldenrod: "yellow", darkgoldenrod: "yellow",
  orange: "yellow", darkorange: "yellow", orangered: "red",
  magenta: "magenta", fuchsia: "magenta", purple: "magenta", darkmagenta: "magenta",
  violet: "magenta", darkviolet: "magenta", blueviolet: "magenta", mediumpurple: "magenta",
  cyan: "cyan", teal: "cyan", aqua: "cyan", darkcyan: "cyan",
  white: "white", whitesmoke: "white", ghostwhite: "white",
  gray: "blackBright", grey: "blackBright", silver: "blackBright",
  darkgray: "blackBright", darkgrey: "blackBright", dimgray: "blackBright",
  lightgray: "white", lightgrey: "white",
  coral: "red", salmon: "red", tomato: "red",
  pink: "magenta", hotpink: "magenta", deeppink: "magenta",
  skyblue: "cyanBright", deepskyblue: "cyanBright", lightblue: "cyanBright",
  lime: "greenBright", springgreen: "greenBright", chartreuse: "greenBright",
};

function rgbToTerminal(r: number, g: number, b: number): string | undefined {
  // Very dark — default terminal color (don't override)
  if (r < 40 && g < 40 && b < 40) return undefined;
  // Very light — white
  if (r > 210 && g > 210 && b > 210) return "white";

  const max = Math.max(r, g, b);
  if (max < 60) return "blackBright";

  // Dominant channel heuristics
  if (r > g * 1.8 && r > b * 1.8) return "red";
  if (g > r * 1.8 && g > b * 1.8) return "green";
  if (b > r * 1.8 && b > g * 1.8) return "blue";
  if (r > b * 1.5 && g > b * 1.5) return "yellow";
  if (r > g * 1.5 && b > g * 1.5) return "magenta";
  if (g > r * 1.5 && b > r * 1.5) return "cyan";

  if (max > 180) return "white";
  return "blackBright";
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Map a CSS color value to a Glyph terminal color name */
export function cssColorToTerminal(cssColor: string): string | undefined {
  if (!cssColor) return undefined;
  const lower = cssColor.toLowerCase().trim();

  // Named colors
  if (lower in NAMED_COLORS) return NAMED_COLORS[lower];

  // Hex colors
  const hexMatch = lower.match(/^#([0-9a-f]{3,8})$/);
  if (hexMatch) {
    let hex = hexMatch[1]!;
    if (hex.length === 3) hex = hex[0]! + hex[0]! + hex[1]! + hex[1]! + hex[2]! + hex[2]!;
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return rgbToTerminal(r, g, b);
    }
  }

  // rgb() / rgba()
  const rgbMatch = lower.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return rgbToTerminal(+rgbMatch[1]!, +rgbMatch[2]!, +rgbMatch[3]!);
  }

  // hsl() / hsla()
  const hslMatch = lower.match(/hsla?\s*\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/);
  if (hslMatch) {
    const [r, g, b] = hslToRgb(+hslMatch[1]!, +hslMatch[2]!, +hslMatch[3]!);
    return rgbToTerminal(r, g, b);
  }

  return undefined;
}

// ===== Inline segment types =====

interface TextSegment {
  type: "text";
  value: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  color?: string;
}

interface LinkSegment {
  type: "link";
  value: string;
  href: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

interface ImageSegment {
  type: "image";
  src: string;
  alt: string;
}

type InlineSegment = TextSegment | LinkSegment | ImageSegment;

interface StyleCtx {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  color?: string;
}

// ===== Inline flattening =====

/** Parse inline HTML tags to extract color markers */
const COLOR_OPEN_RE = /<span\s+data-color="([^"]+)"\s*>/i;
const COLOR_CLOSE_RE = /^<\/span\s*>$/i;

/**
 * Flatten an array of phrasing content nodes into a flat segment list.
 * Handles inline HTML `<span data-color="...">` nodes to track color state
 * across sibling boundaries.
 */
function flattenChildren(nodes: PhrasingContent[], baseStyle: StyleCtx = {}): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const colorStack: (string | undefined)[] = [];

  for (const node of nodes) {
    // Current effective color: top of stack or base
    const currentColor = colorStack.length > 0 ? colorStack[colorStack.length - 1] : baseStyle.color;
    const currentStyle: StyleCtx = { ...baseStyle, color: currentColor };

    if (node.type === "html") {
      // Check for color open/close tags
      const openMatch = (node as any).value?.match(COLOR_OPEN_RE);
      if (openMatch) {
        const termColor = cssColorToTerminal(openMatch[1]);
        colorStack.push(termColor);
        continue;
      }
      const isClose = COLOR_CLOSE_RE.test((node as any).value || "");
      if (isClose && colorStack.length > 0) {
        colorStack.pop();
        continue;
      }
      // Other inline HTML — skip
      continue;
    }

    segments.push(...flattenInline(node, currentStyle));
  }

  return segments;
}

/**
 * Flatten a single inline node into segments.
 * For nodes with children (strong, emphasis, link), recurses with updated style.
 */
function flattenInline(node: PhrasingContent, style: StyleCtx = {}): InlineSegment[] {
  switch (node.type) {
    case "text":
      return [{ type: "text", value: node.value, ...style }];
    case "strong":
      return flattenChildren(node.children, { ...style, bold: true });
    case "emphasis":
      return flattenChildren(node.children, { ...style, italic: true });
    case "delete":
      return flattenChildren((node as any).children || [], { ...style, strikethrough: true });
    case "link": {
      // Collapse whitespace/newlines — <br> inside links shouldn't cause 2-row spans
      let label = getTextContent(node).replace(/\s+/g, " ").trim();
      if (!label) {
        try { label = new URL(node.url).hostname; } catch { label = node.url; }
      }
      return [{ type: "link", value: label, href: node.url, bold: style.bold, italic: style.italic, color: style.color }];
    }
    case "image":
      return [{ type: "image", src: node.url, alt: node.alt || "image" }];
    case "inlineCode":
      return [{ type: "text", value: node.value, ...style, code: true }];
    case "break":
      return [{ type: "text", value: "\n" }];
    case "html":
      // Inline HTML that isn't a color marker — skip
      return [];
    default:
      return [];
  }
}

/** Merge adjacent text segments with identical styling */
function mergeSegments(segments: InlineSegment[]): InlineSegment[] {
  const merged: InlineSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (
      seg.type === "text" && last?.type === "text" &&
      seg.bold === last.bold && seg.italic === last.italic &&
      seg.code === last.code && seg.strikethrough === last.strikethrough &&
      seg.color === last.color
    ) {
      last.value += seg.value;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

// ===== Inline rendering =====

function StyledText({ seg }: { seg: TextSegment }) {
  if (seg.code) {
    return <Text style={{ color: "yellow" }}>{seg.value}</Text>;
  }
  return (
    <Text
      style={{
        bold: seg.bold || undefined,
        dim: seg.strikethrough || undefined,
        italic: seg.italic || undefined,
        color: seg.color as any || undefined,
      }}
    >
      {seg.strikethrough && !seg.value.startsWith("~~") ? `~~${seg.value}~~` : seg.value}
    </Text>
  );
}

function MdInlineLink({ seg, linkIndex, activeLinkIndex, disabled }: {
  seg: LinkSegment;
  linkIndex: number;
  activeLinkIndex: number;
  disabled: boolean;
}) {
  const isActive = linkIndex === activeLinkIndex;
  return (
    <Link
      href={seg.href}
      disabled={disabled}
      style={{
        underline: true,
        color: isActive ? "black" : (seg.color as any || "cyan"),
        ...(isActive && { bg: "cyan" }),
      }}
      focusedStyle={!isActive ? { bg: "blackBright" } : undefined}
    >
      <Text style={{ bold: seg.bold || undefined, italic: seg.italic || undefined }}>
        {seg.value}
      </Text>
    </Link>
  );
}

/**
 * Render inline content (children of a paragraph, heading, etc.)
 * Always produces a flat row of <Text>, <Link>, <Image> siblings inside a <Box>.
 * Glyph does NOT support nested <Text> for styling — every styled run must be
 * its own top-level <Text> element inside a <Box>.
 */
function InlineContent({ children, linkCounter, activeLinkIndex, linkIndexOffset, disabled, baseColor }: {
  children: PhrasingContent[];
  linkCounter: { count: number };
  activeLinkIndex: number;
  linkIndexOffset: number;
  disabled: boolean;
  baseColor?: string;
}) {
  const segments = mergeSegments(flattenChildren(children, { color: baseColor }));

  return (
    <Box style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {segments.map((seg, i) => {
        if (seg.type === "text") return <StyledText key={i} seg={seg} />;
        if (seg.type === "link") {
          const idx = linkIndexOffset + linkCounter.count;
          linkCounter.count++;
          return (
            <MdInlineLink
              key={i}
              seg={seg}
              linkIndex={idx}
              activeLinkIndex={activeLinkIndex}
              disabled={disabled}
            />
          );
        }
        if (seg.type === "image") {
          return (
            <Image
              key={i}
              src={seg.src}
              placeholder={seg.alt}
              placeholderStyle={{ paddingX: 1 }}
              focusedStyle={{ bg: "blackBright" }}
              style={{ border: "none" }}
              autoLoad={false}
              autoSize
              maxHeight={20}
              disabled={disabled}
            />
          );
        }
        return null;
      })}
    </Box>
  );
}

// ===== Block-level rendering =====

interface BlockProps {
  linkCounter: { count: number };
  activeLinkIndex: number;
  linkIndexOffset: number;
  viewFocused: boolean;
}

function MdBlock({ node, ...props }: { node: RootContent } & BlockProps) {
  switch (node.type) {
    case "paragraph":
      return <MdParagraph node={node} {...props} />;
    case "heading":
      return <MdHeading node={node} {...props} />;
    case "blockquote":
      return <MdBlockquote node={node} {...props} />;
    case "list":
      return <MdList node={node} {...props} />;
    case "listItem":
      return <MdListItem node={node} {...props} />;
    case "code":
      return <MdCode node={node} />;
    case "thematicBreak":
      return <Text style={{ dim: true }}>{"─".repeat(40)}</Text>;
    case "table":
      return <MdTable node={node} {...props} />;
    case "html":
      // Block-level raw HTML remnants — ignore
      return null;
    default:
      return null;
  }
}

function MdParagraph({ node, ...props }: { node: Paragraph } & BlockProps) {
  // Check if paragraph contains ONLY images (common in email: standalone banners)
  const allImages = node.children.length > 0 && node.children.every(
    c => c.type === "image" || (c.type === "text" && !c.value.trim()),
  );

  if (allImages) {
    return (
      <Box style={{ flexDirection: "column" }}>
        {node.children.map((child, i) => {
          if (child.type === "image") {
            return (
              <Image
                key={i}
                src={child.url}
                placeholder={child.alt || "image"}
                placeholderStyle={{ paddingX: 1 }}
                focusedStyle={{ bg: "blackBright" }}
                style={{ border: "none" }}
                autoLoad={false}
                autoSize
                maxHeight={20}
                disabled={!props.viewFocused}
              />
            );
          }
          return null;
        })}
      </Box>
    );
  }

  return (
    <InlineContent
      children={node.children}
      linkCounter={props.linkCounter}
      activeLinkIndex={props.activeLinkIndex}
      linkIndexOffset={props.linkIndexOffset}
      disabled={!props.viewFocused}
    />
  );
}

function MdHeading({ node, ...props }: { node: Heading } & BlockProps) {
  // Headings render bold + colored — h1 magenta, others green (like marked-terminal)
  const headingColor = node.depth === 1 ? "magenta" : "green";

  // Wrap children in a synthetic strong node for bold
  const boldChildren: PhrasingContent[] = [{
    type: "strong",
    children: node.children,
  }];

  return (
    <InlineContent
      children={boldChildren}
      linkCounter={props.linkCounter}
      activeLinkIndex={props.activeLinkIndex}
      linkIndexOffset={props.linkIndexOffset}
      disabled={!props.viewFocused}
      baseColor={headingColor}
    />
  );
}

function MdBlockquote({ node, ...props }: { node: Blockquote } & BlockProps) {
  const [expanded, setExpanded] = React.useState(false);
  const childCount = node.children.length;

  if (!expanded) {
    return (
      <Box style={{ flexDirection: "row" }}>
        <Text style={{ dim: true }}>
          ··· {childCount} quoted {childCount === 1 ? "block" : "blocks"} ···
        </Text>
      </Box>
    );
  }

  return (
    <Box style={{ flexDirection: "column", paddingLeft: 2 }}>
      <Box style={{ flexDirection: "row" }}>
        <Text style={{ dim: true }}>··· quoted text ···</Text>
      </Box>
      {node.children.map((child, i) => (
        <Box key={i} style={{ flexDirection: "row" }}>
          <Text style={{ dim: true, color: "blackBright" as any }}>│ </Text>
          <Box style={{ flexDirection: "column", flexShrink: 1 }}>
            <MdBlock node={child} {...props} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function MdList({ node, ...props }: { node: List } & BlockProps) {
  return (
    <Box style={{ flexDirection: "column", paddingLeft: 2 }}>
      {node.children.map((item, i) => {
        const bullet = node.ordered ? `${(node.start || 1) + i}. ` : "• ";
        return (
          <Box key={i} style={{ flexDirection: "row" }}>
            <Text>{bullet}</Text>
            <Box style={{ flexDirection: "column", flexShrink: 1 }}>
              {item.children.map((child, ci) => (
                <MdBlock key={ci} node={child} {...props} />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function MdListItem({ node, ...props }: { node: ListItem } & BlockProps) {
  const bullet = node.checked != null
    ? (node.checked ? "[x] " : "[ ] ")
    : "• ";
  return (
    <Box style={{ flexDirection: "row" }}>
      <Text>{bullet}</Text>
      <Box style={{ flexDirection: "column", flexShrink: 1 }}>
        {node.children.map((child, i) => (
          <MdBlock key={i} node={child} {...props} />
        ))}
      </Box>
    </Box>
  );
}

function MdCode({ node }: { node: Code }) {
  return (
    <Box style={{ paddingLeft: 2 }}>
      <Text style={{ color: "yellow" as any }}>{node.value}</Text>
    </Box>
  );
}

/**
 * Table renderer using Glyph's native Table components.
 *
 * Every cell is rendered via InlineContent so images, links, bold, etc. all
 * work. Glyph handles borders, alignment, and column sizing natively.
 */
function MdTable({ node, ...props }: { node: Table } & BlockProps) {
  const rows = node.children;
  if (rows.length === 0) return null;

  // mdast alignment array — maps to TableCell `align` prop
  const alignments = node.align || [];

  const renderRow = (row: (typeof rows)[number], ri: number) => {
    const isHeader = ri === 0 && rows.length > 1;
    const Row = isHeader ? TableHeaderRow : TableRow;

    return (
      <Row key={ri}>
        {row.children.map((cell, ci) => {
          const cellAlign = alignments[ci] || undefined;
          // For cells with non-text content (images), hint the min width
          const hasImage = cell.children.some(c => c.type === "image");

          return (
            <TableCell
              key={ci}
              align={cellAlign as any}
              minWidth={hasImage ? 12 : undefined}
            >
              <InlineContent
                children={cell.children}
                linkCounter={props.linkCounter}
                activeLinkIndex={props.activeLinkIndex}
                linkIndexOffset={props.linkIndexOffset}
                disabled={!props.viewFocused}
              />
            </TableCell>
          );
        })}
      </Row>
    );
  };

  return (
    <GlyphTable borderColor="blackBright">
      {rows.map((row, ri) => renderRow(row, ri))}
    </GlyphTable>
  );
}

// ===== Main exported component =====

export interface MarkdownRendererProps {
  root: Root;
  linkIndexOffset: number;
  activeLinkIndex: number;
  viewFocused: boolean;
}

export const MarkdownRenderer = React.memo(function MarkdownRenderer({
  root,
  linkIndexOffset,
  activeLinkIndex,
  viewFocused,
}: MarkdownRendererProps) {
  // Mutable counter that tracks the next link index during render.
  // Reset on each render by recreating the object when root changes.
  const linkCounter = useMemo(() => ({ count: 0 }), [root]);
  linkCounter.count = 0;

  return (
    <Box style={{ flexDirection: "column" }}>
      {root.children.map((node, i) => (
        <MdBlock
          key={i}
          node={node}
          linkCounter={linkCounter}
          activeLinkIndex={activeLinkIndex}
          linkIndexOffset={linkIndexOffset}
          viewFocused={viewFocused}
        />
      ))}
    </Box>
  );
});
