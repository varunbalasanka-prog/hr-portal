"use client";
import { useEffect, useRef, useState } from "react";
import { verifyAadhaarFile, verifyAadhaarQr } from "./actions";

type Reply = { ok: boolean; message: string; name?: string };
type Mode = "" | "camera" | "file";

/** Free Aadhaar check: scan the QR on the card (camera or photo), or upload the offline e-KYC ZIP with its share code.
 *  Optional: anyone who skips it has their original Aadhaar seen by HR. */
export function AadhaarCheck({ token, enabled }: { token: string; enabled: boolean }) {
  const [mode, setMode] = useState<Mode>("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);
  if (!enabled) return null;

  const send = async (fn: () => Promise<Reply>) => {
    setBusy(true);
    setReply(null);
    try { setReply(await fn()); } catch { setReply({ ok: false, message: "Could not check. Please try again. / மீண்டும் முயற்சிக்கவும்." }); }
    setBusy(false);
  };
  const onQr = (text: string) => { setMode(""); void send(() => verifyAadhaarQr(token, text)); };

  if (reply?.ok) {
    return <p role="status" className="rounded bg-green-50 p-2 text-sm font-semibold text-green-800">✓ {reply.message}{reply.name ? `: ${reply.name}` : ""}</p>;
  }
  return (
    <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <p className="font-semibold">Verify your Aadhaar (free, optional) / ஆதாரைச் சரிபார்க்கவும் (இலவசம், விருப்பம்)</p>
      <p className="text-xs text-slate-600">Scan the QR code printed on your Aadhaar, or upload the e-KYC file. If you skip this, HR will check your original Aadhaar when you join.
        <br />ஆதாரில் உள்ள QR-ஐ ஸ்கேன் செய்யவும் அல்லது e-KYC கோப்பைப் பதிவேற்றவும். இல்லையெனில் பணியில் சேரும்போது HR அசல் ஆதாரைப் பார்ப்பார்.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline" disabled={busy} onClick={() => setMode(mode === "camera" ? "" : "camera")}>Scan QR with camera / கேமரா</button>
        <label className="btn-outline cursor-pointer">
          QR photo / QR புகைப்படம்
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setBusy(true);
            const text = await decodeImage(f).catch(() => null);
            setBusy(false);
            if (text) onQr(text);
            else setReply({ ok: false, message: "No Aadhaar QR found in the photo. Take a close, sharp photo of just the QR. / புகைப்படத்தில் QR கிடைக்கவில்லை." });
          }} />
        </label>
        <button type="button" className="btn-outline" disabled={busy} onClick={() => setMode(mode === "file" ? "" : "file")}>e-KYC file / e-KYC கோப்பு</button>
      </div>
      {mode === "camera" && <Camera onText={onQr} onError={(m) => { setMode(""); setReply({ ok: false, message: m }); }} />}
      {mode === "file" && <EkycFile busy={busy} onSubmit={(fd) => send(() => verifyAadhaarFile(token, fd))} />}
      {busy && <p className="text-xs" aria-live="polite">Checking… / சரிபார்க்கிறது…</p>}
      {reply && !reply.ok && <p role="alert" className="text-xs text-red-700">{reply.message}</p>}
    </div>
  );
}

function EkycFile({ busy, onSubmit }: { busy: boolean; onSubmit: (fd: FormData) => void }) {
  const zip = useRef<HTMLInputElement>(null);
  const code = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2 rounded border border-slate-200 bg-white p-2">
      <p className="text-xs text-slate-600">
        On <b>myaadhaar.uidai.gov.in</b>, log in with your Aadhaar and OTP, open <b>Offline e-KYC</b>, type any 4-character share code and download the ZIP file.
        <br />myaadhaar.uidai.gov.in-இல் Offline e-KYC திறந்து, 4 எழுத்துப் பகிர்வுக் குறியீடு கொடுத்து ZIP கோப்பைப் பதிவிறக்கவும்.
      </p>
      {/* Not a nested <form>: this sits inside the onboarding form, so the fields are read directly. */}
      <input ref={zip} type="file" accept=".zip,application/zip" className="input" aria-label="e-KYC ZIP file" />
      <input ref={code} className="input" maxLength={4} placeholder="Share code / பகிர்வுக் குறியீடு" aria-label="Share code" />
      <button type="button" className="btn-primary" disabled={busy} onClick={() => {
        const fd = new FormData();
        const f = zip.current?.files?.[0];
        if (f) fd.set("zip", f);
        fd.set("share_code", code.current?.value ?? "");
        onSubmit(fd);
      }}>Check file / சரிபார்</button>
    </div>
  );
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
const nativeDetector = (): Detector | null => {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  try { return BD ? new BD({ formats: ["qr_code"] }) : null; } catch { return null; }
};

/** Phone's own QR reader when it has one, otherwise jsQR on the pixels. */
async function decodeCanvas(canvas: HTMLCanvasElement, detector: Detector | null): Promise<string | null> {
  if (detector) {
    const found = await detector.detect(canvas).catch(() => []);
    if (found[0]?.rawValue) return found[0].rawValue;
  }
  const { default: jsQR } = await import("jsqr");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || null;
}

async function decodeImage(file: File): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const detector = nativeDetector();
  // Try full size first (dense QR), then smaller (blurry photos read better scaled down).
  for (const max of [2400, 1400, 900]) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const text = await decodeCanvas(canvas, detector);
    if (text) return text;
  }
  return null;
}

function Camera({ onText, onError }: { onText: (t: string) => void; onError: (m: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };
  useEffect(() => {
    const { onText, onError } = { onText: (t: string) => cb.current.onText(t), onError: (m: string) => cb.current.onError(m) };
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const detector = nativeDetector();
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } } });
      } catch {
        onError("Camera not allowed. Use 'QR photo' instead. / கேமரா அனுமதி இல்லை; 'QR புகைப்படம்' பயன்படுத்தவும்.");
        return;
      }
      const v = video.current;
      if (!v || stopped) return;
      v.srcObject = stream;
      await v.play().catch(() => undefined);
      const tick = async () => {
        if (stopped) return;
        if (v.videoWidth) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
          canvas.getContext("2d")?.drawImage(v, 0, 0);
          const text = await decodeCanvas(canvas, detector);
          if (text && !stopped) { onText(text); return; }
        }
        timer = setTimeout(tick, 350);
      };
      void tick();
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (
    <div className="space-y-1">
      <video ref={video} className="w-full max-w-sm rounded border border-slate-300" muted playsInline />
      <p className="text-xs text-slate-600">Hold the Aadhaar QR inside the frame, in good light. / QR-ஐ நல்ல வெளிச்சத்தில் காட்டவும்.</p>
    </div>
  );
}
