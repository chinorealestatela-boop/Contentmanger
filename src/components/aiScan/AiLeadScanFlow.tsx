"use client";

// AI Lead Scanner — photo of a physical lead form -> reviewed, editable
// lead data -> saved through the existing createLead action. Mirrors the
// overall shape of src/components/licenseScan/ScanLeadFlow.tsx (capture ->
// duplicate check -> review -> save) but the capture step is a plain
// camera/file input instead of a live barcode scanner, and the "capture"
// itself doesn't tell us anything — an AI vision call does, which is why
// there's a SCANNING step in between with its own failure state.

import { useRef, useState } from "react";
import { Camera, Upload, RotateCcw, AlertTriangle, UserCheck, UserPlus, ScanLine } from "lucide-react";
import { scanLeadFormImage } from "@/lib/actions/aiLeadScan";
import { findPossibleDuplicates, type DuplicateMatch } from "@/lib/actions/licenseScan";
import type { ExtractedLeadForm } from "@/lib/aiScan/extractLeadForm";
import { AiScanReviewForm } from "@/components/aiScan/AiScanReviewForm";

type Step = "IDLE" | "CAPTURED" | "SCANNING" | "SCAN_ERROR" | "CHECKING" | "MATCH" | "REVIEW";

export function AiLeadScanFlow({
  sources,
  users,
  vehicles,
  currentUserId,
}: {
  sources: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  vehicles: { id: string; year: number; make: string; model: string; stockNumber: string }[];
  currentUserId: string;
}) {
  const [step, setStep] = useState<Step>("IDLE");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [scanError, setScanError] = useState("");
  const [extracted, setExtracted] = useState<ExtractedLeadForm | null>(null);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [existingCustomer, setExistingCustomer] = useState<DuplicateMatch | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  function handleFileChosen(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setStep("CAPTURED");
  }

  function reset() {
    setStep("IDLE");
    setImageFile(null);
    setImagePreviewUrl(null);
    setScanError("");
    setExtracted(null);
    setMatches([]);
    setExistingCustomer(null);
  }

  async function runScan() {
    if (!imageFile) return;
    setStep("SCANNING");
    const fd = new FormData();
    fd.set("image", imageFile);
    const result = await scanLeadFormImage(fd);
    if (!result.ok) {
      setScanError(result.error);
      setStep("SCAN_ERROR");
      return;
    }
    if (result.data.imageQuality === "unreadable") {
      setScanError(result.data.qualityNotes ?? "The photo was too unclear to read reliably. Please retake it with better lighting and the full form in frame.");
      setStep("SCAN_ERROR");
      return;
    }
    setExtracted(result.data);
    setStep("CHECKING");

    const found = await findPossibleDuplicates({
      firstName: result.data.firstName ?? undefined,
      lastName: result.data.lastName ?? undefined,
      phone: result.data.phone ?? undefined,
      email: result.data.email ?? undefined,
    });
    if (found.length > 0) {
      setMatches(found);
      setStep("MATCH");
    } else {
      setStep("REVIEW");
    }
  }

  if (step === "IDLE") {
    return (
      <div className="card space-y-3 p-5">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Scan New Lead</h3>
          <p className="text-[13px] text-[var(--text-muted)]">Take a picture of a physical lead form, or upload one — AI reads it and fills in the lead for you to review before anything is saved.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="btn btn-primary justify-center py-3">
            <Camera size={16} /> Take Photo
          </button>
          <button type="button" onClick={() => uploadInputRef.current?.click()} className="btn btn-secondary justify-center py-3">
            <Upload size={16} /> Upload Photo
          </button>
        </div>
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFileChosen(e.target.files?.[0])} />
        <input ref={uploadInputRef} type="file" accept="image/*" hidden onChange={(e) => handleFileChosen(e.target.files?.[0])} />
      </div>
    );
  }

  if (step === "CAPTURED" || step === "SCANNING" || step === "SCAN_ERROR") {
    return (
      <div className="card space-y-4 p-5">
        {imagePreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a locally-chosen File's object URL isn't something next/image can optimize, and this preview is discarded the moment the flow moves on.
          <img src={imagePreviewUrl} alt="Scanned lead form preview" className="mx-auto max-h-80 w-full rounded-lg border border-[var(--border)] object-contain" />
        )}

        {step === "CAPTURED" && (
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="btn btn-ghost"><RotateCcw size={14} /> Retake</button>
            <button type="button" onClick={runScan} className="btn btn-primary flex-1 justify-center"><ScanLine size={15} /> Scan with AI</button>
          </div>
        )}

        {step === "SCANNING" && <p className="text-center text-[13px] text-[var(--text-muted)]">Reading the form…</p>}

        {step === "SCAN_ERROR" && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{scanError}</span>
            </div>
            <button type="button" onClick={reset} className="btn btn-secondary w-full justify-center"><RotateCcw size={14} /> Retake Photo</button>
          </div>
        )}
      </div>
    );
  }

  if (step === "CHECKING") {
    return <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Checking for an existing customer…</div>;
  }

  if (step === "MATCH") {
    return (
      <div className="card space-y-4 p-5">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Possible existing customer found</h3>
          <p className="text-[13px] text-[var(--text-muted)]">
            We found {matches.length === 1 ? "someone" : `${matches.length} people`} already in the CRM
            {matches[0]?.matchedOn === "phone" ? " with this phone number" : matches[0]?.matchedOn === "email" ? " with this email" : " with a similar name"}. Is this the same person?
          </p>
        </div>
        <ul className="space-y-2">
          {matches.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3.5 py-2.5">
              <div>
                <p className="text-[13px] font-medium text-[var(--text)]">{m.firstName} {m.lastName}</p>
                <p className="text-[11.5px] text-[var(--text-faint)]">{[m.phone, m.email, m.city].filter(Boolean).join(" · ") || "No contact info on file"} · Owner: {m.ownerName}</p>
              </div>
              <button onClick={() => { setExistingCustomer(m); setStep("REVIEW"); }} className="btn btn-secondary btn-sm">
                <UserCheck size={13} /> Use This Customer
              </button>
            </li>
          ))}
        </ul>
        <button onClick={() => { setExistingCustomer(null); setStep("REVIEW"); }} className="btn btn-ghost w-full">
          <UserPlus size={14} /> None of these — Create New Customer
        </button>
      </div>
    );
  }

  return (
    <AiScanReviewForm
      extracted={extracted}
      existingCustomer={existingCustomer}
      imageFile={imageFile}
      sources={sources}
      users={users}
      vehicles={vehicles}
      currentUserId={currentUserId}
      onRescan={reset}
    />
  );
}
