import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { gzipSync } from "node:zlib";
import { BlobReader, BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { SignedXml } from "xml-crypto";

vi.mock("server-only", () => ({}));
const { verifyEkycXml, verifyEkycZip, verifySecureQr } = await import("../lib/aadhaar");
const { familyRequirements, insuranceQuestion, namesMatch, normalizeMarital } = await import("../lib/onboarding");

// A throwaway key pair standing in for UIDAI's (the real certificate goes in UIDAI_OFFLINE_CERT).
const dir = new URL("./fixtures/", import.meta.url);
const KEY = readFileSync(new URL("test-uidai.key", dir), "utf8");
const CERT = readFileSync(new URL("test-uidai.crt", dir), "utf8");
const OTHER = readFileSync(new URL("other.crt", dir), "utf8");

function secureQr(fields: string[], tamper = false): string {
  const body = Buffer.concat([Buffer.from(fields.join("\xff"), "latin1"), Buffer.from([0xff]), Buffer.alloc(400, 7)]);
  const sig = createSign("RSA-SHA256").update(body).sign(KEY);
  if (tamper) body[10] ^= 1;
  return BigInt(`0x${gzipSync(Buffer.concat([body, sig])).toString("hex")}`).toString();
}

const QR_FIELDS = ["V2", "3", "123420190101120000123", "Ravi Kumar", "01-01-2000", "M", "S/O Murugan", "Chennai", "", "12", "", "600001", "", "Tamil Nadu", "", "", "", "9876"];

describe("Aadhaar Secure QR", () => {
  it("reads a correctly signed V2 QR", () => {
    expect(verifySecureQr(secureQr(QR_FIELDS), [CERT])).toEqual({ method: "secure qr", name: "Ravi Kumar", dob: "01-01-2000", gender: "Male", last4: "1234" });
  });
  it("reads an old-format QR (no version field)", () => {
    expect(verifySecureQr(secureQr(QR_FIELDS.slice(1)), [CERT])).toMatchObject({ name: "Ravi Kumar", last4: "1234" });
  });
  it("rejects a changed QR or another signer", () => {
    expect(verifySecureQr(secureQr(QR_FIELDS, true), [CERT])).toBe("bad_signature");
    expect(verifySecureQr(secureQr(QR_FIELDS), [OTHER])).toBe("bad_signature");
    expect(verifySecureQr(secureQr(QR_FIELDS), [OTHER, CERT])).toMatchObject({ name: "Ravi Kumar" });
  });
  it("handles junk and a missing certificate", () => {
    expect(verifySecureQr("hello", [CERT])).toBe("unreadable");
    expect(verifySecureQr("1".repeat(200), [CERT])).toBe("unreadable");
    expect(verifySecureQr(secureQr(QR_FIELDS), [])).toBe("off");
  });
});

function ekycXml(name = "Priya S"): string {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><OfflinePaperlessKyc referenceId="567820240101101010101"><UidData><Poi dob="15-06-1999" e="" gender="F" m="" name="${name}"/><Poa country="India" state="Tamil Nadu"/><Pht>AAAA</Pht></UidData></OfflinePaperlessKyc>`;
  const sig = new SignedXml({ privateKey: KEY, signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315" });
  sig.addReference({ xpath: "/*", uri: "", isEmptyUri: true, digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"] });
  sig.computeSignature(xml);
  return sig.getSignedXml();
}

async function zipWith(xml: string, password: string): Promise<Blob> {
  const w = new ZipWriter(new BlobWriter("application/zip"), { password });
  await w.add("offlineaadhaar20241001.xml", new TextReader(xml));
  return w.close();
}

describe("Aadhaar offline e-KYC", () => {
  it("reads a correctly signed XML", () => {
    expect(verifyEkycXml(ekycXml(), [CERT])).toEqual({ method: "e-kyc", name: "Priya S", dob: "15-06-1999", gender: "Female", last4: "5678" });
  });
  it("rejects an edited XML or another signer", () => {
    expect(verifyEkycXml(ekycXml().replace('name="Priya S"', 'name="Someone Else"'), [CERT])).toBe("bad_signature");
    expect(verifyEkycXml(ekycXml(), [OTHER])).toBe("bad_signature");
    expect(verifyEkycXml("<a/>", [CERT])).toBe("unreadable");
  });
  it("opens the ZIP with the share code", async () => {
    const zip = await zipWith(ekycXml(), "AB12");
    expect(await verifyEkycZip(zip, "AB12", [CERT])).toMatchObject({ name: "Priya S", last4: "5678" });
    expect(await verifyEkycZip(zip, "ZZZZ", [CERT])).toBe("bad_code");
    expect(await verifyEkycZip(new Blob(["not a zip"]), "AB12", [CERT])).toBe("unreadable");
  });
});

describe("onboarding rules", () => {
  it("asks ESI up to ₹21,000 gross, UAN above", () => {
    expect(insuranceQuestion(21000)).toBe("esi");
    expect(insuranceQuestion(0)).toBe("esi");
    expect(insuranceQuestion(21001)).toBe("uan");
  });
  it("family section depends on marital status", () => {
    expect(familyRequirements("Unmarried", 0)).toEqual({ fields: ["mother_name"], docs: ["father_aadhar", "father_photo", "mother_aadhar", "mother_photo"] });
    expect(familyRequirements("Married", 2)).toEqual({
      fields: ["spouse_name", "kids_count", "kid_1_name", "kid_2_name"],
      docs: ["spouse_aadhar", "spouse_photo", "kid_1_aadhar", "kid_1_photo", "kid_2_aadhar", "kid_2_photo"],
    });
    expect(normalizeMarital("Single")).toBe("Unmarried");
    expect(normalizeMarital("Married")).toBe("Married");
    expect(normalizeMarital("")).toBe("");
  });
  it("matches names loosely", () => {
    expect(namesMatch("RAVI KUMAR", "Ravi Kumar M")).toBe(true);
    expect(namesMatch("S. Priya", "Priya S")).toBe(true);
    expect(namesMatch("Arun", "Ravi Kumar")).toBe(false);
  });
});
