import { describe, expect, it } from "vitest";
import { branchMatcher, normMobile, parseSheetDate } from "../lib/sheet-sync";
import branchData from "../scripts/data/branches.json";
import type { Branch } from "../lib/types";

describe("sheet parsing", () => {
  it("parses the date formats the old app wrote", () => {
    expect(parseSheetDate("24/10/2026 14:05:00")).toBe("2026-10-24T08:35:00.000Z");
    expect(parseSheetDate("4/1/2026")).toBe("2026-01-03T18:30:00.000Z");
    expect(parseSheetDate("2026-10-24T10:30")).toBe("2026-10-24T05:00:00.000Z");
    expect(parseSheetDate("2026-10-24")).toBe("2026-10-23T18:30:00.000Z");
    expect(parseSheetDate("24/10/2026 2:05 PM")).toBe("2026-10-24T08:35:00.000Z");
    expect(parseSheetDate("N/A")).toBeNull();
  });
  it("normalises mobiles", () => {
    expect(normMobile("+91 98426 10910")).toBe("9842610910");
  });
  it("matches Google Form locations to branches", () => {
    const branches = branchData.map((b, i) => ({ ...b, id: String(i), hr_username: b.hr })) as unknown as Branch[];
    const match = branchMatcher(branches);
    const cases: Record<string, string> = {
      "Madurai - Fastrack (Jewellery)": "Fast track - Madurai",
      "Rajapalayam - Akshaya Velli (Jewellery)": "Akshaya velli - Rajapalayam",
      "Theni - Akshaya Velli (Jewellery)": "Akshaya Velli - Theni",
      "Theni - Balasanka Cycle Bazar (Automobiles)": "Balsanka Cycle - Theni",
      "Theni - CaratLane (Jewellery)": "Caratlane - Theni",
      "Theni - Shri Murugesan Motors (Automobiles)": "Shri Murugesan TVS - Theni",
      "Theni - Tanishq (Jewellery)": "Tanishq - Theni",
      "Theni - Yasotha Motors (Automobiles)": "Yasotha Motors Theni",
      "Theni - Zora (Jewellery)": "Balasanka Zora - Theni",
      "Yasotha Motors Theni": "Yasotha Motors Theni",
      "Caratlane - Tirunelveli": "Caratlane - Tirunelveli",
    };
    for (const [loc, name] of Object.entries(cases)) expect(match(loc)?.name, loc).toBe(name);
    expect(match("Chennai - Tanishq")).toBeUndefined();
  });
});
