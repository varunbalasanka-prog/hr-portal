import { describe, expect, it } from "vitest";
import { checkWalkin, normalizeMobile, parseRupees, type WalkinFields } from "../lib/walkin";

const now = new Date("2026-10-29T06:00:00Z"); // 11:30 am IST
const ok: WalkinFields = { name: "Priya", mobile: "98765 43210", post: "Sales", interviewNeeded: "Yes", interviewAt: "2026-10-30T11:00" };

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
    const v = checkWalkin(ok, now);
    expect(v.error).toBeUndefined();
    if (v.error === undefined) expect(v.mobile).toBe("9876543210");
  });

  it("allows an interview later today but not a past day or far future", () => {
    expect(checkWalkin({ ...ok, interviewAt: "2026-10-29T17:00" }, now).error).toBeUndefined();
    expect(checkWalkin({ ...ok, interviewAt: "2026-10-28T17:00" }, now).error).toMatch(/past/);
    expect(checkWalkin({ ...ok, interviewAt: "2027-10-30T11:00" }, now).error).toMatch(/2 months/);
    expect(checkWalkin({ ...ok, interviewAt: "" }, now).error).toMatch(/interview date/);
  });

  it("needs a post and a name", () => {
    expect(checkWalkin({ ...ok, post: "  " }, now).error).toMatch(/post/);
    expect(checkWalkin({ ...ok, name: " . " }, now).error).toMatch(/name/);
  });

  it("checks joining date and salary when no interview", () => {
    const direct = { ...ok, interviewNeeded: "No" as const, interviewAt: "", expectedJoiningDate: "2026-11-01", basicSalary: "15,000", allowances: "" };
    const v = checkWalkin(direct, now);
    expect(v.error).toBeUndefined();
    if (v.error === undefined) expect([v.basic, v.allowances, v.joining]).toEqual([15000, 0, "2026-11-01"]);
    expect(checkWalkin({ ...direct, expectedJoiningDate: "2026-10-01" }, now).error).toMatch(/past/);
    expect(checkWalkin({ ...direct, basicSalary: "abc" }, now).error).toMatch(/Basic salary/);
  });
});
