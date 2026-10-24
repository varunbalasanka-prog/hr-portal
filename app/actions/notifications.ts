"use server";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export async function sendNotification(formData: FormData) {
  const { profile, supabase } = await requireProfile();
  const recipient = String(formData.get("recipient") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!recipient || !message) return { ok: false, message: "Recipient and message are required." };

  let file_path: string | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { ok: false, message: "File must be under 10 MB." };
    const path = `${profile.username}/${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await supabase.storage.from("notification-files").upload(path, file, { contentType: file.type });
    if (error) return { ok: false, message: `Upload failed: ${error.message}` };
    file_path = path;
  }
  const { error } = await supabase.from("notifications").insert({ sender: profile.username, recipient, message, file_path });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Notification sent." };
}

async function upsertReceipt(id: number, field: "viewed_at" | "cleared_at") {
  const { profile, supabase } = await requireProfile();
  await supabase.from("notification_receipts").upsert(
    { notification_id: id, username: profile.username, [field]: new Date().toISOString() },
    { onConflict: "notification_id,username" },
  );
  return { profile, supabase };
}

export async function markNotificationViewed(id: number) {
  await upsertReceipt(id, "viewed_at");
  revalidatePath("/dashboard");
}

export async function clearNotification(id: number) {
  const { profile, supabase } = await upsertReceipt(id, "cleared_at");
  if (profile.role === "admin") await supabase.from("notifications").delete().eq("id", id);
  revalidatePath("/dashboard");
}

export async function notificationFileUrl(path: string) {
  const { supabase } = await requireProfile();
  const { data } = await supabase.storage.from("notification-files").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
