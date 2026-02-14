import { test, expect } from "bun:test";
import { renderHtmlEmail, preprocessEmailDom, stripAnsi } from "../src/utils/htmlRenderer.ts";
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

test("preprocessEmailDom removes the raw-markdown preview div", () => {
  const { html: sanitized } = preprocessEmailDom(html);

  // The email has a duplicate: first a raw inline text version with markdown-like **bold**,
  // then the proper HTML version. The raw text block should be stripped or at least
  // shouldn't produce duplicate content.
  const count = (sanitized.match(/Here's what you'll find in this issue/g) || []).length;

  // Ideally 1, but we need to look at the rendered output to confirm
  console.log(`"Here's what you'll find" appears ${count} time(s) in preprocessed HTML`);
});

test("renderHtmlEmail produces clean markdown output", () => {
  const result = renderHtmlEmail(html, 80);
  const plainLines = result.lines.map(l => stripAnsi(l));
  const fullText = plainLines.join("\n");

  console.log("=== RENDERED OUTPUT (plain text, no ANSI) ===");
  console.log(fullText);
  console.log("=== END ===");
  console.log(`Total lines: ${result.lines.length}`);
  console.log(`Images: ${result.images.length}`);
  console.log(`Links: ${result.links.length}`);

  // Content checks
  expect(fullText).toContain("Five Flops, Then $23K MRR");
  expect(fullText).toContain("Vibe coding tools to try");
  expect(fullText).toContain("Bite-sized growth tip");
  expect(fullText).toContain("Augment Code");
  expect(fullText).toContain("Rob Hallam failed with five products");

  // marked-terminal renders <strong> as **bold** — that's correct.
  // What we DON'T want is the raw text-preview duplicate showing literal
  // \*\*bold\*\* (backslash-escaped asterisks from Turndown escaping).
  expect(fullText).not.toMatch(/\\\*\\\*This founder hit\\\*\\\*/);

  // Should NOT have excessive blank lines (max 1 blank line between sections)
  expect(fullText).not.toMatch(/\n\n\n/);

  // Should NOT have the invisible preheader content
  expect(fullText).not.toContain("͏");

  // Text lines must NOT be swallowed by image placeholder lines
  expect(fullText).toContain("Here's what you'll find in this issue:");

  // Image placeholders should be on their own dedicated lines
  for (let i = 0; i < plainLines.length; i++) {
    const line = plainLines[i]!.trim();
    if (line.match(/^⬚ \[IMG:\d+\]/)) {
      const matches = line.match(/⬚ \[IMG:\d+\]/g);
      expect(matches?.length).toBe(1);
    }
  }
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
      image: (_href: string, _title: string, text: string) => text || "",
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

  // Should contain the key content
  expect(fullText).toContain("[semos-labs/glyph] Test workflow run");
  expect(fullText).toContain("All jobs were successful");
  expect(fullText).toContain("View workflow run");
  // marked-terminal may reflow "Succeeded in 14 seconds" across lines
  expect(fullText).toMatch(/Succeeded in 14\s+seconds/);

  // Address should be readable, not garbled
  expect(fullText).toContain("GitHub, Inc.");

  // Should NOT have raw markdown table pipes leaking through
  expect(fullText).not.toMatch(/\|\s*Status\s*\|\s*Job\s*\|\s*Annotations\s*\|/);

  // Should NOT have excessive blank lines
  expect(fullText).not.toMatch(/\n\n\n\n/);
});
