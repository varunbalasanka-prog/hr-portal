import { describe, expect, it } from "vitest";
import { toCsv } from "../lib/csv";
import { cleanSource, sourceLabel } from "../lib/sources";
import { WA_TEMPLATES } from "../lib/wa-templates";

describe("csv", () => {
  it("quotes commas and quotes, keeps Tamil, starts with BOM", () => {
    const out = toCsv([["a,b", 'say "hi"', "தேனி", null]]);
    expect(out).toBe('﻿"a,b","say ""hi""",தேனி,\r\n');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv([["=HYPERLINK(1)", "+91", "-5"]])).toBe("﻿'=HYPERLINK(1),'+91,'-5\r\n");
  });
});

describe("sources", () => {
  it("cleans link values", () => {
    expect(cleanSource("Poster")).toBe("poster");
    expect(cleanSource("<script>")).toBe("script");
    expect(cleanSource("")).toBeNull();
  });
  it("labels known and unknown keys", () => {
    expect(sourceLabel("poster")).toBe("Poster at a showroom");
    expect(sourceLabel("fb_ad_oct")).toBe("fb_ad_oct");
    expect(sourceLabel(null)).toBe("Not recorded");
  });
});

describe("whatsapp templates", () => {
  it("fills names, links and dates in both languages", () => {
    const t = WA_TEMPLATES.find((x) => x.key === "offer")!;
    const text = t.text({ name: "Priya", post: "Cashier", branch: "Tanishq - Theni", address: "Theni", link: "https://x/y" });
    expect(text).toContain("Priya");
    expect(text).toContain("https://x/y");
    expect(text).toMatch(/[஀-௿]/);
  });
});
