import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** The visitor's IP (Vercel sets x-forwarded-for) and a salted hash of it for rate limits, so raw IPs aren't stored. */
export async function clientIp(): Promise<{ ip: string | null; hash: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const hash = createHash("sha256").update(`${process.env.APPLY_SECRET ?? ""}:${ip ?? "unknown"}`).digest("hex").slice(0, 32);
  return { ip, hash };
}
