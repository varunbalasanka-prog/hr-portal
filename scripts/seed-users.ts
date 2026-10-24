/**
 * Writes the SQL that creates branches and staff logins:  npm run seed:users
 * Paste seed-users.local.sql into the Supabase SQL editor (it needs the database owner, which the
 * app never has). Every account gets a random password, listed in passwords.local.txt.
 * Both files are gitignored. Share each password privately, then delete the files.
 * Running it again skips accounts that already exist (but writes new passwords for them to the list,
 * which won't work, so only use the list from the first run).
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import branches from "./data/branches.json";
import { usernameToEmail } from "../lib/usernames";

const password = () => randomBytes(9).toString("base64url");
const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);

const STAFF: { username: string; full_name: string; role: string; branch?: string }[] = [
  { username: "admin", full_name: "Administrator", role: "admin" },
  { username: "lithiga", full_name: "Lithiga", role: "hr" },
  { username: "aarthi", full_name: "Aarthi", role: "hr" },
  { username: "rishi", full_name: "Rishi", role: "hr" },
  // Used only by the 15-minute Sheet sync and the import script.
  { username: "sheet-sync", full_name: "Google Sheet sync", role: "admin" },
  ...branches.map((b) => ({ username: b.name.toLowerCase(), full_name: b.name, role: "branch", branch: b.name })),
];

const sql: string[] = [
  "insert into branches (name, town, address, business_type, hr_username) values",
  branches.map((b) => `  (${q(b.name)}, ${q(b.town)}, ${q(b.address)}, ${q(b.business_type)}, ${q(b.hr)})`).join(",\n"),
  "on conflict (name) do update set town = excluded.town, address = excluded.address, business_type = excluded.business_type, hr_username = excluded.hr_username;",
  "",
];
const list: string[] = [];
for (const s of STAFF) {
  const pw = password();
  const branch = s.branch ? `(select id from branches where name = ${q(s.branch)})` : "null";
  sql.push(`select create_staff_user(${q(s.username)}, ${q(s.full_name)}, ${q(s.role)}, ${branch}, ${q(usernameToEmail(s.username))}, ${q(pw)})
  where not exists (select 1 from profiles where username = ${q(s.username)});`);
  list.push(`${s.username.padEnd(34)} ${pw}`);
}
writeFileSync("seed-users.local.sql", sql.join("\n") + "\n");
writeFileSync("passwords.local.txt", list.join("\n") + "\n");
console.log(`Wrote seed-users.local.sql and passwords.local.txt (${STAFF.length} accounts).`);
