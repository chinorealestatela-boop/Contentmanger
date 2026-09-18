import Link from "next/link";
import { DollarSign, AlertTriangle } from "lucide-react";
import { requireScope } from "@/lib/queries/scope";
import { listSoldLeads } from "@/lib/queries/soldLeads";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SoldImportPanel } from "@/components/leads/SoldImportPanel";
import { formatCurrency, formatDate, formatTimeAgo } from "@/lib/format";

export const metadata = { title: "Sold Customers | CRM" };

export default async function SoldLeadsPage() {
  const scope = await requireScope();
  const leads = await listSoldLeads(scope);

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Sold Customers</h1>
        <p className="text-[13px] text-[var(--text-muted)]">{leads.length} sold deal{leads.length === 1 ? "" : "s"} · track downpayments and future payments for each one here.</p>
      </div>

      <div className="card space-y-3 p-5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--text)]">Import Sold Customers</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
            Upload a Sold Customers / Down Payment Report CSV to bulk-add sold deals and set up their down payment tracking in one step.
          </p>
        </div>
        <SoldImportPanel />
      </div>

      <div className="space-y-2.5">
        {leads.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">No sold deals yet.</div>}
        {leads.map((lead) => (
          <div key={lead.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar firstName={lead.customerName.split(" ")[0] ?? ""} lastName={lead.customerName.split(" ")[1] ?? ""} />
              <div>
                <Link href={`/customers/${lead.customerId}#payment-tracking`} className="text-[13.5px] font-semibold text-[var(--text)] hover:text-[var(--brand)]">
                  {lead.customerName}
                </Link>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  {lead.vehicle ?? "No vehicle on file"}{lead.stockNumber ? ` · #${lead.stockNumber}` : ""}{lead.salePrice ? ` · ${formatCurrency(lead.salePrice)}` : ""}
                </p>
                <p className="mt-0.5 text-[11.5px] text-[var(--text-faint)]">
                  Sold {lead.soldAt ? formatTimeAgo(lead.soldAt) : ""} · {lead.salespersonName}
                  {lead.hasPaymentPlan && lead.nextDueDate ? ` · Next payment ${formatDate(lead.nextDueDate)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lead.lateCount > 0 && (
                <Badge variant="overdue"><AlertTriangle size={11} className="mr-0.5 inline" /> {lead.lateCount} late</Badge>
              )}
              {lead.hasPaymentPlan && lead.outstandingBalance > 0 && (
                <Badge variant="warm">{formatCurrency(lead.outstandingBalance)} owed</Badge>
              )}
              {lead.hasPaymentPlan && lead.outstandingBalance === 0 && <Badge variant="sold">Paid in full</Badge>}
              <Link href={`/customers/${lead.customerId}#payment-tracking`} className="btn btn-secondary btn-sm">
                <DollarSign size={13} /> Payments
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
