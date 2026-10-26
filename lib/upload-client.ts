"use client";
import { createClient } from "@supabase/supabase-js";
import { ALLOWED_TYPES, MAX_FILE_BYTES } from "./onboarding";

/**
 * Files go from the browser straight to Supabase Storage, never through a Vercel function
 * (which rejects request bodies over 4.5 MB). Storage rules decide which folder the public key may write to.
 */
export function browserStorage() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
}

const SHRINK_ABOVE = 600 * 1024;
const MAX_SIDE = 1600;

/** Phone photos are 2-5 MB; documents stay readable at 1600 px. Returns the original if the browser can't decode it
 *  (e.g. HEIC outside Safari) or if shrinking doesn't help. PDFs are never touched. */
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= SHRINK_ABOVE) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export const extFor = (type: string) => (type === "application/pdf" ? "pdf" : type.split("/")[1] || "bin");

/** Checks type and size after shrinking. Returns an error message or null. */
export function checkFile(f: File, label: string): string | null {
  if (!ALLOWED_TYPES.includes(f.type)) return `${label}: photo or PDF only / புகைப்படம் அல்லது PDF மட்டும்.`;
  if (f.size > MAX_FILE_BYTES) return `${label}: larger than 5 MB / 5 MB-க்கு மேல் உள்ளது.`;
  return null;
}
