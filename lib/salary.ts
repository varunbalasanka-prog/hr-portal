/** ESI applies when the BASIC salary is under ₹21,000 (varun, 2026-11-06). Used by the letters and the onboarding form. */
export const ESI_BASIC_LIMIT = 21000;
export const esiApplies = (basic: number) => basic < ESI_BASIC_LIMIT;

export interface SalaryBreakup {
  basic: number;
  allowances: number;
  gross: number;
  esiEmployee: number;
  pfEmployee: number;
  takeHome: number;
  esiEmployer: number;
  pfEmployer: number;
  totalCtc: number;
}

/**
 * Same rules as the original calculate_salary():
 * ESI 0.75% employee / 3.25% employer when basic < 21,000;
 * PF 12% each side on basic capped at 25,000.
 */
export function calculateSalary(basicIn: number | string, allowancesIn: number | string): SalaryBreakup {
  const basic = Math.round(Number(basicIn) || 0);
  const allowances = Math.round(Number(allowancesIn) || 0);
  const gross = basic + allowances;
  const esiEmployee = esiApplies(basic) ? Math.round(basic * 0.0075) : 0;
  const pfBase = Math.min(basic, 25000);
  const pfEmployee = Math.round(pfBase * 0.12);
  const takeHome = Math.round(gross - (esiEmployee + pfEmployee));
  const esiEmployer = esiApplies(basic) ? Math.round(basic * 0.0325) : 0;
  const pfEmployer = Math.round(pfBase * 0.12);
  const totalCtc = Math.round(gross + esiEmployer + pfEmployer);
  return { basic, allowances, gross, esiEmployee, pfEmployee, takeHome, esiEmployer, pfEmployer, totalCtc };
}

export function rupees(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The offer letter opens only once an admin has approved the salary (salaries from before the approval step count as approved). */
export const salaryApproved = (c: { salary_status?: string | null; basic_salary: number }) =>
  c.salary_status === "approved" || (!c.salary_status && Number(c.basic_salary) > 0);
