/**
 * Creates branches and staff logins. Run once:  npm run seed:users
 * Every account gets a random password, printed once at the end. Share them privately and ask
 * people to change them under Profile settings. Nothing is written to disk.
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import branches from "./data/branches.json";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const domain = process.env.AUTH_EMAIL_DOMAIN ?? "staff.balasanka-hr.local";
const emailFor = (u: string) => `${u.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}@${domain}`;
const password = () => randomBytes(9).toString("base64url");

const STAFF = [
  { username: "admin", full_name: "Administrator", role: "admin" },
  { username: "lithiga", full_name: "Lithiga", role: "hr" },
  { username: "aarthi", full_name: "Aarthi", role: "hr" },
  { username: "rishi", full_name: "Rishi", role: "hr" },
] as const;

async function ensureUser(username: string, full_name: string, role: string, branch_id: string | null, out: string[][]) {
  const { data: exists } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (exists) return;
  const pw = password();
  const { data, error } = await db.auth.admin.createUser({ email: emailFor(username), password: pw, email_confirm: true });
  if (error) throw new Error(`${username}: ${error.message}`);
  const { error: pErr } = await db.from("profiles").insert({ id: data.user.id, username, full_name, role, branch_id });
  if (pErr) throw new Error(`${username}: ${pErr.message}`);
  out.push([username, pw]);
}

async function main() {
  const { error } = await db.from("branches").upsert(
    branches.map((b) => ({ name: b.name, town: b.town, address: b.address, business_type: b.business_type, hr_username: b.hr })),
    { onConflict: "name" },
  );
  if (error) throw error;
  const { data: rows } = await db.from("branches").select("id, name");
  const created: string[][] = [];
  for (const s of STAFF) await ensureUser(s.username, s.full_name, s.role, null, created);
  for (const b of rows ?? []) await ensureUser(b.name.toLowerCase(), b.name, "branch", b.id, created);
  console.log(`\n${created.length} accounts created. Passwords (shown once):\n`);
  created.forEach(([u, p]) => console.log(`${u.padEnd(34)} ${p}`));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
