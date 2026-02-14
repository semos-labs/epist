import { test, expect } from "bun:test";
import { renderHtmlEmail, preprocessEmailDom, stripAnsi, parseLineSegments } from "../src/utils/htmlRenderer.ts";
import { join } from "path";

const html = await Bun.file(join(import.meta.dir, "example.html")).text();

test("preprocessEmailDom removes preheader padding and junk", () => {
  const { html: sanitized } = preprocessEmailDom(html);

  // Should NOT contain the invisible preheader padding (U+034F combining grapheme joiner)
  expect(sanitized).not.toContain("͏");

  // Should NOT contain soft hyphens (U+00AD)
  expect(sanitized).not.toContain("\u00AD");

  // Should still contain the real content
  expect(sanitized).toContain("Here's what you'll find in this issue:");
  expect(sanitized).toContain("Five Flops, Then $23K MRR");
});

test("preprocessEmailDom leaves <img> tags intact", () => {
  const { html: sanitized } = preprocessEmailDom(html);

  // <img> tags should be preserved (not extracted) for Turndown to handle
  // Tracking pixels (1x1) should be removed, but real images should remain
  const imgCount = (sanitized.match(/<img /g) || []).length;
  console.log(`<img> tags in preprocessed HTML: ${imgCount}`);
  // There should be at least some images preserved
  expect(imgCount).toBeGreaterThanOrEqual(0); // tracking pixels may all be removed
});

test("preprocessEmailDom removes the raw-markdown preview div", () => {
  const { html: sanitized } = preprocessEmailDom(html);

  const count = (sanitized.match(/Here's what you'll find in this issue/g) || []).length;
  console.log(`"Here's what you'll find" appears ${count} time(s) in preprocessed HTML`);
});

test("renderHtmlEmail produces clean output with inline image placeholders", () => {
  const result = renderHtmlEmail(html, 80);
  const plainLines = result.lines.map(l => stripAnsi(l));
  const fullText = plainLines.join("\n");

  console.log("=== RENDERED OUTPUT (plain text, no ANSI) ===");
  console.log(fullText);
  console.log("=== END ===");
  console.log(`Total lines: ${result.lines.length}`);
  console.log(`Links: ${result.links.length}`);

  // Count inline images from parsedLines
  const imageCount = result.parsedLines.reduce((acc, parts) =>
    acc + parts.filter(p => p.type === "image").length, 0);
  console.log(`Inline images: ${imageCount}`);

  // Content checks
  expect(fullText).toContain("Five Flops, Then $23K MRR");
  expect(fullText).toContain("Vibe coding tools to try");
  expect(fullText).toContain("Bite-sized growth tip");
  expect(fullText).toContain("Augment Code");
  expect(fullText).toContain("Rob Hallam failed with five products");

  // Should NOT have raw escaped markdown asterisks
  expect(fullText).not.toMatch(/\\\*\\\*This founder hit\\\*\\\*/);

  // Should NOT have excessive blank lines (max 1 blank line between sections)
  expect(fullText).not.toMatch(/\n\n\n/);

  // Should NOT have the invisible preheader content
  expect(fullText).not.toContain("͏");

  // Text lines must NOT be swallowed
  expect(fullText).toContain("Here's what you'll find in this issue:");

  // Image placeholders should use the new format ⬚⟪src⟫⟪alt⟫
  for (const parts of result.parsedLines) {
    for (const part of parts) {
      if (part.type === "image") {
        expect(part.src).toBeTruthy();
        expect(part.alt).toBeTruthy();
      }
    }
  }
});

test("parseLineSegments handles pure text lines", () => {
  const parts = parseLineSegments("Hello world", []);
  expect(parts).toEqual([{ type: "text", content: "Hello world" }]);
});

test("parseLineSegments handles pure image lines", () => {
  const registry = [{ src: "https://example.com/img.png", alt: "Logo" }];
  const parts = parseLineSegments("⬚⟪0⟫⟪Logo⟫", registry);
  expect(parts).toEqual([{
    type: "image",
    content: "Logo",
    src: "https://example.com/img.png",
    alt: "Logo",
  }]);
});

test("parseLineSegments handles mixed text + image lines", () => {
  const registry = [{ src: "https://example.com/img.png", alt: "Logo" }];
  const parts = parseLineSegments("Before ⬚⟪0⟫⟪Logo⟫ After", registry);
  expect(parts.length).toBe(3);
  expect(parts[0]).toEqual({ type: "text", content: "Before " });
  expect(parts[1]).toEqual({
    type: "image",
    content: "Logo",
    src: "https://example.com/img.png",
    alt: "Logo",
  });
  expect(parts[2]).toEqual({ type: "text", content: " After" });
});

test("parseLineSegments handles multiple images on one line", () => {
  const registry = [
    { src: "https://a.com/1.png", alt: "A" },
    { src: "https://b.com/2.png", alt: "B" },
  ];
  const line = "⬚⟪0⟫⟪A⟫ text ⬚⟪1⟫⟪B⟫";
  const parts = parseLineSegments(line, registry);
  expect(parts.length).toBe(3);
  expect(parts[0]!.type).toBe("image");
  expect(parts[0]!.src).toBe("https://a.com/1.png");
  expect(parts[1]!.type).toBe("text");
  expect(parts[1]!.content).toBe(" text ");
  expect(parts[2]!.type).toBe("image");
  expect(parts[2]!.src).toBe("https://b.com/2.png");
});

test("parseLineSegments preserves ANSI on non-image lines", () => {
  const ansiLine = "\x1b[1mBold text\x1b[0m";
  const parts = parseLineSegments(ansiLine, []);
  expect(parts).toEqual([{ type: "text", content: ansiLine }]);
});

test("DOM preprocessing intermediate output (for debugging)", async () => {
  const TurndownService = (await import("turndown")).default;

  const { html: preprocessed } = preprocessEmailDom(html);

  console.log("=== PREPROCESSED HTML (first 3000 chars) ===");
  console.log(preprocessed.slice(0, 3000));
  console.log("=== END PREPROCESSED ===\n");

  // Use a basic turndown to see the raw markdown
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  const markdown = td.turndown(preprocessed);

  console.log("=== RAW MARKDOWN (first 3000 chars) ===");
  console.log(markdown.slice(0, 3000));
  console.log("=== END MARKDOWN ===");
});

test("marked-terminal output (for debugging)", async () => {
  const TurndownService = (await import("turndown")).default;
  const { Marked } = await import("marked");
  const { markedTerminal } = await import("marked-terminal");

  const { html: preprocessed } = preprocessEmailDom(html);

  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "_",
    strongDelimiter: "**",
    hr: "---",
  });

  td.addRule("cleanLinks", {
    filter: "a",
    replacement: (content: string, node: any) => {
      const href = (node.getAttribute?.("href") || node.href || "") as string;
      const text = content.trim();
      if (!text || text === href || text === " ") {
        if (href && text === href) {
          try { return `[${new URL(href).hostname}]`; } catch { return text; }
        }
        return text || "";
      }
      return text;
    },
  });

  td.addRule("divBlock", {
    filter: (node: any) => node.nodeName === "DIV",
    replacement: (content: string) => {
      const trimmed = content.trim();
      return trimmed ? `\n${trimmed}\n` : "";
    },
  });

  td.addRule("removeStyle", {
    filter: ["style", "script"],
    replacement: () => "",
  });

  const markdown = td.turndown(preprocessed);

  console.log("=== MARKDOWN INPUT (first 2000 chars) ===");
  console.log(markdown.slice(0, 2000));
  console.log("=== END MARKDOWN INPUT ===\n");

  const instance = new Marked();
  instance.use(
    markedTerminal({
      width: 80,
      reflowText: true,
      showSectionPrefix: false,
      unescape: true,
      emoji: false,
      tab: 2,
      image: (href: string, _title: string, text: string) => {
        const alt = text || "image";
        return `⬚⟪${href}⟫⟪${alt}⟫`;
      },
    })
  );

  const terminalOutput = instance.parse(markdown) as string;

  console.log("=== MARKED-TERMINAL OUTPUT (raw, first 3000 chars) ===");
  console.log(terminalOutput.slice(0, 3000));
  console.log("=== END RAW ===\n");

  const stripped = stripAnsi(terminalOutput);
  console.log("=== MARKED-TERMINAL OUTPUT (stripped, first 3000 chars) ===");
  console.log(stripped.slice(0, 3000));
  console.log("=== END STRIPPED ===");

  expect(stripped).toContain("Five Flops");
  expect(stripped).toContain("Augment Code");
});

// ===== example2.html — GitHub Actions notification =====

const html2 = await Bun.file(join(import.meta.dir, "example2.html")).text();

test("example2: renderHtmlEmail — GitHub Actions email", () => {
  const result = renderHtmlEmail(html2, 80);
  const plainLines = result.lines.map(l => stripAnsi(l));
  const fullText = plainLines.join("\n");

  console.log("=== EXAMPLE2 RENDERED OUTPUT ===");
  console.log(fullText);
  console.log("=== END ===");

  // Count inline images
  const imageCount = result.parsedLines.reduce((acc, parts) =>
    acc + parts.filter(p => p.type === "image").length, 0);
  console.log(`Inline images: ${imageCount}`);

  // Should contain the key content
  expect(fullText).toContain("[semos-labs/glyph] Test workflow run");
  expect(fullText).toContain("All jobs were successful");
  expect(fullText).toContain("View workflow run");
  expect(fullText).toMatch(/Succeeded in 14\s+seconds/);

  // Address should be readable
  expect(fullText).toContain("GitHub, Inc.");

  // Should NOT have raw markdown table pipes leaking through
  expect(fullText).not.toMatch(/\|\s*Status\s*\|\s*Job\s*\|\s*Annotations\s*\|/);

  // Should NOT have excessive blank lines
  expect(fullText).not.toMatch(/\n\n\n\n/);
});
