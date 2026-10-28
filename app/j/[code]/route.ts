import { NextResponse, type NextRequest } from "next/server";
import { loadApplyConfig } from "@/app/apply/config";
import { branchForCode } from "@/lib/short-link";

export const dynamic = "force-dynamic";

/** Short poster link: /j/<code> opens the apply page locked to that branch, counted as source "poster".
 *  A branch with no open posts (or an unknown code) lands on the careers page instead. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const [{ code }, config] = await Promise.all([params, loadApplyConfig()]);
  const branch = config ? branchForCode(code, config.branches) : null;
  const url = request.nextUrl.clone();
  url.search = "";
  if (branch) {
    url.pathname = "/apply";
    url.searchParams.set("branch", branch.id);
    url.searchParams.set("src", "poster");
  } else {
    url.pathname = "/careers";
  }
  return NextResponse.redirect(url, 307);
}
