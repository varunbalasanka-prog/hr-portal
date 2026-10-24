"use server";
import { requireProfile } from "@/lib/auth";

/** Saves this phone/browser so the staff member gets push notifications. */
export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { profile, supabase } = await requireProfile();
  if (!/^https:\/\//.test(sub.endpoint)) return { ok: false, message: "Bad subscription." };
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: sub.endpoint, username: profile.username, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
  });
  return error ? { ok: false, message: error.message } : { ok: true, message: "Notifications are on for this device." };
}

export async function removePushSubscription(endpoint: string) {
  const { supabase } = await requireProfile();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true, message: "Notifications are off for this device." };
}
