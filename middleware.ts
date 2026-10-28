import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PREFIXES = ["/login", "/onboard", "/letters", "/api/sync-sheet", "/api/cleanup", "/api/digilocker", "/apply", "/j/", "/privacy", "/careers", "/robots.txt", "/sitemap.xml", "/llms.txt", "/indexnow-"];
// Candidate pages and crons never need a staff session, so skip the Supabase round trip there.
const NO_SESSION = ["/onboard", "/letters", "/api/cron", "/api/cleanup", "/api/sync-sheet", "/api/digilocker", "/apply", "/j/", "/privacy", "/careers", "/robots.txt", "/sitemap.xml", "/llms.txt", "/indexnow-"];

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
    // Visitors (and search engines) opening the bare domain see the jobs; staff use the login link there.
    url.pathname = path === "/" ? "/careers" : "/login";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|balasanka_logo.png|icon-192.png|icon-512.png|sw.js|manifest.webmanifest).*)"],
};
