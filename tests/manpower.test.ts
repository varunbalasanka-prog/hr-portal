import { describe, expect, it } from "vitest";
import { cleanTempRoles, loanState, stillNeeded } from "../lib/manpower";

describe("cleanTempRoles", () => {
  it("trims, drops blank rows and merges repeated roles", () => {
    expect(cleanTempRoles([{ post: " Sales Executive ", headcount: 2 }, { post: "", headcount: 1 }, { post: "sales executive", headcount: 1 }, { post: "Cashier", headcount: 1 }]))
      .toEqual([{ post: "Sales Executive", headcount: 3 }, { post: "Cashier", headcount: 1 }]);
  });
  it("needs a role and a sensible count", () => {
    expect(cleanTempRoles([{ post: "", headcount: 2 }])).toBe("Add at least one role.");
    expect(cleanTempRoles([{ post: "Cashier", headcount: 0 }])).toMatch(/how many/);
    expect(cleanTempRoles([{ post: "Cashier", headcount: 40 }, { post: "Sales", headcount: 11 }])).toMatch(/At most 50/);
  });
});

describe("loanState", () => {
  const loan = { start_date: "2026-11-01", end_date: "2026-11-10", returned_on: null };
  it("follows the dates", () => {
    expect(loanState(loan, "2026-10-31")).toBe("upcoming");
    expect(loanState(loan, "2026-11-01")).toBe("on loan");
    expect(loanState(loan, "2026-11-10")).toBe("on loan");
    expect(loanState(loan, "2026-11-11")).toBe("back");
  });
  it("ends early when sent back", () => {
    expect(loanState({ ...loan, returned_on: "2026-11-04" }, "2026-11-05")).toBe("back");
  });
});

it("stillNeeded counts people already sent per role", () => {
  expect(stillNeeded([{ post: "Sales", headcount: 2 }, { post: "Cashier", headcount: 1 }], [{ post: "Sales" }, { post: "Cashier" }, { post: "Cashier" }]))
    .toEqual([{ post: "Sales", headcount: 1 }, { post: "Cashier", headcount: 0 }]);
});
