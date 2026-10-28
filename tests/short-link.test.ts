import { describe, expect, it } from "vitest";
import { branchForCode, shortCode } from "../lib/short-link";

const branches = [
  { id: "15d975af-437e-4ebb-9d70-9e392b49749d" },
  { id: "15d975b0-0000-4000-8000-000000000000" },
  { id: "a1b2c3d4-0000-4000-8000-000000000000" },
];

describe("short poster links", () => {
  it("takes the first 6 characters of the branch id", () => {
    expect(shortCode("15D975AF-437e-4ebb-9d70-9e392b49749d")).toBe("15d975");
  });
  it("finds the branch for its code, ignoring case", () => {
    expect(branchForCode("A1B2C3", branches)?.id).toBe(branches[2].id);
  });
  it("refuses a code shared by two branches, a short code, or an unknown one", () => {
    expect(branchForCode("15d975", branches)).toBeNull();
    expect(branchForCode("15d975a", branches)?.id).toBe(branches[0].id);
    expect(branchForCode("a1b", branches)).toBeNull();
    expect(branchForCode("ffffff", branches)).toBeNull();
  });
});
