"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function GlobalSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Search customers, phone, VIN, stock #…"
          className="input pl-9"
        />
      </div>
    </form>
  );
}
