import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/careers";

/** Search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini...) may read the public job pages.
 *  Staff pages, candidate letters and onboarding links stay out. */
const PRIVATE = ["/dashboard", "/admin", "/reports", "/manpower", "/documents", "/letters", "/onboard", "/login", "/api", "/careers/poster"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/careers", "/apply", "/privacy", "/llms.txt"], disallow: PRIVATE }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
