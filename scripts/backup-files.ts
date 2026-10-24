/**
 * Copies every uploaded file (applications, onboarding documents, avatars, notification files) to
 * backups/files-<date>/ on this computer:  npm run backup:files
 * Signs in as the sync admin account from .env.local. Run it monthly and keep the folder on an external drive.
 * Files already downloaded by an earlier run in the same folder are skipped.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createSyncClient } from "../lib/supabase/sync";

const BUCKETS = ["applications", "onboarding-docs", "avatars", "notification-files"];
const out = join("backups", `files-${new Date().toISOString().slice(0, 10)}`);

async function main() {
  const db = await createSyncClient();
  let count = 0;
  for (const bucket of BUCKETS) {
    const walk = async (prefix: string): Promise<void> => {
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
        if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
        for (const item of data ?? []) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (!item.id) { await walk(path); continue; } // a folder
          const target = join(out, bucket, path);
          if (existsSync(target)) continue;
          const { data: blob, error: e } = await db.storage.from(bucket).download(path);
          if (e || !blob) { console.warn(`skip ${bucket}/${path}: ${e?.message}`); continue; }
          mkdirSync(dirname(target), { recursive: true });
          writeFileSync(target, Buffer.from(await blob.arrayBuffer()));
          count++;
        }
        if ((data ?? []).length < 1000) break;
      }
    };
    await walk("");
  }
  console.log(`Saved ${count} new file(s) to ${out}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
