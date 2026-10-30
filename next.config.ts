import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const turnstile = "https://challenges.cloudflare.com";
// `next dev` evaluates code at runtime; production builds don't need 'unsafe-eval'.
const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
// 'unsafe-inline' scripts are needed by Next.js without per-request nonces; everything else is locked to this site,
// Supabase and Cloudflare's human check. vercel.live is the preview-deployment comment toolbar.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval} ${turnstile} https://vercel.live`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabase.replace(/^https/, "wss")} https://vercel.live`,
  `frame-src ${turnstile} https://vercel.live ${supabase}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Files go straight from the browser to Supabase Storage; Vercel rejects bodies over 4.5 MB anyway.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: csp },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ] }];
  },
};
export default nextConfig;
