import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBody } from "../lib/blog-format";
import { blocksToHtml, blocksToMarkdown, fixHref } from "../lib/blog-edit";

const bodies = readdirSync("content/blog").filter((f) => f.endsWith(".md"))
  .map((f) => readFileSync(`content/blog/${f}`, "utf8").replace(/\r\n/g, "\n").replace(/^---\n[\s\S]*?\n---\n/, ""));

describe("visual blog editor", () => {
  it("every existing post comes back the same after the editor saves it", () => {
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) expect(parseBody(blocksToMarkdown(parseBody(body)))).toEqual(parseBody(body));
  });

  it("writes headings, bold, lists, links and notes as the site reads them", () => {
    const md = blocksToMarkdown([
      { t: "h2", text: "Hallmark", id: "" },
      { t: "p", parts: [{ t: "text", v: "Look for the " }, { t: "bold", v: "BIS mark " }, { t: "text", v: "and ask." }] },
      { t: "ul", items: [[{ t: "text", v: "One" }], [{ t: "link", v: "Two", href: "/jewellery" }]] },
      { t: "ol", items: [[{ t: "text", v: "First" }], [{ t: "text", v: "Second" }]] },
      { t: "note", parts: [{ t: "text", v: "Prices change daily." }] },
    ]);
    expect(md).toBe("## Hallmark\n\nLook for the **BIS mark** and ask.\n\n- One\n- [Two](/jewellery)\n\n1. First\n2. Second\n\n> Prices change daily.");
  });

  it("a paragraph that happens to start with '1. ' or '- ' stays a paragraph", () => {
    const md = blocksToMarkdown([{ t: "p", parts: [{ t: "text", v: "1. We opened in 1966." }] }, { t: "p", parts: [{ t: "text", v: "- and grew." }] }]);
    expect(parseBody(md).map((b) => b.t)).toEqual(["p", "p"]);
  });

  it("empty lines, headings and bold are dropped, not saved as stray symbols", () => {
    expect(blocksToMarkdown([{ t: "h2", text: " ", id: "" }, { t: "p", parts: [{ t: "bold", v: "  " }] }])).toBe("");
  });

  it("shows text safely in the editor", () => {
    expect(blocksToHtml(parseBody("Tom & <b>Jerry</b> [x](javascript:alert(1))"))).not.toMatch(/<b>|javascript/);
  });

  it("turns what people type in the link box into a working link", () => {
    expect(fixHref("balasanka.in/jewellery")).toBe("/jewellery");
    expect(fixHref("www.bis.gov.in")).toBe("https://www.bis.gov.in");
    expect(fixHref("https://bis.gov.in/hallmark")).toBe("https://bis.gov.in/hallmark");
    expect(fixHref("support@balasanka.in")).toBe("mailto:support@balasanka.in");
    expect(fixHref("/about")).toBe("/about");
    expect(fixHref("javascript:alert(1)")).toBeNull();
    expect(fixHref("not a link")).toBeNull();
  });
});
