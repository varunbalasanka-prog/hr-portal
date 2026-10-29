import { describe, expect, it } from "vitest";
import { ageOn, checkWalkin, cleanWarnAge, normalizeMobile, overAgeNote, parseRupees, type WalkinFields } from "../lib/walkin";

const now = new Date("2026-10-29T06:00:00Z"); // 11:30 am IST
const ok: WalkinFields = { name: "Priya", mobile: "98765 43210", dateOfBirth: "2000-05-01", post: "Sales", interviewAt: "2026-10-30T11:00" };

describe("walk-in checks", () => {
  it("cleans mobile numbers", () => {
    expect(normalizeMobile("+91 98765-43210")).toBe("9876543210");
    expect(normalizeMobile("09876543210")).toBe("9876543210");
    expect(normalizeMobile("987654321")).toBeNull();
    expect(normalizeMobile("198765432100")).toBeNull(); // 12 digits not starting 91: no silent trimming
    expect(normalizeMobile("1234567890")).toBeNull();
  });

  it("reads rupee amounts and never drops them silently", () => {
    expect(parseRupees("15,000")).toBe(15000);
    expect(parseRupees("₹ 15000")).toBe(15000);
    expect(parseRupees("Rs.12000")).toBe(12000);
    expect(parseRupees("")).toBe(0);
    expect(parseRupees("fifteen")).toBeNull();
  });

  it("accepts a normal walk-in", () => {
    const v = checkWalkin(ok, undefined, now);
    expect(v.error).toBeUndefined();
    if (v.error === undefined) expect(v.mobile).toBe("9876543210");
  });

  it("allows an interview later today but not a past day or far future", () => {
    expect(checkWalkin({ ...ok, interviewAt: "2026-10-29T17:00" }, undefined, now).error).toBeUndefined();
    expect(checkWalkin({ ...ok, interviewAt: "2026-10-28T17:00" }, undefined, now).error).toMatch(/past/);
    expect(checkWalkin({ ...ok, interviewAt: "2027-10-30T11:00" }, undefined, now).error).toMatch(/2 months/);
    expect(checkWalkin({ ...ok, interviewAt: "" }, undefined, now).error).toMatch(/interview date/);
  });

  it("needs a post and a name", () => {
    expect(checkWalkin({ ...ok, post: "  " }, undefined, now).error).toMatch(/post/);
    expect(checkWalkin({ ...ok, name: " . " }, undefined, now).error).toMatch(/name/);
  });

  it("always needs an interview, even if an old form sends no date", () => {
    expect(checkWalkin({ ...ok, interviewAt: undefined }, undefined, now).error).toMatch(/interview date/);
  });
});

describe("walk-in date of birth", () => {
  const ok: WalkinFields = { name: "Priya", mobile: "9876543210", dateOfBirth: "2000-05-01", post: "Sales", interviewAt: "2026-10-30T11:00" };
  it("needs a believable date of birth and the minimum age", () => {
    expect(checkWalkin({ ...ok, dateOfBirth: "" }, undefined, now).error).toMatch(/date of birth/);
    expect(checkWalkin({ ...ok, dateOfBirth: "1900-01-01" }, undefined, now).error).toMatch(/year/);
    expect(checkWalkin({ ...ok, dateOfBirth: "2008-10-29" }, undefined, now).error).toBeUndefined(); // 18 today
    expect(checkWalkin({ ...ok, dateOfBirth: "2008-10-30" }, undefined, now).error).toMatch(/at least 18/);
    expect(checkWalkin({ ...ok, dateOfBirth: "2010-01-01" }, { label: "DOB", minAge: null, warnAge: null }, now).error).toBeUndefined();
  });
});

describe("walk-in age warning", () => {
  const rule = { label: "DOB", minAge: 18, warnAge: 40 };
  it("counts completed years", () => {
    expect(ageOn("1986-10-29", "2026-10-29")).toBe(40);
    expect(ageOn("1986-10-30", "2026-10-29")).toBe(39);
  });
  it("warns only above the limit, and not when switched off", () => {
    expect(overAgeNote("1986-01-01", rule, "2026-10-29")).toBeNull(); // 40
    expect(overAgeNote("1985-01-01", rule, "2026-10-29")).toMatch(/Age 41: above the usual walk-in limit of 40/);
    expect(overAgeNote("1960-01-01", { ...rule, warnAge: null }, "2026-10-29")).toBeNull();
  });
  it("reads the admin's typed age", () => {
    expect(cleanWarnAge(" 45 ")).toBe(45);
    expect(cleanWarnAge("")).toBeNull();
    expect(cleanWarnAge("12")).toBeUndefined();
    expect(cleanWarnAge("forty")).toBeUndefined();
  });
});
