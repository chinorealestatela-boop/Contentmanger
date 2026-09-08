"use client";

import { useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useInventoryQuery } from "./useInventoryQuery";

const SORT_OPTIONS = [
  { value: "newest", label: "Recently Added" },
  { value: "priceAsc", label: "Price: Low to High" },
  { value: "priceDesc", label: "Price: High to Low" },
  { value: "yearDesc", label: "Newest Year" },
  { value: "yearAsc", label: "Oldest Year" },
  { value: "mileageAsc", label: "Lowest Mileage" },
  { value: "mileageDesc", label: "Highest Mileage" },
];

export function InventoryToolbar({ resultCount, onOpenFilters }: { resultCount: number; onOpenFilters: () => void }) {
  const { get, update } = useInventoryQuery();
  const urlQ = get("q");
  const [q, setQ] = useState(urlQ);
  // Tracks the last value *this input* pushed to the URL, as state rather
  // than a ref (refs can't be read during render) — React's documented
  // "adjust state when a prop/derived value changes" pattern below uses it
  // to tell "the URL changed because I typed" apart from "the URL changed
  // some other way" (e.g. the "Clear All" filters button), without an
  // effect and its extra render.
  const [lastPushed, setLastPushed] = useState(urlQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (urlQ !== lastPushed) {
    setLastPushed(urlQ);
    if (q !== urlQ) setQ(urlQ);
  }

  function onSearchChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLastPushed(value);
      update({ q: value });
    }, 350);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search make, model, year, stock #, features…"
          className="input pl-9"
          aria-label="Search available vehicles"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onOpenFilters} className="btn btn-secondary btn-sm lg:hidden">
          <SlidersHorizontal size={14} /> Filter Vehicles
        </button>
        <select
          value={get("sort") || "newest"}
          onChange={(e) => update({ sort: e.target.value }, { resetPage: false })}
          className="input w-auto"
          aria-label="Sort vehicles"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>Sort: {s.label}</option>
          ))}
        </select>
      </div>
      <p className="hidden shrink-0 text-[12.5px] text-[var(--text-muted)] sm:block">{resultCount} match{resultCount === 1 ? "" : "es"}</p>
    </div>
  );
}
