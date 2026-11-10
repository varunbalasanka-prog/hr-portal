import { describe, expect, it } from "vitest";
import { callBackBlock, cleanTalentTags, poolOnlyCandidate, talentBlock, talentSuggestion } from "../lib/talent";
import { categorize } from "../lib/categorize";

const c = poolOnlyCandidate({ id: "c1", name: "Priya", mobile: "9000000001", assigned_hr: "lithiga", pipeline_status: "Selected Candidate Dropped", talent_pool: false });
const off = { ...c, talent_pool: false };

describe("talent pool rules", () => {
  it("keeps working staff and blacklisted people out", () => {
    expect(talentBlock({ ...off, pipeline_status: "Joined" })).toMatch(/Working here/);
    expect(talentBlock({ ...off, pipeline_status: "Not Selected - Not Suitable", rejection_reason: "Not Suitable" })).toMatch(/Not Suitable/);
    expect(talentBlock(off)).toBeNull();
  });

  it("suggests good closed candidates only", () => {
    expect(talentSuggestion(off)).toMatch(/selected/);
    expect(talentSuggestion({ ...off, pipeline_status: "Not Contactable" })).toBeNull();
    expect(talentSuggestion({ ...off, pipeline_status: "Not Contactable" }, [{ recommendation: "hold" }])).toMatch(/scorecard/);
    expect(talentSuggestion({ ...off, pipeline_status: "Left (With Information)" })).toMatch(/good terms/);
    expect(talentSuggestion({ ...off, pipeline_status: "Left (Without Information)" })).toBeNull();
    expect(talentSuggestion({ ...off, pipeline_status: "Follow-up Not Started", interview_status: "Selected" })).toBeNull();
    expect(talentSuggestion({ ...off, talent_pool: true })).toBeNull();
  });

  it("lets HR call back closed pool people, but not re-apply or active ones", () => {
    const on = { ...c, talent_pool: true };
    expect(callBackBlock(on)).toBeNull();
    expect(callBackBlock({ ...on, pipeline_status: "Screening Rejected", rejection_reason: "Distance Issue" })).toMatch(/Re-Apply/);
    expect(callBackBlock({ ...on, pipeline_status: "Follow-up Not Started" })).toMatch(/follow-up with lithiga/);
    expect(callBackBlock(off)).toMatch(/Not in/);
  });

  it("keeps only tags from the fixed lists", () => {
    expect(cleanTalentTags([" Sales ", "Sales", "hacker", "Tamil"], ["Sales", "Tamil"])).toEqual(["Sales", "Tamil"]);
  });

  it("builds a list row from the basics", () => {
    expect(categorize(c).active).toBe(false);
    expect(c.talent_tags).toEqual([]);
  });
});
