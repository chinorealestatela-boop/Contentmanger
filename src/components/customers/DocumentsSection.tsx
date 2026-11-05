import { FileText } from "lucide-react";
import { EmptyRow } from "@/components/ui/SectionCard";
import { formatDateTime } from "@/lib/format";

type DocumentRow = {
  id: string;
  type: string;
  url: string;
  fileName: string | null;
  createdAt: Date;
  uploadedBy: { firstName: string; lastName: string };
};

const TYPE_LABELS: Record<string, string> = { SCANNED_LEAD_FORM: "Scanned Lead Form" };

/** Original scanned-form photos attached via the AI Lead Scanner (see
 * src/lib/actions/aiLeadScan.ts) — kept so the physical paperwork can
 * always be compared against whatever ended up in the CRM. Each one just
 * links straight to the stored image (Vercel Blob in production, or
 * /uploads/... locally — see src/lib/storage/images.ts); no in-app
 * lightbox needed, the browser's own image view already does that. */
export function DocumentsSection({ documents }: { documents: DocumentRow[] }) {
  if (documents.length === 0) return <EmptyRow>No scanned forms on file. Use Scan New Lead to attach one.</EmptyRow>;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {documents.map((doc) => (
        <a
          key={doc.id}
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group overflow-hidden rounded-lg border border-[var(--border)] hover:border-[var(--brand)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail of a stored upload (Blob URL or local /uploads path), not something next/image's remote-pattern config knows about. */}
          <img src={doc.url} alt={TYPE_LABELS[doc.type] ?? doc.type} className="aspect-[3/4] w-full bg-[var(--bg-subtle)] object-cover" />
          <div className="p-2">
            <p className="flex items-center gap-1 truncate text-[11.5px] font-medium text-[var(--text)]"><FileText size={12} className="shrink-0" /> {TYPE_LABELS[doc.type] ?? doc.type}</p>
            <p className="truncate text-[10.5px] text-[var(--text-faint)]">{formatDateTime(doc.createdAt)} · {doc.uploadedBy.firstName} {doc.uploadedBy.lastName}</p>
          </div>
        </a>
      ))}
    </div>
  );
}
