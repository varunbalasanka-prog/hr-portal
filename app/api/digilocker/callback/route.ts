import { NextResponse, type NextRequest } from "next/server";
import { DOCTYPE_TO_KEY, digilockerEnabled, exchangeCode, fetchFile, listIssued, unsign } from "@/lib/digilocker";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** DigiLocker sends the candidate back here. We copy their certificates into their onboarding folder and return
 *  to the form with the saved paths, so they don't have to photograph those documents. */
export async function GET(req: NextRequest) {
  const raw = unsign(req.cookies.get("dl")?.value);
  const saved = raw ? (JSON.parse(raw) as { token: string; state: string; verifier: string }) : null;
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(saved ? `/onboard/${saved.token}?${q}` : "/", req.url));
    res.cookies.delete({ name: "dl", path: "/api/digilocker" });
    return res;
  };
  const code = req.nextUrl.searchParams.get("code");
  if (!digilockerEnabled() || !saved || !code || req.nextUrl.searchParams.get("state") !== saved.state) return back("dl_error=1");

  try {
    const access = await exchangeCode(code, saved.verifier);
    const docs = await listIssued(access);
    const wanted = new Map<string, string>(); // key -> uri
    for (const [doctype, key] of DOCTYPE_TO_KEY) {
      const d = docs.find((x) => x.doctype === doctype);
      if (d) wanted.set(key, d.uri);
    }
    const storage = createPublicClient().storage.from("onboarding-docs");
    const paths: Record<string, string> = {};
    for (const [key, uri] of wanted) {
      const f = await fetchFile(access, uri);
      if (f.bytes.byteLength > 8 * 1024 * 1024) continue;
      const ext = f.type === "application/pdf" ? "pdf" : f.type.split("/")[1] || "bin";
      const path = `${saved.token}/${key}_digilocker_${Date.now()}.${ext}`;
      const { error } = await storage.upload(path, new Blob([f.bytes], { type: f.type }), { contentType: f.type });
      if (!error) paths[key] = path;
    }
    return back(`dl=${Buffer.from(JSON.stringify(paths)).toString("base64url")}`);
  } catch {
    return back("dl_error=1");
  }
}
