import { describe, expect, it } from "vitest";
import { cleanGenderSplit, genderLabel } from "../lib/manpower";

describe("gender split on manpower requests", () => {
  it("accepts a split within the total and treats blanks as 0", () => {
    expect(cleanGenderSplit(2, 1, 4)).toEqual({ men: 2, women: 1 });
    expect(cleanGenderSplit("", undefined, 3)).toEqual({ men: 0, women: 0 });
  });
  it("rejects more men + women than people asked for, or negatives", () => {
    expect(typeof cleanGenderSplit(2, 2, 3)).toBe("string");
    expect(typeof cleanGenderSplit(-1, 0, 3)).toBe("string");
  });
  it("labels the split", () => {
    expect(genderLabel(0, 0, 3)).toBe("Any");
    expect(genderLabel(null, undefined, 3)).toBe("Any");
    expect(genderLabel(2, 1, 4)).toBe("2 Male · 1 Female · 1 Any");
    expect(genderLabel(0, 3, 3)).toBe("3 Female");
  });
});
