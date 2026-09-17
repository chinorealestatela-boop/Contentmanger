"use client";

// Camera capture + barcode decode for the driver's-license scan flow
// (Feature 6/13/14 in the original request). Reads the PDF417 barcode on
// the back of the license entirely client-side via @zxing/library — the
// video frame never leaves the phone, nothing is uploaded, and nothing is
// stored: only the structured fields the barcode already encodes (name,
// address, city, state, zip) ever reach the review screen, and only what
// the salesperson explicitly saves reaches the database. This is also why
// there's no OCR/AI vendor or API key involved: the barcode already *is*
// the structured data, so decoding it is both more accurate than reading
// the printed side of the card and doesn't need a paid service.

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { parseAamvaPayload, type ParsedLicense } from "@/lib/licenseScan/aamva";

type ScanState = "REQUESTING" | "SCANNING" | "CAMERA_ERROR" | "UNREADABLE";

export function LicenseScanner({ onScanned, onCancel }: { onScanned: (result: ParsedLicense) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<ScanState>("REQUESTING");
  const [errorMsg, setErrorMsg] = useState("");
  const [attempt, setAttempt] = useState(0); // bump to retry after CAMERA_ERROR/UNREADABLE

  useEffect(() => {
    let cancelled = false;
    let reader: import("@zxing/library").BrowserPDF417Reader | null = null;

    (async () => {
      const { BrowserPDF417Reader } = await import("@zxing/library");
      if (cancelled) return;
      reader = new BrowserPDF417Reader();
      setState("SCANNING");

      try {
        await reader.decodeFromVideoDevice(null, videoRef.current!, (result) => {
          if (cancelled || !result) return;
          const parsed = parseAamvaPayload(result.getText());
          if (!parsed) {
            // A single failed-to-parse frame isn't necessarily the end —
            // a barcode can decode to garbage once from motion blur.
            // Only surface "unreadable" if scanning keeps failing to
            // produce anything usable; here we just keep listening.
            return;
          }
          reader?.stopContinuousDecode();
          onScanned(parsed);
        });
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        setState("CAMERA_ERROR");
        setErrorMsg(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "Camera access was denied. Allow camera access for this site and try again."
            : name === "NotFoundError"
              ? "No camera was found on this device."
              : "Couldn't access the camera. Make sure no other app is using it and try again."
        );
      }
    })();

    return () => {
      cancelled = true;
      reader?.reset();
    };
  }, [attempt, onScanned]);

  // If nothing decodes within a reasonable window, stop silently retrying
  // forever and tell the person what to do instead — per Feature 14, a
  // scan that isn't working needs a clear message and a way to retake it,
  // not an endless spinner.
  useEffect(() => {
    if (state !== "SCANNING") return;
    const timer = setTimeout(() => {
      setState((s) => (s === "SCANNING" ? "UNREADABLE" : s));
      setErrorMsg("Unable to read the driver's license. Please retake with the entire barcode on the back of the card visible and in focus.");
    }, 25000);
    return () => clearTimeout(timer);
  }, [state, attempt]);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
        {state === "SCANNING" && (
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/70" />
        )}
        {(state === "CAMERA_ERROR" || state === "UNREADABLE") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
            <AlertTriangle className="text-amber-400" size={28} />
            <p className="text-[13px] text-white">{errorMsg}</p>
            <button
              type="button"
              onClick={() => {
                setState("REQUESTING");
                setErrorMsg("");
                setAttempt((a) => a + 1);
              }}
              className="btn btn-secondary btn-sm"
            >
              <RotateCcw size={13} /> Try Again
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-[12.5px] text-[var(--text-muted)]">
        {state === "SCANNING" ? "Hold the barcode on the back of the license inside the frame." : state === "REQUESTING" ? "Starting camera…" : ""}
      </p>
      <button type="button" onClick={onCancel} className="btn btn-ghost w-full"><X size={14} /> Cancel</button>
    </div>
  );
}
