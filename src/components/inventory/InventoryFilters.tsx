"use client";

import { X } from "lucide-react";
import { BODY_STYLES, optionLabel } from "@/lib/constants";
import { useInventoryQuery } from "./useInventoryQuery";
import type { getInventoryFilterOptions } from "@/lib/queries/publicInventory";

type Options = Awaited<ReturnType<typeof getInventoryFilterOptions>>;

const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: "Under $10,000", max: 10000 },
  { label: "$10,000 – $20,000", min: 10000, max: 20000 },
  { label: "$20,000 – $30,000", min: 20000, max: 30000 },
  { label: "$30,000 – $40,000", min: 30000, max: 40000 },
  { label: "$40,000+", min: 40000 },
];

const MILEAGE_PRESETS = [
  { label: "Under 20,000 mi", value: "20000" },
  { label: "Under 30,000 mi", value: "30000" },
  { label: "Under 50,000 mi", value: "50000" },
  { label: "Under 75,000 mi", value: "75000" },
  { label: "Under 100,000 mi", value: "100000" },
];

function bodyStyleLabel(v: string) {
  return v === "OTHER" ? "Other" : optionLabel(BODY_STYLES, v);
}

function FilterFields({ options }: { options: Options }) {
  const { get, update, clearAll } = useInventoryQuery();
  const make = get("make");
  const minPrice = get("minPrice");
  const maxPrice = get("maxPrice");
  const minYear = get("minYear");
  const maxYear = get("maxYear");
  const maxMileage = get("maxMileage");
  const selectedFeatures = get("features").split(",").filter(Boolean);
  const models = make ? options.makeModels[make] ?? [] : Object.values(options.makeModels).flat().sort();

  function toggleFeature(f: string) {
    const next = selectedFeatures.includes(f) ? selectedFeatures.filter((x) => x !== f) : [...selectedFeatures, f];
    update({ features: next.join(",") || undefined });
  }

  const hasAnyFilter = ["make", "model", "bodyStyle", "minPrice", "maxPrice", "minYear", "maxYear", "maxMileage", "features"].some((k) => get(k));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-[var(--text)]">Filters</h3>
        {hasAnyFilter && (
          <button type="button" onClick={clearAll} className="text-[12px] font-semibold text-[var(--brand)] hover:underline">
            Clear all
          </button>
        )}
      </div>

      <div>
        <label className="label mb-1.5">Make</label>
        <select
          value={make}
          onChange={(e) => update({ make: e.target.value, model: undefined })}
          className="input"
        >
          <option value="">Any make</option>
          {options.makes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-1.5">Model</label>
        <select value={get("model")} onChange={(e) => update({ model: e.target.value })} className="input" disabled={models.length === 0}>
          <option value="">Any model</option>
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-1.5">Vehicle Type</label>
        <select value={get("bodyStyle")} onChange={(e) => update({ bodyStyle: e.target.value })} className="input">
          <option value="">Any type</option>
          {options.bodyStyles.map((b) => (
            <option key={b} value={b}>{bodyStyleLabel(b)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label mb-1.5">Price Range</label>
        <div className="flex flex-wrap gap-1.5">
          {PRICE_PRESETS.map((p) => {
            const active = String(p.min ?? "") === minPrice && String(p.max ?? "") === maxPrice;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => update({ minPrice: p.min ? String(p.min) : undefined, maxPrice: p.max ? String(p.max) : undefined })}
                className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${active ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="number" min={0} placeholder={`Min ($${options.priceBounds.min.toLocaleString()})`} value={minPrice} onChange={(e) => update({ minPrice: e.target.value || undefined })} className="input" />
          <input type="number" min={0} placeholder={`Max ($${options.priceBounds.max.toLocaleString()})`} value={maxPrice} onChange={(e) => update({ maxPrice: e.target.value || undefined })} className="input" />
        </div>
      </div>

      <div>
        <label className="label mb-1.5">Year Range</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" placeholder={`From (${options.yearBounds.min})`} value={minYear} onChange={(e) => update({ minYear: e.target.value || undefined })} className="input" />
          <input type="number" placeholder={`To (${options.yearBounds.max})`} value={maxYear} onChange={(e) => update({ maxYear: e.target.value || undefined })} className="input" />
        </div>
      </div>

      <div>
        <label className="label mb-1.5">Mileage</label>
        <select value={maxMileage} onChange={(e) => update({ maxMileage: e.target.value })} className="input">
          <option value="">Any mileage</option>
          {MILEAGE_PRESETS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {options.features.length > 0 && (
        <div>
          <label className="label mb-1.5">Features</label>
          <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {options.features.map((f) => (
              <label key={f} className="flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
                <input type="checkbox" checked={selectedFeatures.includes(f)} onChange={() => toggleFeature(f)} className="h-3.5 w-3.5" />
                {f}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function InventoryFilters({ options, mobileOpen, onCloseMobile }: { options: Options; mobileOpen: boolean; onCloseMobile: () => void }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="card sticky top-20 p-4">
          <FilterFields options={options} />
        </div>
      </aside>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <div className="absolute inset-y-0 right-0 w-full max-w-sm overflow-y-auto bg-[var(--bg-elevated)] p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[var(--text)]">Filter Vehicles</h2>
              <button type="button" onClick={onCloseMobile} className="rounded-lg p-1.5 hover:bg-[var(--bg-subtle)]" aria-label="Close filters">
                <X size={18} />
              </button>
            </div>
            <FilterFields options={options} />
            <button type="button" onClick={onCloseMobile} className="btn btn-primary mt-5 w-full justify-center py-2.5">
              Show Results
            </button>
          </div>
        </div>
      )}
    </>
  );
}
