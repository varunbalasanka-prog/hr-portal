import "server-only";
import { createVerify, X509Certificate } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";

/**
 * Free Aadhaar check, for candidates with or without DigiLocker. Both ways are signed by UIDAI, so the portal can
 * prove the details are genuine without calling any paid service:
 *  1. Secure QR: the QR printed on every Aadhaar card / e-Aadhaar / mAadhaar.
 *  2. Offline e-KYC: the ZIP file anyone can download from myaadhaar.uidai.gov.in, opened with their 4-character share code.
 * The signature is checked against UIDAI's public certificate(s), set in Vercel as UIDAI_OFFLINE_CERT (PEM; several may be
 * pasted one after another). Only name, birth date, gender and the last 4 digits are returned; the photo and address are dropped.
 */
export interface AadhaarResult { method: "secure qr" | "e-kyc"; name: string; dob: string; gender: string; last4: string }
export type AadhaarError = "off" | "unreadable" | "bad_signature" | "bad_code";

export const aadhaarCheckEnabled = () => certs().length > 0;

function certs(): string[] {
  const raw = (process.env.UIDAI_OFFLINE_CERT ?? "").replace(/\\n/g, "\n");
  return raw.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}

const GENDER: Record<string, string> = { M: "Male", F: "Female", T: "Transgender" };

/** Secure QR: a big decimal number -> bytes -> gzip -> fields split by 0xFF, then the photo, then a 256-byte RSA-SHA256 signature. */
export function verifySecureQr(text: string, pems: string[] = certs()): AadhaarResult | AadhaarError {
  if (!pems.length) return "off";
  const digits = text.trim();
  if (!/^\d{100,}$/.test(digits)) return "unreadable";
  let data: Buffer;
  try {
    let hex = BigInt(digits).toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    data = gunzipSync(Buffer.from(hex, "hex"));
  } catch {
    return "unreadable";
  }
  if (data.length < 300) return "unreadable";
  const signed = data.subarray(0, data.length - 256);
  const signature = data.subarray(data.length - 256);
  if (!pems.some((pem) => rsaOk(pem, signed, signature))) return "bad_signature";

  const fields: string[] = [];
  let start = 0;
  for (let i = 0; i < signed.length && fields.length < 6; i++) {
    if (signed[i] === 255) { fields.push(signed.subarray(start, i).toString("latin1")); start = i + 1; }
  }
  // Fields are ISO-8859-1 text. Version 2+ QRs start with "V2", "V3"...; older ones start straight with the email/mobile indicator.
  const f = /^V\d+$/.test(fields[0] ?? "") ? fields.slice(1) : fields;
  const [, ref, name, dob, gender] = f;
  if (!ref || !name) return "unreadable";
  return { method: "secure qr", name, dob: dob ?? "", gender: GENDER[gender] ?? gender ?? "", last4: ref.slice(0, 4) };
}

function rsaOk(pem: string, data: Buffer, signature: Buffer): boolean {
  try {
    const key = new X509Certificate(pem).publicKey;
    return createVerify("RSA-SHA256").update(data).verify(key, signature);
  } catch {
    return false;
  }
}

/** Offline e-KYC: password-protected ZIP (password = share code) holding one XML with an enveloped XML signature. */
export async function verifyEkycZip(zip: Blob, shareCode: string, pems: string[] = certs()): Promise<AadhaarResult | AadhaarError> {
  if (!pems.length) return "off";
  let xml: string;
  try {
    const reader = new ZipReader(new BlobReader(zip), { password: shareCode });
    const entries = await reader.getEntries();
    const entry = entries.find((e) => !e.directory && e.filename.toLowerCase().endsWith(".xml"));
    if (!entry || entry.directory) { await reader.close(); return "unreadable"; }
    try {
      xml = await entry.getData(new TextWriter());
    } catch (e) {
      await reader.close();
      return /password/i.test(String(e)) ? "bad_code" : "unreadable";
    }
    await reader.close();
  } catch {
    return "unreadable";
  }
  return verifyEkycXml(xml, pems);
}

export function verifyEkycXml(xml: string, pems: string[] = certs()): AadhaarResult | AadhaarError {
  if (!pems.length) return "off";
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as Document;
  } catch {
    return "unreadable";
  }
  const sigNode = doc.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Signature")[0];
  if (!sigNode) return "unreadable";
  const ok = pems.some((pem) => {
    try {
      const sig = new SignedXml({ publicCert: pem, getCertFromKeyInfo: () => null });
      sig.loadSignature(sigNode as unknown as Node);
      // The signature must cover the whole document (URI=""), so every detail read below is signed.
      return sig.checkSignature(xml) && sig.getSignedReferences().length === 1
        && (sigNode.getElementsByTagNameNS("http://www.w3.org/2000/09/xmldsig#", "Reference")[0]?.getAttribute("URI") ?? "x") === "";
    } catch {
      return false;
    }
  });
  if (!ok) return "bad_signature";
  const root = doc.documentElement;
  const poi = doc.getElementsByTagName("Poi")[0];
  const ref = root?.getAttribute("referenceId") ?? "";
  if (!poi || !ref) return "unreadable";
  const g = poi.getAttribute("gender") ?? "";
  return { method: "e-kyc", name: poi.getAttribute("name") ?? "", dob: poi.getAttribute("dob") ?? "", gender: GENDER[g] ?? g, last4: ref.slice(0, 4) };
}
