import { describe, expect, it } from "vitest";
import { firmRoleNames, roleOptions } from "../lib/job-roles";
import { cleanBranchPosts } from "../lib/apply-questions";

const roles = [
  { id: "1", name: "Cashier", active: true },
  { id: "2", name: "Executive Sales", active: true },
  { id: "3", name: "Helper", active: false },
];

describe("firm roles", () => {
  it("lists only the firm's live roles, sorted", () => {
    expect(firmRoleNames(roles, ["2", "1", "3"])).toEqual(["Cashier", "Executive Sales"]);
    expect(firmRoleNames(roles, [])).toEqual([]);
  });
  it("keeps an old saved name as an option", () => {
    expect(roleOptions(["Cashier"], "Technician")).toEqual(["Technician", "Cashier"]);
    expect(roleOptions(["Cashier"], "Cashier")).toEqual(["Cashier"]);
    expect(roleOptions(["Cashier"], "")).toEqual(["Cashier"]);
  });
  it("lets a store open only its firm's roles", () => {
    const master = ["Cashier", "Executive Sales", "Receptionist"];
    const map = { a: ["Receptionist", "Cashier"], b: ["Executive Sales"] };
    expect(cleanBranchPosts(map, master, ["a", "b"], { a: ["Cashier"], b: [] })).toEqual({ a: ["Cashier"], b: [] });
    expect(cleanBranchPosts(map, master, ["a", "b"], null)).toEqual({ a: ["Cashier", "Receptionist"], b: ["Executive Sales"] });
  });
});
