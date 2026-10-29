import { describe, expect, it, vi } from "vitest";
import samples from "./fixtures/jobs.json";

vi.mock("server-only", () => ({}));
vi.mock("../lib/supabase/public", () => ({ createPublicClient: () => ({}) }));
vi.mock("../lib/careers", () => ({ siteUrl: () => "https://hr.balasanka.in" }));
const { article, findJob, jobContent, jobPath, jobPosting, placeKind } = await import("../lib/jobs");
type Job = import("../lib/jobs").Job;
const jobs = samples as Job[];
const [velli, titan, cycle] = jobs;

// Google for Jobs: required and recommended JobPosting fields (developers.google.com/search/docs/appearance/structured-data/job-posting).
const REQUIRED = ["datePosted", "description", "hiringOrganization", "jobLocation", "title"];
const RECOMMENDED = ["validThrough", "baseSalary", "employmentType", "identifier", "directApply"];

describe("job pages", () => {
  it("gives each job its own readable address", () => {
    expect(jobPath(velli)).toBe("/jobs/theni/akshaya-velli-executive-sales");
    expect(jobPath(titan)).toBe("/jobs/tenkasi/titan-store-manager");
    expect(jobPath(cycle)).toBe("/jobs/theni/balasanka-cycle-technician");
    expect(findJob(jobs, "theni", "balasanka-cycle-technician")?.id).toBe(cycle.id);
    expect(findJob(jobs, "theni", "titan-store-manager")).toBeNull();
    expect(new Set(jobs.map(jobPath)).size).toBe(jobs.length);
  });

  it("uses a or an by sound", () => {
    expect(article("automobile showroom")).toBe("an");
    expect(article("office")).toBe("an");
    expect(article("jewellery showroom")).toBe("a");
    expect(article("cycle showroom")).toBe("a");
    expect(article("uniform")).toBe("a");
    expect(placeKind("Cycles")).toBe("cycle showroom");
    expect(jobContent(cycle).intro).toContain("Balasanka Cycle, a cycle showroom of");
    expect(jobContent(velli).intro).toContain("a jewellery showroom");
  });

  it("builds a complete JobPosting for Google", () => {
    for (const j of jobs) {
      const p = jobPosting(j) as Record<string, any>;
      for (const k of REQUIRED) expect(p[k], `${j.branch.name} ${k}`).toBeTruthy();
      for (const k of RECOMMENDED.filter((k) => k !== "baseSalary")) expect(p[k], `${j.branch.name} ${k}`).toBeTruthy();
      expect(p.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.validThrough).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\+05:30$/);
      expect(p.url).toBe(`https://hr.balasanka.in${jobPath(j)}`);
      const a = p.jobLocation.address;
      expect(a).toMatchObject({ "@type": "PostalAddress", addressCountry: "IN", addressRegion: "Tamil Nadu" });
      expect(a.streetAddress).toBeTruthy();
      expect(a.postalCode).toMatch(/^\d{6}$/);
      expect(p.description).toContain("<li>");
      expect(p.description).not.toMatch(/\ba automobile/);
    }
  });

  it("shows salary as a monthly range, a single amount, or leaves it out", () => {
    expect((jobPosting(velli) as any).baseSalary).toEqual({
      "@type": "MonetaryAmount", currency: "INR", value: { "@type": "QuantitativeValue", minValue: 12000, maxValue: 18000, unitText: "MONTH" },
    });
    expect((jobPosting(cycle) as any).baseSalary.value).toEqual({ "@type": "QuantitativeValue", value: 15000, unitText: "MONTH" });
    expect("baseSalary" in jobPosting(titan)).toBe(false);
    expect(jobContent(velli).salary).toBe("₹12,000 – ₹18,000 per month");
  });

  it("keeps the posted date in India time", () => {
    expect((jobPosting({ ...velli, opened_at: "2026-10-28T20:00:00Z" }) as any).datePosted).toBe("2026-10-29");
  });
});
