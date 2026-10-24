import { describe, expect, it } from "vitest";
import { normMobile, parseSheetDate } from "../lib/sheet-sync";

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
});
