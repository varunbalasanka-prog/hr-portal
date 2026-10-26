import { describe, expect, it } from "vitest";
import { cleanRetention } from "../lib/privacy";
import { extFor } from "../lib/upload-client";
import { docLabel } from "../lib/onboarding";

describe("retention setting", () => {
  it("accepts whole months of 6 or more", () => {
    expect(cleanRetention(12)).toBe(12);
    expect(cleanRetention("24")).toBe(24);
  });
  it("treats blank, short or odd values as switched off", () => {
    for (const v of [null, "", "5", 0, "abc", 6.5, undefined]) expect(cleanRetention(v)).toBeNull();
  });
});

describe("upload helpers", () => {
  it("names files by type", () => {
    expect(extFor("application/pdf")).toBe("pdf");
    expect(extFor("image/jpeg")).toBe("jpeg");
  });
  it("shows staff the English part of a document label", () => {
    expect(docLabel("aadhar")).toBe("Aadhaar card (full, not masked)");
    expect(docLabel("field:esi_number")).toBe("ESI number");
    expect(docLabel("unknown_key")).toBe("unknown_key");
  });
});
