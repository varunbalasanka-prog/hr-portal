import { describe, expect, it } from "vitest";
import { changedFields, onboardingKeys, reasonOk, STATUS_TARGETS } from "@/lib/corrections";

describe("admin corrections", () => {
  it("sends only the fields that changed", () => {
    expect(changedFields({ name: "Ravi", mobile: "9876543210", email: null }, { name: "Ravi ", mobile: "9876543211", email: "" }))
      .toEqual({ mobile: "9876543211" });
  });
  it("needs a reason of at least 3 letters", () => {
    expect(reasonOk("  ")).toBe(false);
    expect(reasonOk("typo")).toBe(true);
  });
  it("lists filled onboarding details first, never the consent version", () => {
    expect(onboardingKeys({ consent_version: "v1", blood_group: "O+", kids_count: "2" }, ["email", "blood_group"]))
      .toEqual(["blood_group", "kids_count", "email"]);
  });
  it("asks for a date where the status needs one", () => {
    expect(STATUS_TARGETS.filter((t) => t.needs).map((t) => t.value)).toEqual(["interview", "selected", "joined"]);
  });
});
