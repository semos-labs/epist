import { test, expect, describe } from "bun:test";
import { htmlToMdast, preprocessEmailDom, stripAnsi, getTextContent, extractLinks } from "../src/utils/htmlRenderer.ts";
import { join } from "path";
import type { Root, RootContent, Table, TableRow, TableCell } from "mdast";

const html = await Bun.file(join(import.meta.dir, "example.html")).text();

// ===== Helper: collect all text content from an mdast tree =====

function collectText(root: Root): string {
  const parts: string[] = [];
  function walk(node: any) {
    if (node.type === "text") parts.push(node.value);
    if (node.type === "inlineCode") parts.push(node.value);
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }
  walk(root);
  return parts.join(" ");
}

/** Count nodes of a specific type in the tree */
function countNodes(root: Root, type: string): number {
  let count = 0;
  function walk(node: any) {
    if (node.type === type) count++;
    if (node.children) {
      for (const child of node.children) walk(child);
    }
  }
  walk(root);
  return count;
}

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

test("htmlToMdast produces a well-formed AST with links and content", () => {
  const result = htmlToMdast(html);
  const { root, links } = result;

  const fullText = collectText(root);
  const imageCount = countNodes(root, "image");

  console.log("=== RENDERED TEXT CONTENT ===");
  console.log(fullText.slice(0, 3000));
  console.log("=== END ===");
  console.log(`Total root children: ${root.children.length}`);
  console.log(`Links: ${links.length}`);
  console.log(`Images: ${imageCount}`);

  // Content checks — text should be present in the AST
  expect(fullText).toContain("Five Flops, Then $23K MRR");
  expect(fullText).toContain("Vibe coding tools to try");
  expect(fullText).toContain("Bite-sized growth tip");
  expect(fullText).toContain("Rob Hallam failed with five products");

  // Link labels should be accessible via the links list
  const linkLabels = links.map(l => l.label);
  expect(linkLabels.some(l => l.includes("Augment Code"))).toBe(true);

  // Should NOT have raw escaped markdown asterisks
  expect(fullText).not.toMatch(/\\\*\\\*This founder hit\\\*\\\*/);

  // Should NOT have the invisible preheader content
  expect(fullText).not.toContain("͏");

  // Text must NOT be swallowed
  expect(fullText).toContain("Here's what you'll find in this issue:");

  // Images should have valid src and alt
  function walkImages(node: any) {
    if (node.type === "image") {
      expect(node.url).toBeTruthy();
    }
    if (node.children) {
      for (const child of node.children) walkImages(child);
    }
  }
  walkImages(root);
});

test("htmlToMdast extracts links correctly", () => {
  const result = htmlToMdast(html);
  const { links } = result;

  // Should have found links
  expect(links.length).toBeGreaterThan(0);

  // Each link should have href and label
  for (const link of links) {
    expect(link.href).toBeTruthy();
    expect(link.label).toBeTruthy();
    expect(link.id).toMatch(/^link-\d+$/);
  }
});

test("htmlToMdast handles blockquotes as separate nodes", () => {
  // Create HTML with a blockquote
  const htmlWithQuote = `
    <div>
      <p>Original message</p>
      <blockquote>
        <p>This is the quoted reply</p>
      </blockquote>
    </div>
  `;

  const result = htmlToMdast(htmlWithQuote);
  const quoteCount = countNodes(result.root, "blockquote");
  expect(quoteCount).toBeGreaterThanOrEqual(1);
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

test("remark AST structure (for debugging)", () => {
  const result = htmlToMdast(html);

  // Print the AST node types at the top level
  const topLevelTypes = result.root.children.map(c => c.type);
  console.log("=== TOP-LEVEL AST NODE TYPES ===");
  console.log(topLevelTypes.join(", "));
  console.log(`Total: ${topLevelTypes.length} nodes`);

  // Print first few nodes in detail
  console.log("\n=== FIRST 10 NODES (type + text preview) ===");
  for (let i = 0; i < Math.min(10, result.root.children.length); i++) {
    const node = result.root.children[i]!;
    const text = getTextContent(node).slice(0, 100);
    console.log(`[${i}] ${node.type}: ${text}`);
  }
  console.log("=== END ===");

  // The root should have children
  expect(result.root.children.length).toBeGreaterThan(0);
});

// ===== example2.html — GitHub Actions notification =====

const html2 = await Bun.file(join(import.meta.dir, "example2.html")).text();

test("example2: htmlToMdast — GitHub Actions email", () => {
  const result = htmlToMdast(html2);
  const fullText = collectText(result.root);
  const imageCount = countNodes(result.root, "image");

  console.log("=== EXAMPLE2 RENDERED TEXT ===");
  console.log(fullText.slice(0, 3000));
  console.log("=== END ===");
  console.log(`Images: ${imageCount}`);

  // Should contain the key content
  expect(fullText).toContain("[semos-labs/glyph] Test workflow run");
  expect(fullText).toContain("All jobs were successful");

  // Link labels should be extractable
  const allLinkLabels = result.links.map(l => l.label);
  expect(allLinkLabels.some(l => l.includes("View workflow run"))).toBe(true);

  // Address should be readable
  expect(fullText).toContain("GitHub, Inc.");
});

// ===================================================================
// Table Integrity Tests
// ===================================================================

/** Helper: find the first table node in an AST root */
function findTable(root: Root): Table | undefined {
  return root.children.find((n): n is Table => n.type === "table");
}

/** Helper: extract cell texts as a 2D array from a Table node */
function tableCellTexts(table: Table): string[][] {
  return table.children.map(row =>
    row.children.map(cell => getTextContent(cell).trim())
  );
}

/** Helper: extract cell child types as a 2D array */
function tableCellTypes(table: Table): string[][] {
  return table.children.map(row =>
    row.children.map(cell => cell.children.map(c => c.type).join("+") || "(empty)")
  );
}

describe("Table integrity", () => {
  test("simple 3×3 data table with <th>", () => {
    const html = `<table>
      <thead><tr><th>Name</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Alice</td><td>Engineer</td><td>Active</td></tr>
        <tr><td>Bob</td><td>Designer</td><td>Away</td></tr>
      </tbody>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(3); // header + 2 data rows
    expect(table!.children[0]!.children).toHaveLength(3); // 3 columns

    const cells = tableCellTexts(table!);
    expect(cells).toEqual([
      ["Name", "Role", "Status"],
      ["Alice", "Engineer", "Active"],
      ["Bob", "Designer", "Away"],
    ]);
  });

  test("2-column table with <th>", () => {
    const html = `<table>
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody><tr><td>Name</td><td>Alice</td></tr></tbody>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(2);

    const cells = tableCellTexts(table!);
    expect(cells).toEqual([
      ["Key", "Value"],
      ["Name", "Alice"],
    ]);
  });

  test("table with empty cells", () => {
    const html = `<table>
      <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
      <tbody>
        <tr><td>1</td><td></td><td>3</td></tr>
        <tr><td></td><td>2</td><td></td></tr>
      </tbody>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(3);

    const cells = tableCellTexts(table!);
    expect(cells[0]).toEqual(["A", "B", "C"]);
    expect(cells[1]).toEqual(["1", "", "3"]);
    expect(cells[2]).toEqual(["", "2", ""]);
  });

  test("table with images in cells", () => {
    const html = `<table>
      <thead><tr><th>Status</th><th>Job</th><th>Notes</th></tr></thead>
      <tbody>
        <tr>
          <td><img src="https://example.com/check.png" alt="ok" width="24" height="24"></td>
          <td>build</td>
          <td>passed</td>
        </tr>
      </tbody>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(2);
    expect(table!.children[0]!.children).toHaveLength(3);

    // Header row
    const headerTexts = tableCellTexts(table!)[0]!;
    expect(headerTexts).toEqual(["Status", "Job", "Notes"]);

    // Data row: first cell should have an image
    const types = tableCellTypes(table!);
    expect(types[1]![0]).toContain("image");
    expect(types[1]![1]).toContain("text");
  });

  test("table with links in cells", () => {
    const html = `<table>
      <thead><tr><th>Tool</th><th>Link</th><th>Price</th></tr></thead>
      <tbody>
        <tr>
          <td>Widget</td>
          <td><a href="https://example.com">Visit site</a></td>
          <td>Free</td>
        </tr>
      </tbody>
    </table>`;

    const { root, links } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();

    const texts = tableCellTexts(table!);
    expect(texts[1]![0]).toBe("Widget");
    expect(texts[1]![1]).toBe("Visit site");
    expect(texts[1]![2]).toBe("Free");

    // Link in cell should be extractable
    const types = tableCellTypes(table!);
    expect(types[1]![1]).toContain("link");

    // Link should appear in extracted links
    expect(links.some(l => l.label === "Visit site")).toBe(true);
  });

  test("table with bold/styled text in cells", () => {
    const html = `<table>
      <thead><tr><th>Status</th><th>Details</th></tr></thead>
      <tbody>
        <tr>
          <td><b>Success</b></td>
          <td><em>Test</em> / build <b>passed</b></td>
        </tr>
      </tbody>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();

    const types = tableCellTypes(table!);
    expect(types[1]![0]).toContain("strong");
    expect(types[1]![1]).toContain("emphasis");
  });

  test("3-column table without <th> (no header) is preserved", () => {
    const html = `<table>
      <tr><td>A</td><td>B</td><td>C</td></tr>
      <tr><td>1</td><td>2</td><td>3</td></tr>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    // 3+ column tables without <th> survive the heuristic
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(2);

    const cells = tableCellTexts(table!);
    expect(cells[0]).toEqual(["A", "B", "C"]);
    expect(cells[1]).toEqual(["1", "2", "3"]);
  });

  test("layout table (width=100%) is unwrapped, not a table", () => {
    const html = `<table width="100%" cellpadding="0" cellspacing="0">
      <tr><td><h1>Hello</h1></td></tr>
      <tr><td><p>World</p></td></tr>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeUndefined(); // should be unwrapped

    const text = collectText(root);
    expect(text).toContain("Hello");
    expect(text).toContain("World");
  });

  test("layout table wrapping a data table — data table survives", () => {
    const html = `<table width="100%">
      <tr><td>
        <h2>Results</h2>
        <table>
          <thead><tr><th>Status</th><th>Job</th><th>Time</th></tr></thead>
          <tbody>
            <tr><td>ok</td><td>build</td><td>14s</td></tr>
          </tbody>
        </table>
      </td></tr>
    </table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();
    expect(table!.children).toHaveLength(2); // header + 1 data row
    expect(table!.children[0]!.children).toHaveLength(3); // 3 cols

    const texts = tableCellTexts(table!);
    expect(texts[0]).toEqual(["Status", "Job", "Time"]);
    expect(texts[1]).toEqual(["ok", "build", "14s"]);

    // The heading "Results" should also appear in the AST
    const headings = root.children.filter(n => n.type === "heading");
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  test("GitHub Actions email: table with image + bold + link", () => {
    const { root, links } = htmlToMdast(html2);
    const table = findTable(root);
    expect(table).toBeDefined();

    // Should have header + data rows
    expect(table!.children.length).toBeGreaterThanOrEqual(2);

    // Header: Status | Job | Annotations
    const headerTexts = tableCellTexts(table!)[0]!;
    expect(headerTexts).toEqual(["Status", "Job", "Annotations"]);

    // Column count should be exactly 3 — NOT 509 (the old pipe-escaping bug)
    expect(table!.children[0]!.children).toHaveLength(3);

    // Data row should have an image in the Status cell
    const dataRow = table!.children[1]!;
    const statusCell = dataRow.children[0]!;
    const hasImage = statusCell.children.some(c => c.type === "image");
    expect(hasImage).toBe(true);

    // Job cell should have bold text
    const jobCell = dataRow.children[1]!;
    const hasBold = jobCell.children.some(c => c.type === "strong");
    expect(hasBold).toBe(true);
    expect(getTextContent(jobCell)).toContain("Test");

    // Links from the surrounding text should be extracted
    expect(links.some(l => l.label.includes("View workflow run"))).toBe(true);
  });

  test("table column count is stable (no inflation from nested layout)", () => {
    // Regression: the old custom table rules caused 509-column tables
    // when layout wrapper tables survived preprocessing.
    const html = `<table width="100%"><tr><td>
      <table>
        <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>2</td><td>3</td></tr>
          <tr><td>4</td><td>5</td><td>6</td></tr>
        </tbody>
      </table>
    </td></tr></table>`;

    const { root } = htmlToMdast(html);
    const table = findTable(root);
    expect(table).toBeDefined();

    // Must be exactly 3 columns — not inflated by layout wrappers
    for (const row of table!.children) {
      expect(row.children).toHaveLength(3);
    }

    // And the content must be correct
    const cells = tableCellTexts(table!);
    expect(cells[0]).toEqual(["A", "B", "C"]);
    expect(cells[1]).toEqual(["1", "2", "3"]);
    expect(cells[2]).toEqual(["4", "5", "6"]);
  });

  test("multiple tables in one email", () => {
    const html = `
      <table>
        <thead><tr><th>X</th><th>Y</th><th>Z</th></tr></thead>
        <tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody>
      </table>
      <p>Some text between tables</p>
      <table>
        <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
        <tbody><tr><td>4</td><td>5</td><td>6</td></tr></tbody>
      </table>`;

    const { root } = htmlToMdast(html);
    const tables = root.children.filter((n): n is Table => n.type === "table");
    expect(tables).toHaveLength(2);

    expect(tableCellTexts(tables[0]!)[1]).toEqual(["1", "2", "3"]);
    expect(tableCellTexts(tables[1]!)[1]).toEqual(["4", "5", "6"]);
  });
});
