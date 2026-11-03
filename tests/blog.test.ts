import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { parseBody, parseInline, parsePost } from "../lib/blog-format";
import { filePosts as allPosts } from "../lib/blog";

const post = (front: string, body = "Hello.") => `---\n${front}\n---\n${body}`;
const ok = "title: T\ndescription: D\ndate: 2026-11-03\ncategory: jewellery";

describe("blog", () => {
  it("reads bold and links inside a line", () => {
    expect(parseInline("See **this** and [that](/about).")).toEqual([
      { t: "text", v: "See " }, { t: "bold", v: "this" }, { t: "text", v: " and " }, { t: "link", v: "that", href: "/about" }, { t: "text", v: "." },
    ]);
  });

  it("splits headings, lists, notes and paragraphs", () => {
    const b = parseBody("## Head One\n\n- a\n- b\n\n1. x\n2. y\n\n> note\n> more\n\nplain\ntext");
    expect(b.map((x) => x.t)).toEqual(["h2", "ul", "ol", "note", "p"]);
    expect(b[0]).toMatchObject({ id: "head-one" });
    expect(b[3]).toMatchObject({ parts: [{ t: "text", v: "note more" }] });
  });

  it("rejects broken posts so they fail the build", () => {
    expect(() => parsePost("x", "no front matter")).toThrow(/front matter/);
    expect(() => parsePost("x", post("title: T\ndate: 2026-11-03\ncategory: jewellery"))).toThrow(/description/);
    expect(() => parsePost("x", post(ok.replace("jewellery", "food")))).toThrow(/category/);
    expect(() => parsePost("x", post(ok.replace("2026-11-03", "3 Nov")))).toThrow(/YYYY-MM-DD/);
    expect(() => parsePost("Bad Name", post(ok))).toThrow(/file name/);
  });

  it("every real post parses and has a unique slug", () => {
    const posts = allPosts();
    expect(posts.length).toBeGreaterThan(0);
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length);
    for (const p of posts) expect(p.description.length).toBeLessThanOrEqual(200);
  });
});
