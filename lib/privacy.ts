/** Privacy notice shown on /apply and /onboard. Bump CONSENT_VERSION whenever the wording changes; each
 *  application and onboarding submission stores the version the person agreed to. */
export const CONSENT_VERSION = "2026-10-24";

export type PrivacyContact = { name: string; phone: string; email: string; address: string };

export const DEFAULT_CONTACT: PrivacyContact = {
  name: "HR Department, Balasanka Group of Companies", phone: "", email: "", address: "Theni, Tamil Nadu",
};

/** Settings value from app_settings 'retention_months': a whole number of months, or null when clean-up is off. */
export function cleanRetention(v: unknown): number | null {
  const n = Number(v);
  return v === null || v === "" || !Number.isInteger(n) || n < 6 ? null : n;
}
