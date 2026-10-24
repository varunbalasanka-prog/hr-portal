import "server-only";

/**
 * WhatsApp Business Cloud API (Meta). Switched off until these are set in Vercel:
 *   WHATSAPP_TOKEN (permanent system-user token), WHATSAPP_PHONE_ID (the business phone number id).
 * Meta allows free-text messages only within 24 hours of the candidate's last message; outside that window it
 * needs an approved template. WHATSAPP_TEMPLATE (default "hr_message") must be a UTILITY template with one body
 * variable {{1}}, approved in WhatsApp Manager; the chosen message text goes into it.
 */
export const whatsappApiEnabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

export async function sendWhatsApp(mobile: string, text: string): Promise<{ ok: boolean; message: string }> {
  if (!whatsappApiEnabled()) return { ok: false, message: "WhatsApp API is not set up." };
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`;
  const post = (body: object) => fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: `91${mobile}`, ...body }),
  });
  // Templates can't contain newlines in variables, and are capped at 1024 characters.
  const param = text.replace(/\n+/g, " · ").slice(0, 1000);
  const res = await post({
    type: "template",
    template: {
      name: process.env.WHATSAPP_TEMPLATE || "hr_message", language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
      components: [{ type: "body", parameters: [{ type: "text", text: param }] }],
    },
  });
  if (res.ok) return { ok: true, message: "Sent on WhatsApp." };
  const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return { ok: false, message: `WhatsApp did not send: ${err?.error?.message ?? res.status}` };
}
