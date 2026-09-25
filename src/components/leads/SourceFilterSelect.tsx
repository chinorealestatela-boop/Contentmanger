"use client";

import { useRouter } from "next/navigation";

export function SourceFilterSelect({
  defaultValue,
  sources,
  currentParams,
}: {
  defaultValue: string;
  sources: { id: string; name: string }[];
  /** Every other filter currently on the URL (q, temperature, status, sort,
   * etc.) so changing the source doesn't drop them — built server-side and
   * passed down as plain data since a function prop can't cross the
   * server/client boundary. */
  currentParams: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function onChange(sourceId: string) {
    const params = new URLSearchParams();
    Object.entries({ ...currentParams, source: sourceId || undefined, page: undefined }).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const qs = params.toString();
    router.push(`/leads${qs ? `?${qs}` : ""}`);
  }

  return (
    <select
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
      className="input w-auto"
      aria-label="Filter by lead source"
    >
      <option value="">All sources</option>
      {sources.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}
