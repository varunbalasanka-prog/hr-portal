import "server-only";
import webpush from "web-push";
import { createPublicClient } from "./supabase/public";

type Payload = { title: string; body: string; url?: string };

const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
export const pushEnabled = () => !!(PUBLIC && PRIVATE);

/** Sends a phone notification to every device a staff member installed the portal on. Does nothing until the
 *  VAPID keys are set (npx web-push generate-vapid-keys). Never throws: a failed push must not fail the action. */
export async function pushTo(username: string, payload: Payload) {
  if (!PUBLIC || !PRIVATE || !username) return;
  try {
    webpush.setVapidDetails(`mailto:${process.env.PUSH_CONTACT_EMAIL || "hr@balasanka.in"}`, PUBLIC, PRIVATE);
    const db = createPublicClient();
    const secret = process.env.APPLY_SECRET ?? "";
    const { data } = await db.rpc("push_targets", { p_secret: secret, p_username: username });
    await Promise.all(((data ?? []) as { endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 86400 });
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.rpc("forget_push", { p_secret: secret, p_endpoint: s.endpoint }); // phone unsubscribed
      }
    }));
  } catch {
    // ignore
  }
}
