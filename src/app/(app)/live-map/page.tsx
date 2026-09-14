import { prisma } from "@/lib/prisma";
import { FleetMap } from "@/components/map/FleetMap";
import { RefreshCw } from "lucide-react";

export default async function LiveMapPage() {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    include: { assignedDriver: true, gpsPings: { orderBy: { recordedAt: "desc" }, take: 1 } },
    orderBy: { name: "asc" },
  });

  const mapVehicles = vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    fleetNumber: v.fleetNumber,
    availability: v.availability,
    assignedDriver: v.assignedDriver,
    ping: v.gpsPings[0] ? { lat: v.gpsPings[0].lat, lng: v.gpsPings[0].lng, label: v.gpsPings[0].label, recordedAt: v.gpsPings[0].recordedAt } : null,
  }));

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Live Vehicle Location</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Real-time fleet visibility across Los Angeles &amp; Southern California.</p>
        </div>
      </div>

      <FleetMap vehicles={mapVehicles} />

      <div className="card flex items-start gap-3 p-4 text-[12.5px] text-[var(--text-muted)]">
        <RefreshCw size={14} className="mt-0.5 shrink-0 text-[var(--text-faint)]" />
        <p>
          This view reads from the <code className="text-[var(--text)]">VehicleGpsPing</code> table. Connect a telematics provider (Samsara, Geotab, Verizon Connect, or an OEM connected-car API)
          in Settings → Integrations to stream live positions — see <code className="text-[var(--text)]">src/lib/integrations/gps.ts</code> for the single call site to wire in.
        </p>
      </div>
    </div>
  );
}
