import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/onboard", "/letters", "/api/sync-sheet", "/api/cleanup", "/apply", "/privacy"];
// Candidate pages and crons never need a staff session, so skip the Supabase round trip there.
const NO_SESSION = ["/onboard", "/letters", "/api/", "/apply", "/privacy"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (NO_SESSION.some((p) => path.startsWith(p))) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const isPublic = path === "/" ? false : PUBLIC_PREFIXES.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|balasanka_logo.png).*)"],
};
