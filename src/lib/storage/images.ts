// Image storage for uploaded files (currently just the AI Lead Scanner's
// original scanned lead-form photos — see src/lib/actions/aiLeadScan.ts).
//
// Same graceful-degradation shape as src/lib/sms/provider.ts: when
// BLOB_READ_WRITE_TOKEN is configured (Vercel Blob is connected to this
// project), the real upload happens there and the returned URL is a public
// Blob URL. When it isn't set — the zero-setup default, same philosophy as
// SQLite needing no external database for local dev — the file is written
// to disk under public/uploads/ instead, which next's static file server
// already serves at the matching /uploads/... URL. Nothing else in the app
// needs to know which one happened; it just gets back a URL it can store
// and link to.
//
// The local-disk fallback only works on a persistent filesystem (local
// dev, or a long-running container) — Vercel's serverless functions have
// no writable persistent disk, so production deployments need Blob
// actually configured for uploads to survive past the current request.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

const UPLOAD_SUBDIR = "uploads/scanned-forms";

export async function uploadScannedFormImage(params: {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}): Promise<{ url: string }> {
  const ext = params.fileName.includes(".") ? params.fileName.slice(params.fileName.lastIndexOf(".")) : guessExtension(params.contentType);
  const key = `${UPLOAD_SUBDIR}/${randomUUID()}${ext}`;

  if (isBlobConfigured()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, params.buffer, {
      access: "public",
      contentType: params.contentType,
      addRandomSuffix: false,
    });
    return { url: blob.url };
  }

  // Local-disk fallback — writes under public/ so Next's static file
  // server exposes it at the same path we return.
  const dir = path.join(process.cwd(), "public", UPLOAD_SUBDIR);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, path.basename(key));
  await writeFile(filePath, params.buffer);
  return { url: `/${UPLOAD_SUBDIR}/${path.basename(key)}` };
}

function guessExtension(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "image/heic" || contentType === "image/heif") return ".heic";
  return ".jpg";
}
