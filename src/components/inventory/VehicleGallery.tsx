"use client";

import { useState } from "react";
import { VehicleThumb } from "@/components/vehicles/VehicleThumb";

export function VehicleGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return <VehicleThumb src={null} alt={alt} className="h-72 w-full sm:h-96" iconSize={64} />;
  }

  return (
    <div>
      <VehicleThumb src={photos[active]} alt={alt} className="h-72 w-full sm:h-96" iconSize={64} />
      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p + i}
              type="button"
              onClick={() => setActive(i)}
              className={`shrink-0 overflow-hidden rounded-lg border-2 ${i === active ? "border-[var(--brand)]" : "border-transparent"}`}
            >
              <VehicleThumb src={p} alt={`${alt} photo ${i + 1}`} className="h-16 w-20" iconSize={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
