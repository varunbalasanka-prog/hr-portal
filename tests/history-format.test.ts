import { describe, expect, it } from "vitest";
import { describeAction, describeChanges, describeTarget, formatWhen } from "../lib/history-format";

const CAND = "b8f5ac1e-58cf-4820-ae7f-bc6318d62ccc";
const STORE = "11111111-2222-4333-8444-555555555555";

describe("change history in plain words", () => {
  // The row varun saw as raw JSON.
  const detail = {
    name: "Thirumalai Devi",
    next_action: { to: "Check revised joining (2026-11-09)", from: "Check Joining Status (2026-11-01)" },
    joining_status: { to: "Not Joined", from: null },
    next_action_at: { to: "2026-11-08T18:30:00+00:00", from: "2026-10-30T18:30:00+00:00" },
    pipeline_status: { to: "Revised Joining", from: "Expected Joining" },
  };
  const refs = { [CAND]: { label: "Thirumalai Devi", href: `/dashboard?open=${CAND}` }, [STORE]: { label: "Tanishq - Theni" } };

  it("shows labels, IST dates and dashes, never the raw name key", () => {
    expect(describeChanges("candidate update", CAND, detail, refs)).toEqual([
      { label: "Next action", kind: "change", from: "Check Joining Status (1 Nov 2026)", to: "Check revised joining (9 Nov 2026)" },
      { label: "Joining status", kind: "change", from: "—", to: "Not Joined" },
      { label: "Next action date", kind: "change", from: "31 Oct 2026", to: "9 Nov 2026" },
      { label: "Stage", kind: "change", from: "Expected Joining", to: "Revised Joining" },
    ]);
  });

  it("names the candidate instead of the id, with a link", () => {
    expect(describeTarget("candidate update", CAND, detail, refs)).toEqual(refs[CAND]);
    expect(describeTarget("candidate update", CAND, detail, {})).toEqual({ label: "Thirumalai Devi (deleted)" });
    expect(describeAction("candidate update")).toBe("Changed candidate");
  });

  it("turns store ids into store names and lists into added/removed", () => {
    const posts = { value: { from: { [STORE]: ["Sales"] }, to: { [STORE]: ["Sales", "Cashier"] } } };
    expect(describeChanges("app_settings update", "branch_posts", posts, refs)).toEqual([
      { label: "Tanishq - Theni", kind: "list", added: ["Cashier"], removed: [] },
    ]);
    expect(describeChanges("candidate update", CAND, { name: "X", branch_id: { from: null, to: STORE } }, refs)[0])
      .toEqual({ label: "Store", kind: "change", from: "—", to: "Tanishq - Theni" });
  });

  it("formats money, times and hides secrets", () => {
    const out = describeChanges("candidate update", CAND, {
      name: "X", basic_salary: { from: 12000, to: 15000 }, interview_at: { from: null, to: "2026-11-05T05:00:00+00:00" },
      access_token: { from: "abc", to: "def" }, source: { from: "online", to: "walkin" },
    });
    expect(out).toEqual([
      { label: "Basic salary", kind: "change", from: "₹12,000", to: "₹15,000" },
      { label: "Interview", kind: "change", from: "—", to: "5 Nov 2026, 10:30 am" },
      { label: "Candidate link", kind: "value", value: "Changed" },
      { label: "Came through", kind: "change", from: "Online", to: "Walk-in" },
    ]);
    expect(formatWhen("2026-11-03T12:27:00Z")).toBe("3 Nov 2026, 5:57 pm");
  });
});
