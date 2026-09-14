"use client";

import { useState } from "react";
import Link from "next/link";
import { Car, MapPin, Navigation } from "lucide-react";
import { VEHICLE_AVAILABILITY, optionColor, optionLabel } from "@/lib/constants";
import { formatTimeAgo, fullName } from "@/lib/format";
import { LA_LANDMARKS } from "@/lib/integrations/gps";
import { cn } from "@/lib/utils";

export type FleetMapVehicle = {
  id: string;
  name: string;
  fleetNumber: string;
  availability: string;
  assignedDriver: { firstName: string; lastName: string } | null;
  ping: { lat: number; lng: number; label: string | null; recordedAt: Date } | null;
};

// Bounding box roughly covering LA & Southern California service area.
const BOUNDS = { minLat: 33.65, maxLat: 34.35, minLng: -118.95, maxLng: -117.85 };

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = 100 - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(96, Math.max(4, y)) };
}

export function FleetMap({ vehicles }: { vehicles: FleetMapVehicle[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedVehicle = vehicles.find((v) => v.id === selected);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="card relative aspect-[4/3] overflow-hidden p-0 sm:aspect-[16/10]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="grid" width="6.66" height="6.66" patternUnits="userSpaceOnUse">
              <path d="M 6.66 0 L 0 0 0 6.66" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.15" />
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#grid)" />
          {/* Coastline suggestion */}
          <path d="M 0 55 Q 20 50, 28 62 T 45 70" stroke="rgba(127,168,201,0.25)" strokeWidth="0.6" fill="none" />

          {Object.entries(LA_LANDMARKS).map(([name, coord]) => {
            const p = project(coord.lat, coord.lng);
            return (
              <g key={name}>
                <circle cx={p.x} cy={p.y} r="0.6" fill="rgba(255,255,255,0.25)" />
                <text x={p.x + 1.2} y={p.y + 0.6} fontSize="2.4" fill="rgba(255,255,255,0.35)" fontFamily="var(--font-geist-sans)">
                  {name.replace(/_/g, " ")}
                </text>
              </g>
            );
          })}

          {vehicles.filter((v) => v.ping).map((v) => {
            const p = project(v.ping!.lat, v.ping!.lng);
            const color = optionColor(VEHICLE_AVAILABILITY, v.availability);
            const isSelected = v.id === selected;
            return (
              <g key={v.id} onClick={() => setSelected(v.id)} className="cursor-pointer">
                {isSelected && <circle cx={p.x} cy={p.y} r="3" fill={color} opacity="0.2" className="animate-pulse-soft" />}
                <circle cx={p.x} cy={p.y} r={isSelected ? 1.6 : 1.2} fill={color} stroke="#0a0a0b" strokeWidth="0.3" />
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-black/50 px-2.5 py-1.5 backdrop-blur">
          {VEHICLE_AVAILABILITY.map((a) => (
            <span key={a.value} className="flex items-center gap-1 text-[10px] font-medium text-white/80">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.color }} /> {a.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Fleet ({vehicles.length})</p>
        <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {vehicles.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelected(v.id)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors", selected === v.id ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--border)] hover:bg-white/[0.03]")}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[var(--text-muted)]"><Car size={13} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-[var(--text)]">{v.name}</span>
                <span className="block truncate text-[10.5px] text-[var(--text-faint)]">{v.ping?.label ?? "No GPS data"}</span>
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: optionColor(VEHICLE_AVAILABILITY, v.availability) }} />
            </button>
          ))}
        </div>

        {selectedVehicle && (
          <div className="card mt-3 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[var(--text)]">{selectedVehicle.name}</p>
              <Link href={`/fleet/${selectedVehicle.id}`} className="text-[11px] font-semibold text-[var(--brand-bright)] hover:underline">View</Link>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]"><MapPin size={12} /> {selectedVehicle.ping?.label ?? "Unknown location"}</p>
            <p className="mt-1 text-[11px] text-[var(--text-faint)]">{optionLabel(VEHICLE_AVAILABILITY, selectedVehicle.availability)}{selectedVehicle.ping ? ` · updated ${formatTimeAgo(selectedVehicle.ping.recordedAt)}` : ""}</p>
            {selectedVehicle.assignedDriver && (
              <p className="mt-1 flex items-center gap-1 text-[11.5px] text-[var(--text-muted)]"><Navigation size={12} /> {fullName(selectedVehicle.assignedDriver)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
