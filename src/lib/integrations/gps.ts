// GPS / telematics integration seam. Real providers (Samsara, Geotab,
// Verizon Connect, Azuga, or an OEM connected-car API) push location
// updates — via webhook or a polled API — into VehicleGpsPing. Nothing
// here requires a live connection: seed data and the mock generator below
// keep the Live Vehicle Location map fully functional for demo/dev, and
// this is the single call site to swap in a real provider later.

import { prisma } from "@/lib/prisma";

export async function recordGpsPing(vehicleId: string, lat: number, lng: number, opts?: { heading?: number; speedMph?: number; label?: string }) {
  return prisma.vehicleGpsPing.create({ data: { vehicleId, lat, lng, heading: opts?.heading, speedMph: opts?.speedMph, label: opts?.label } });
}

/** Nudges every active vehicle's last-known position slightly, so a demo
 * environment shows believable "live" movement without a real telematics
 * feed. Call from a scheduled job/cron once a provider isn't connected,
 * or simply on-demand from the Live Map's refresh button. */
export async function simulateFleetMovement() {
  const vehicles = await prisma.vehicle.findMany({
    where: { availability: { in: ["ON_TRIP", "RESERVED"] } },
    include: { gpsPings: { orderBy: { recordedAt: "desc" }, take: 1 } },
  });

  for (const v of vehicles) {
    const last = v.gpsPings[0];
    const lat = (last?.lat ?? 34.0522) + (Math.random() - 0.5) * 0.01;
    const lng = (last?.lng ?? -118.2437) + (Math.random() - 0.5) * 0.01;
    await recordGpsPing(v.id, lat, lng, { heading: Math.random() * 360, speedMph: 15 + Math.random() * 40, label: last?.label ?? undefined });
  }
}

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Common LA-area landmark coordinates, used by the AI assistant for
// "which vehicle is closest to X" queries and the live map's quick-jump.
export const LA_LANDMARKS: Record<string, { lat: number; lng: number }> = {
  LAX: { lat: 33.9416, lng: -118.4085 },
  "BEVERLY HILLS": { lat: 34.0736, lng: -118.4004 },
  MALIBU: { lat: 34.0259, lng: -118.7798 },
  "DOWNTOWN LA": { lat: 34.0407, lng: -118.2468 },
  BURBANK: { lat: 34.1808, lng: -118.309 },
  "BEL AIR": { lat: 34.1, lng: -118.46 },
  "SANTA MONICA": { lat: 34.0195, lng: -118.4912 },
};
