import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * DigiLocker (MeriPehchaan / API Setu "Pull documents" OAuth). Switched off until a partner account is approved and
 * these are set in Vercel: DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET, DIGILOCKER_REDIRECT_URI
 * (https://hr.balasanka.in/api/digilocker/callback). DIGILOCKER_BASE can point at the sandbox.
 * Aadhaar is NOT pulled: the onboarding form takes the Aadhaar as a photo, checked with the free UIDAI QR or e-KYC file (lib/aadhaar.ts).
 */
const BASE = () => (process.env.DIGILOCKER_BASE || "https://digilocker.meripehchaan.gov.in/public/oauth2").replace(/\/$/, "");
export const digilockerEnabled = () =>
  !!(process.env.DIGILOCKER_CLIENT_ID && process.env.DIGILOCKER_CLIENT_SECRET && process.env.DIGILOCKER_REDIRECT_URI);

/** DigiLocker document types we take, and the onboarding document each fills. Later entries win (12th over 10th). */
export const DOCTYPE_TO_KEY: [string, string][] = [
  ["SSCER", "school_certificate"], ["HSCER", "school_certificate"], ["PANCR", "pan_card"], ["DRVLC", "driving_license"],
];

const b64url = (b: Buffer) => b.toString("base64url");
export const newVerifier = () => b64url(randomBytes(48));
const challenge = (verifier: string) => b64url(createHash("sha256").update(verifier).digest());

export function authorizeUrl(state: string, verifier: string) {
  const q = new URLSearchParams({
    response_type: "code", client_id: process.env.DIGILOCKER_CLIENT_ID!, redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
    state, code_challenge: challenge(verifier), code_challenge_method: "S256",
  });
  return `${BASE()}/1/authorize?${q}`;
}

export async function exchangeCode(code: string, verifier: string): Promise<string> {
  const res = await fetch(`${BASE()}/1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, code_verifier: verifier, redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
      client_id: process.env.DIGILOCKER_CLIENT_ID!, client_secret: process.env.DIGILOCKER_CLIENT_SECRET!,
    }),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string } | null;
  if (!res.ok || !data?.access_token) throw new Error(`token ${res.status}`);
  return data.access_token;
}

export type IssuedDoc = { uri: string; doctype: string; name: string; mime: string[] | string };

export async function listIssued(accessToken: string): Promise<IssuedDoc[]> {
  const res = await fetch(`${BASE()}/2/files/issued`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`issued ${res.status}`);
  const data = (await res.json()) as { items?: IssuedDoc[] };
  return data.items ?? [];
}

export async function fetchFile(accessToken: string, uri: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const res = await fetch(`${BASE()}/1/file/${encodeURIComponent(uri)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`file ${res.status}`);
  return { bytes: await res.arrayBuffer(), type: res.headers.get("content-type")?.split(";")[0] || "application/pdf" };
}

/** Signs the cookie that carries the onboarding token and PKCE verifier across the DigiLocker round trip. */
const key = () => process.env.APPLY_SECRET || "";
export const sign = (value: string) => `${value}.${createHmac("sha256", key()).update(value).digest("base64url")}`;
export function unsign(signed: string | undefined): string | null {
  if (!signed || !key()) return null;
  const i = signed.lastIndexOf(".");
  const value = signed.slice(0, i), mac = Buffer.from(signed.slice(i + 1));
  const want = Buffer.from(createHmac("sha256", key()).update(value).digest("base64url"));
  return mac.length === want.length && timingSafeEqual(mac, want) ? value : null;
}
