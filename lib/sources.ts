/** Where an applicant heard about the job. Poster QR codes and the careers page add ?src=<key> to the /apply link;
 *  otherwise the applicant picks one. Keys are stored, labels are shown. */
export const SOURCES: Record<string, string> = {
  poster: "Poster at a showroom / ஷோரூம் போஸ்டர்",
  careers: "Our careers page / எங்கள் வேலைவாய்ப்புப் பக்கம்",
  whatsapp: "WhatsApp message / வாட்ஸ்அப் செய்தி",
  facebook: "Facebook / Instagram",
  referral: "A friend working here / இங்கு பணிபுரியும் நண்பர்",
  newspaper: "Newspaper / செய்தித்தாள்",
  job_portal: "Job website (Naukri, Indeed, Apna…) / வேலை இணையதளம்",
  walk_past: "Saw the showroom / ஷோரூமைப் பார்த்தேன்",
  other: "Other / மற்றவை",
};

export const sourceLabel = (key: string | null | undefined) =>
  key ? (SOURCES[key] ?? key).split(" / ")[0] : "Not recorded";

/** A ?src value from a link: lowercase letters, digits, - and _, at most 40 characters. */
export const cleanSource = (v: string | null | undefined) => {
  const s = String(v ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  return s || null;
};
