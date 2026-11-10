"use client";
import { useRef } from "react";
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

/**
 * Copies a picked file into the page's memory. On Android, a photo picked from Google Photos, Drive or WhatsApp
 * can stop being readable a little later (the app only lends it); the upload then dies on the phone before it
 * leaves (the server sees nothing, the candidate sees "Upload failed"). Reading it straight away avoids that.
 * Returns null if the phone won't let us read it at all.
 */
export async function prepareFile(raw: File): Promise<File | null> {
  try {
    const small = await shrinkImage(raw);
    if (small !== raw) return small;
    return new File([await raw.arrayBuffer()], raw.name, { type: raw.type });
  } catch {
    return null;
  }
}

/**
 * Reads each file the moment it is picked (attach `onChange` to the form), so the bytes are safe in memory by
 * the time Submit is tapped. `take` gives the prepared file for an input, preparing it then if it wasn't yet.
 */
export function usePickedFiles() {
  const ready = useRef(new Map<string, { raw: File; file: Promise<File | null> }>());
  function onChange(e: React.FormEvent<HTMLFormElement>) {
    const el = e.target as HTMLInputElement;
    if (el?.type !== "file" || !el.name) return;
    const raw = el.files?.[0];
    if (raw && raw.size > 0) ready.current.set(el.name, { raw, file: prepareFile(raw) });
    else ready.current.delete(el.name);
  }
  function take(name: string, raw: File): Promise<File | null> {
    const got = ready.current.get(name);
    if (got && got.raw === raw) return got.file;
    const file = prepareFile(raw);
    ready.current.set(name, { raw, file });
    return file;
  }
  return { onChange, take };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uploads with up to 3 tries (phones on weak signal drop requests). A copy that already landed counts as done. */
export async function uploadFile(bucket: string, path: string, file: File): Promise<boolean> {
  const storage = browserStorage();
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await wait(attempt * 2000);
    const { error } = await storage.from(bucket).upload(path, file, { contentType: file.type });
    if (!error) return true;
    const status = String((error as { statusCode?: string | number }).statusCode ?? "");
    if (status === "409" || /exists|duplicate/i.test(error.message)) return true;
    if (["400", "403", "413", "415"].includes(status)) return false;
  }
  return false;
}

export const unreadableMessage = (label: string) =>
  `Could not read ${label} from your phone. Please choose the file again, or take a new photo. / கோப்பைப் படிக்க முடியவில்லை. மீண்டும் தேர்வு செய்யவும் அல்லது புதிய புகைப்படம் எடுக்கவும்.`;

export const uploadFailedMessage = (label: string) =>
  `Upload failed / பதிவேற்றம் தோல்வி: ${label}. Please check your internet and tap Submit again; your answers are kept. / இணையத்தைச் சரிபார்த்து மீண்டும் சமர்ப்பிக்கவும்.`;
