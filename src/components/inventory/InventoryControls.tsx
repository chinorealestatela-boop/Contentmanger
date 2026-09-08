"use client";

import { useState } from "react";
import { InventoryFilters } from "./InventoryFilters";
import { InventoryToolbar } from "./InventoryToolbar";
import type { getInventoryFilterOptions } from "@/lib/queries/publicInventory";

/** Owns the one bit of client state the list page needs (whether the
 * mobile filter sheet is open) and lays out the filters sidebar next to
 * the results area. `children` is the server-rendered vehicle grid +
 * pagination — passed straight through, so filtering/sorting/pagination
 * itself stays server-side (see src/lib/queries/publicInventory.ts) and
 * this component never needs to know how many vehicles exist. */
export function InventoryControls({
  options,
  resultCount,
  children,
}: {
  options: Awaited<ReturnType<typeof getInventoryFilterOptions>>;
  resultCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start">
      <InventoryFilters options={options} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="min-w-0 flex-1 space-y-4">
        <InventoryToolbar resultCount={resultCount} onOpenFilters={() => setMobileOpen(true)} />
        {children}
      </div>
    </div>
  );
}
