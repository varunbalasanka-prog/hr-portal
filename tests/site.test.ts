import { describe, expect, it } from "vitest";
import { buildSite, checkContent, checkPost, checkShowroom, fill, mergeContent, slugFromTitle, townSlug } from "../lib/site";
import { DEFAULT_CONTENT, DEFAULT_SHOWROOMS } from "../lib/site-defaults";
import { safeHref } from "../lib/blog-format";

const site = buildSite(DEFAULT_CONTENT, DEFAULT_SHOWROOMS);

describe("website content", () => {
  it("starts from today's site: 23 showrooms in 8 towns, in business order", () => {
    expect(site.all).toHaveLength(23);
    expect(site.towns).toHaveLength(8);
    expect(site.groups.map((g) => g.slug)).toEqual(["two-wheelers", "jewellery", "watches-and-eyewear"]);
    expect(site.groups[0].showrooms[0].brand).toBe("Balasanka TVS");
  });

  it("every default passes the editor's own checks", () => {
    for (const s of DEFAULT_SHOWROOMS) expect(checkShowroom(s).ok).toBe(true);
    for (const k of Object.keys(DEFAULT_CONTENT) as (keyof typeof DEFAULT_CONTENT)[]) expect(checkContent(k, DEFAULT_CONTENT[k])).toBeNull();
  });

  it("fills today's numbers into the words", () => {
    expect(fill("{showrooms} showrooms in {towns} towns: {town list}.", site)).toBe(`23 showrooms in 8 towns: ${site.towns.slice(0, -1).join(", ")} and ${site.towns.at(-1)}.`);
  });

  it("a half-filled or broken database value never breaks a page", () => {
    const c = mergeContent(DEFAULT_CONTENT, [
      { key: "home", value: { intro: "New words" } },
      { key: "about", value: { story: "not a list" } },
      { key: "contact", value: null },
      { key: "nonsense", value: 1 },
    ]);
    expect(c.home).toEqual({ intro: "New words", careers: DEFAULT_CONTENT.home.careers });
    expect(c.about.story).toEqual(DEFAULT_CONTENT.about.story);
    expect(c.contact).toEqual(DEFAULT_CONTENT.contact);
  });

  it("checks a showroom before saving", () => {
    const ok = { business: "jewellery" as const, brand: " Akshaya  Velli ", town: "Madurai", company: "", street: "1 Main Road", pin: "625 020" };
    expect(checkShowroom(ok)).toMatchObject({ ok: true, value: { brand: "Akshaya Velli", pin: "625020" } });
    expect(checkShowroom({ ...ok, pin: "62502" }).ok).toBe(false);
    expect(checkShowroom({ ...ok, town: "தேனி" }).ok).toBe(false);
    expect(checkShowroom({ ...ok, business: "foods" as never }).ok).toBe(false);
  });

  it("checks a post before saving, and drafts may be short", () => {
    const p = { slug: "a-post", title: "A post", description: "One line.", category: "story" as const, body: "Short.", published_on: "2026-11-03", checked_on: null, status: "draft" as const };
    expect(checkPost(p).ok).toBe(true);
    expect(checkPost({ ...p, status: "published" }).ok).toBe(false);
    expect(checkPost({ ...p, status: "published", body: "word ".repeat(40) }).ok).toBe(true);
    expect(checkPost({ ...p, slug: "Bad Slug" }).ok).toBe(false);
    expect(slugFromTitle("How to check a hallmark? (2026)")).toBe("how-to-check-a-hallmark-2026");
  });

  it("only safe links in posts and logos", () => {
    expect(safeHref("/jewellery")).toBe("/jewellery");
    expect(safeHref("https://bis.gov.in")).toBeTruthy();
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(checkContent("brand_strip", [{ name: "TVS", note: "x", logo: "javascript:alert(1)" }])).toMatch(/not a web address/);
  });

  it("town addresses stay the same and new two-word towns work", () => {
    expect(townSlug("Theni")).toBe("theni");
    expect(townSlug("Theni Allinagaram")).toBe("theni-allinagaram");
  });
});
