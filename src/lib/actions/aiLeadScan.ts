"use server";

// AI Lead Scanner — photo of a physical dealership lead form -> structured
// lead data a person reviews before anything is saved. Two actions:
//
// - scanLeadFormImage: OCR only. No database write happens here at all —
//   per the feature spec, the person has to review and confirm everything
//   first, so nothing is persisted (and no image is uploaded to storage
//   yet) until they actually click "Confirm and Create Lead."
// - attachScannedDocument: called right after the review form submits to
//   the existing createLead action (same pattern src/components/
//   licenseScan/ScanLeadFlow.tsx already uses) and succeeds. Uploads the
//   original photo and links it to the customer/lead that was just
//   created, so the lead itself is made by createLead — not a second,
//   parallel lead-creation path.

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";
import { extractLeadFormFromImage, type ExtractResult } from "@/lib/aiScan/extractLeadForm";
import { uploadScannedFormImage } from "@/lib/storage/images";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB — generous for a phone photo, well under Claude's 20MB request-body ceiling once base64-encoded alongside the rest of the request
// Claude's vision API accepts these four; HEIC/HEIF (what some iPhones
// capture by default) isn't one of them, so we fail with a clear, specific
// message rather than send it and get back a confusing provider error.
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function readImageFile(formData: FormData): Promise<{ ok: true; buffer: Buffer; contentType: string; fileName: string } | { ok: false; error: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No photo was uploaded." };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "That photo is too large (max 15MB) — try retaking it at a lower resolution." };
  if (!SUPPORTED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: file.type === "image/heic" || file.type === "image/heif"
        ? "HEIC photos aren't supported yet — set your phone's camera to capture JPEG (Settings → Camera → Formats → Most Compatible on iPhone), or upload a JPEG/PNG instead."
        : "Unsupported image type — please use a JPEG, PNG, WEBP, or GIF photo.",
    };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return { ok: true, buffer, contentType: file.type, fileName: file.name || "scan.jpg" };
}

export async function scanLeadFormImage(formData: FormData): Promise<ExtractResult> {
  await requireScope();
  const read = await readImageFile(formData);
  if (!read.ok) return { ok: false, error: read.error };

  return extractLeadFormFromImage({ base64: read.buffer.toString("base64"), mediaType: read.contentType });
}

export type AttachDocumentState = { success?: string; error?: string } | null;

export async function attachScannedDocument(_prev: AttachDocumentState, formData: FormData): Promise<AttachDocumentState> {
  const scope = await requireScope();
  const customerId = formData.get("customerId");
  const leadId = formData.get("leadId");
  const extractedData = formData.get("extractedData");
  if (typeof customerId !== "string" || !customerId) return { error: "Missing customer — the scanned form couldn't be attached." };

  const read = await readImageFile(formData);
  if (!read.ok) return { error: read.error };

  const { url } = await uploadScannedFormImage({ buffer: read.buffer, contentType: read.contentType, fileName: read.fileName });

  await prisma.customerDocument.create({
    data: {
      customerId,
      leadId: typeof leadId === "string" && leadId ? leadId : undefined,
      type: "SCANNED_LEAD_FORM",
      url,
      fileName: read.fileName,
      contentType: read.contentType,
      sizeBytes: read.buffer.byteLength,
      extractedData: typeof extractedData === "string" ? extractedData : undefined,
      uploadedById: scope.userId,
    },
  });

  await logActivity({
    customerId,
    leadId: typeof leadId === "string" && leadId ? leadId : undefined,
    type: "CUSTOMER_UPDATED",
    description: "Scanned lead form attached (via AI Lead Scanner).",
    actorId: scope.userId,
  });

  revalidatePath(`/customers/${customerId}`);
  return { success: "Scanned form attached." };
}
