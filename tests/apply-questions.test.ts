import { describe, expect, it } from "vitest";
import { checkAnswer, cleanPosts, cleanQuestion, groupBySection, isVisible, splitBilingual, latestDate, cleanBranchPosts, type AdminQuestion } from "../lib/apply-questions";

const q = (id: string, extra: Partial<AdminQuestion> = {}): AdminQuestion => ({
  id, section: "Experience", label: id, type: "text", options: [], required: false, show_when: null, min_age: null, sort_order: 0, active: true, ...extra,
});
const exp = q("exp", { type: "choice", options: ["Fresher", "Experienced"], required: true });
const company = q("company", { required: true, show_when: { question_id: "exp", equals: "Experienced" } });
const all = [exp, company];

describe("isVisible", () => {
  it("asks a follow-up only for the matching answer", () => {
    expect(isVisible(company, { exp: "Experienced" }, all)).toBe(true);
    expect(isVisible(company, { exp: "Fresher" }, all)).toBe(false);
    expect(isVisible(company, {}, all)).toBe(false);
  });
  it("shows a question whose condition points at a deleted question", () => {
    expect(isVisible(company, {}, [company])).toBe(true);
  });
});

describe("checkAnswer", () => {
  it("enforces required, choices, numbers and dates", () => {
    expect(checkAnswer(exp, "")).toMatch(/Please answer/);
    expect(checkAnswer(exp, "Maybe")).toMatch(/choose/);
    expect(checkAnswer(exp, "Fresher")).toBeNull();
    expect(checkAnswer(q("n", { type: "number" }), "15,000")).toBeNull();
    expect(checkAnswer(q("n", { type: "number" }), "abc")).toMatch(/number/);
    expect(checkAnswer(q("d", { type: "date" }), "2001-05-04")).toBeNull();
    expect(checkAnswer(q("d", { type: "date" }), "4/5/01")).toMatch(/date/);
  });
});

describe("cleanQuestion", () => {
  const base = { section: " Experience ", label: "  Notice   period ", type: "text", options: [], required: false, show_when: null, min_age: null };
  it("tidies spacing", () => {
    const r = cleanQuestion(base, all);
    expect(r.ok && r.value).toMatchObject({ label: "Notice period", section: "Experience" });
  });
  it("rejects a label another live question already uses", () => {
    expect(cleanQuestion({ ...base, label: "COMPANY" }, all).ok).toBe(false);
    expect(cleanQuestion({ ...base, label: "company" }, all, "company").ok).toBe(true);
    expect(cleanQuestion({ ...base, label: "company" }, [exp, { ...company, active: false }]).ok).toBe(true);
  });
  it("needs two options for a choice", () => {
    expect(cleanQuestion({ ...base, type: "choice", options: ["Yes", " ", "Yes"] }, all).ok).toBe(false);
    const r = cleanQuestion({ ...base, type: "choice", options: ["Yes", "No", "Yes"] }, all);
    expect(r.ok && r.value.options).toEqual(["Yes", "No"]);
  });
  it("won't drop an option a follow-up depends on", () => {
    expect(cleanQuestion({ ...base, label: "exp", type: "choice", options: ["Fresher", "Senior"] }, all, "exp").ok).toBe(false);
  });
  it("checks conditions", () => {
    expect(cleanQuestion({ ...base, show_when: { question_id: "exp", equals: "Experienced" } }, all).ok).toBe(true);
    expect(cleanQuestion({ ...base, show_when: { question_id: "exp", equals: "Other" } }, all).ok).toBe(false);
    expect(cleanQuestion({ ...base, show_when: { question_id: "company", equals: "x" } }, all).ok).toBe(false);
    // exp may not depend on its own follow-up's parent chain
    const chained = [exp, q("lvl", { type: "choice", options: ["A", "B"], show_when: { question_id: "exp", equals: "Fresher" } })];
    expect(cleanQuestion({ ...base, label: "exp", type: "choice", options: ["Fresher", "Experienced"], show_when: { question_id: "lvl", equals: "A" } }, chained, "exp").ok).toBe(false);
  });
});

it("groupBySection keeps first-seen order", () => {
  expect(groupBySection([{ section: "B" }, { section: "A" }, { section: "B" }]).map(([s, xs]) => [s, xs.length])).toEqual([["B", 2], ["A", 1]]);
});

it("cleanPosts drops blanks and repeats", () => {
  expect(cleanPosts(" Cashier\n\nHelper \nCashier\n")).toEqual(["Cashier", "Helper"]);
});

it("splitBilingual separates English and Tamil", () => {
  expect(splitBilingual("Gender / பாலினம்")).toEqual(["Gender", "பாலினம்"]);
  expect(splitBilingual("Father's / husband's name / தந்தை / கணவர் பெயர்")).toEqual(["Father's / husband's name", "தந்தை / கணவர் பெயர்"]);
  expect(splitBilingual("Fresher or experienced? / புதியவரா அல்லது Fresher-ஆ?")).toEqual(["Fresher or experienced?", "புதியவரா அல்லது Fresher-ஆ?"]);
  expect(splitBilingual("Notice period")).toEqual(["Notice period", ""]);
});

describe("minimum age", () => {
  const dob = q("dob", { type: "date", required: true, min_age: 18 });
  it("finds the latest allowed birth date", () => {
    expect(latestDate(18, "2026-10-24")).toBe("2008-10-24");
    expect(latestDate(18, "2028-02-29")).toBe("2010-02-28");
  });
  it("accepts an 18th birthday today and rejects one tomorrow", () => {
    expect(checkAnswer(dob, "2008-10-24", "2026-10-24")).toBeNull();
    expect(checkAnswer(dob, "2008-10-25", "2026-10-24")).toMatch(/at least 18/);
  });
  it("only applies to date questions", () => {
    const base = { section: "x", label: "When", type: "text", options: [], required: false, show_when: null, min_age: 18 };
    const r = cleanQuestion(base, all);
    expect(r.ok && r.value.min_age).toBeNull();
    expect(cleanQuestion({ ...base, type: "date", min_age: 0.5 }, all).ok).toBe(false);
  });
});

it("cleanBranchPosts keeps master order and drops removed posts", () => {
  expect(cleanBranchPosts({ a: ["Helper", "Gone", "Cashier"] }, ["Cashier", "Helper"], ["a", "b"])).toEqual({ a: ["Cashier", "Helper"], b: [] });
});
