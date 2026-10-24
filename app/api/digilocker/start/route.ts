import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl, digilockerEnabled, newVerifier, sign } from "@/lib/digilocker";
import { isToken } from "@/lib/candidate-token";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

/** The onboarding form's "Get from DigiLocker" button lands here, then goes to DigiLocker to sign in. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!digilockerEnabled() || !isToken(token)) return NextResponse.redirect(new URL("/", req.url));
  const { data: open } = await createPublicClient().rpc("onboarding_open", { p_token: token });
  if (!open) return NextResponse.redirect(new URL(`/onboard/${token}`, req.url));
  const state = randomBytes(16).toString("base64url");
  const verifier = newVerifier();
  const res = NextResponse.redirect(authorizeUrl(state, verifier));
  res.cookies.set("dl", sign(JSON.stringify({ token, state, verifier })), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/digilocker", maxAge: 600,
  });
  return res;
}
