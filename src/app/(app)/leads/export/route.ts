import { requireScope } from "@/lib/queries/scope";
import { listLeadsForExport } from "@/lib/queries/leads";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { optionLabel, PURCHASE_TIMEFRAMES } from "@/lib/constants";

export async function GET(request: Request) {
  const scope = await requireScope();
  const url = new URL(request.url);
  const sp = url.searchParams;
  const sort = sp.get("sort") === "newest" ? "newest" : "score";

  const leads = await listLeadsForExport(scope, {
    q: sp.get("q") ?? undefined,
    temperature: sp.get("temperature") ?? undefined,
    status: sp.get("status") ?? undefined,
    sourceId: sp.get("source") ?? undefined,
    sort,
  });

  const rows = [
    ["First Name", "Last Name", "Phone", "Email", "Vehicle", "What They Wanted", "Source", "Purchase Timeframe", "Temperature", "Score", "Requested At"],
    ...leads.map((lead) => {
      const vi = lead.vehicleInterests[0];
      const vehicle = vi ? (vi.vehicle ? `${vi.vehicle.year} ${vi.vehicle.make} ${vi.vehicle.model}` : [vi.year, vi.make, vi.model].filter(Boolean).join(" ")) : "";
      const wanted = lead.customerNeeds?.split("\n")[0] ?? "";
      return [
        lead.customer.firstName,
        lead.customer.lastName,
        lead.customer.phone,
        lead.customer.email,
        vehicle,
        wanted,
        lead.source?.name ?? "",
        optionLabel(PURCHASE_TIMEFRAMES, lead.purchaseTimeframe),
        lead.temperature,
        lead.score,
        formatDateTime(lead.createdAt),
      ];
    }),
  ];

  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${date}.csv"`,
    },
  });
}
