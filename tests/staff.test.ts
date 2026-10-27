import { describe, expect, it } from "vitest";
import { placement, tenureLabel, type BranchLite, type StaffPosition, type StaffStint } from "../lib/staff";

const branches = new Map<string, BranchLite>([
  ["avt", { id: "avt", name: "Akshaya Velli - Theni", division: null }],
  ["avs", { id: "avs", name: "Akshaya Velli - Sivakasi", division: null }],
  ["clt", { id: "clt", name: "Caratlane - Theni", division: null }],
]);
let n = 0;
const line = (branch_id: string, from_date: string, to_date: string | null, change_type = "joined"): StaffPosition =>
  ({ id: ++n, branch_id, from_date, to_date, change_type, designation: "Sales", basic: null, allowances: null, reason: null, entered_by: "x" });
const stint = (positions: StaffPosition[], left_on: string | null = null): StaffStint => ({
  id: "s", employee_id: "e", candidate_id: null, name: "Ravi", mobile: null, source: "portal", employee_code: null,
  joined_on: positions[0].from_date, left_on, exit_type: left_on ? "resigned" : null, exit_reason: null, rehire: null,
  confirmation_date: null, confirmed: false, positions,
});

describe("staff register placement", () => {
  it("shows a working employee as current at their store", () => {
    const s = stint([line("avt", "2025-01-01", null)]);
    expect(placement(s, { kind: "branch", id: "avt" }, branches)?.tab).toBe("current");
    expect(placement(s, { kind: "branch", id: "avs" }, branches)).toBeNull();
  });

  it("a move inside the division is 'moved out', not a loss", () => {
    const s = stint([line("avt", "2025-01-01", "2025-06-30"), line("avs", "2025-07-01", null, "transfer")]);
    expect(placement(s, { kind: "branch", id: "avt" }, branches)).toMatchObject({ tab: "moved", to: "Akshaya Velli - Sivakasi" });
    expect(placement(s, { kind: "branch", id: "avs" }, branches)).toMatchObject({ tab: "current", since: "2025-07-01" });
    // The division never lost them, and has had them since joining.
    expect(placement(s, { kind: "division", name: "Akshaya Velli" }, branches)).toMatchObject({ tab: "current", since: "2025-01-01" });
  });

  it("a move to another division is a loss for the store and the division", () => {
    const s = stint([line("avt", "2025-01-01", "2025-06-30"), line("clt", "2025-07-01", null, "transfer")]);
    expect(placement(s, { kind: "branch", id: "avt" }, branches)).toMatchObject({ tab: "past", why: "other division", to: "Caratlane - Theni" });
    expect(placement(s, { kind: "division", name: "Akshaya Velli" }, branches)).toMatchObject({ tab: "past", why: "other division" });
    expect(placement(s, { kind: "all" }, branches)?.tab).toBe("current");
  });

  it("someone who left the company is past everywhere they worked", () => {
    const s = stint([line("avt", "2025-01-01", "2025-06-30"), line("avs", "2025-07-01", "2026-02-10", "transfer")], "2026-02-10");
    expect(placement(s, { kind: "branch", id: "avs" }, branches)).toMatchObject({ tab: "past", why: "left" });
    expect(placement(s, { kind: "branch", id: "avt" }, branches)?.tab).toBe("moved");
    expect(placement(s, { kind: "all" }, branches)?.tab).toBe("past");
  });

  it("uses the division set by admin over the brand name", () => {
    const custom = new Map(branches);
    custom.set("clt", { id: "clt", name: "Caratlane - Theni", division: "Akshaya Velli" });
    const s = stint([line("avt", "2025-01-01", "2025-06-30"), line("clt", "2025-07-01", null, "transfer")]);
    expect(placement(s, { kind: "branch", id: "avt" }, custom)?.tab).toBe("moved");
  });

  it("labels tenure in years and months", () => {
    expect(tenureLabel("2024-05-01", "2026-08-15")).toBe("2 yr 3 mo");
    expect(tenureLabel("2026-10-01", "2026-10-20")).toBe("under 1 mo");
    expect(tenureLabel("2026-01-20", "2026-03-19")).toBe("1 mo");
  });
});
