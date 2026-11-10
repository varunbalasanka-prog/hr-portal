import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ storage: { from: () => ({ upload }) } }) }));
vi.useFakeTimers();

import { prepareFile, uploadFile } from "../lib/upload-client";

const pdf = () => new File(["%PDF-1.4"], "a.pdf", { type: "application/pdf" });
const run = async (p: Promise<boolean>) => { await vi.runAllTimersAsync(); return p; };

describe("prepareFile", () => {
  it("copies the bytes into memory", async () => {
    const raw = pdf();
    const f = await prepareFile(raw);
    expect(f).not.toBe(raw);
    expect(f?.type).toBe("application/pdf");
    expect(await f?.text()).toBe("%PDF-1.4");
  });
  it("returns null when the phone won't let the file be read", async () => {
    const raw = pdf();
    raw.arrayBuffer = () => Promise.reject(new Error("NotReadableError"));
    expect(await prepareFile(raw)).toBeNull();
  });
});

describe("uploadFile", () => {
  beforeEach(() => upload.mockReset());
  it("retries a dropped connection", async () => {
    upload.mockResolvedValueOnce({ error: new Error("Failed to fetch") }).mockResolvedValueOnce({ error: null });
    expect(await run(uploadFile("b", "p", pdf()))).toBe(true);
    expect(upload).toHaveBeenCalledTimes(2);
  });
  it("gives up after three tries", async () => {
    upload.mockResolvedValue({ error: new Error("Failed to fetch") });
    expect(await run(uploadFile("b", "p", pdf()))).toBe(false);
    expect(upload).toHaveBeenCalledTimes(3);
  });
  it("counts a copy that already landed as done", async () => {
    upload.mockResolvedValueOnce({ error: Object.assign(new Error("The resource already exists"), { statusCode: "409" }) });
    expect(await run(uploadFile("b", "p", pdf()))).toBe(true);
  });
  it("does not retry a refusal", async () => {
    upload.mockResolvedValue({ error: Object.assign(new Error("new row violates row-level security policy"), { statusCode: "403" }) });
    expect(await run(uploadFile("b", "p", pdf()))).toBe(false);
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
