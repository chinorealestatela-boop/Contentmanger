import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CalendarCheck, MessageCircleHeart, ShieldCheck, Landmark } from "lucide-react";
import { getPublicVehicle } from "@/lib/queries/publicInventory";
import { prisma } from "@/lib/prisma";
import { VehicleGallery } from "@/components/inventory/VehicleGallery";
import { PaymentEstimator } from "@/components/inventory/PaymentEstimator";
import { VehicleInquiryForm } from "@/components/inventory/VehicleInquiryForm";
import { StickyBookBar } from "@/components/inventory/StickyBookBar";
import { formatCurrency } from "@/lib/format";
import { estimateMonthlyPayment } from "@/lib/utils";
import { optionLabel, BODY_STYLES } from "@/lib/constants";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vehicle = await getPublicVehicle(id);
  if (!vehicle) return { title: "Vehicle Not Found | AutoMax LV" };
  return { title: `${vehicle.year} ${vehicle.make} ${vehicle.model} | AutoMax LV` };
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [vehicle, dealershipRow] = await Promise.all([
    getPublicVehicle(id),
    prisma.setting.findUnique({ where: { key: "dealership" } }),
  ]);
  if (!vehicle) notFound();

  const dealership = dealershipRow ? JSON.parse(dealershipRow.value) : {};
  const dealershipName: string = dealership.name || "AutoMax LV";
  const title = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const price = vehicle.internetPrice ?? vehicle.sellingPrice;

  const specs: { label: string; value: string | null }[] = [
    { label: "Trim", value: vehicle.trim },
    { label: "Mileage", value: vehicle.condition === "NEW" ? "New" : `${vehicle.mileage.toLocaleString()} mi` },
    { label: "Vehicle Type", value: vehicle.bodyStyle ? optionLabel(BODY_STYLES, vehicle.bodyStyle) : null },
    { label: "Exterior Color", value: vehicle.exteriorColor },
    { label: "Interior Color", value: vehicle.interiorColor },
    { label: "Engine", value: vehicle.engine },
    { label: "Transmission", value: vehicle.transmission },
    { label: "Drivetrain", value: vehicle.drivetrain },
    { label: "Fuel Type", value: vehicle.fuelType },
    { label: "Stock #", value: vehicle.stockNumber },
    { label: "VIN", value: vehicle.vin },
  ].filter((s) => s.value);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 lg:pb-8">
      <Link href="/inventory" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--brand)]">
        <ChevronLeft size={15} /> Back to Available Vehicles
      </Link>

      <div className="mt-5 grid grid-cols-1 gap-7 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <VehicleGallery photos={vehicle.photos} alt={title} />
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div>
            {vehicle.condition === "NEW" && (
              <span className="site-eyebrow mb-2 inline-flex rounded-full bg-[var(--brand)] px-2.5 py-1 text-white">New</span>
            )}
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)] sm:text-[28px]">{title}</h1>
            {vehicle.trim && <p className="text-[14px] text-[var(--text-muted)]">{vehicle.trim}</p>}
            <p className="mt-2 text-[28px] font-extrabold text-[var(--brand)]">{formatCurrency(price)}</p>
            {price != null && (
              <p className="text-[12.5px] font-medium text-[var(--text-muted)]">
                Est. {formatCurrency(Math.round(estimateMonthlyPayment(price)))}/mo
              </p>
            )}
          </div>

          <div className="site-card grid grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
            {specs.map((s) => (
              <div key={s.label}>
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">{s.label}</p>
                <p className="mt-0.5 font-semibold text-[var(--text)]">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link href={`/book?vehicle=${vehicle.id}`} className="btn btn-primary justify-center py-2.5 shadow-[0_4px_14px_rgba(216,19,36,0.3)] sm:col-span-2">
              <CalendarCheck size={15} /> Schedule Test Drive
            </Link>
            <a href="#interested" className="btn btn-secondary justify-center py-2.5">
              <MessageCircleHeart size={15} /> Request More Info
            </a>
            <a href="#interested" className="btn btn-secondary justify-center py-2.5">
              <ShieldCheck size={15} /> Check Availability
            </a>
            <a href="https://www.automaxlv.com/apply-online/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary justify-center py-2.5 sm:col-span-2">
              <Landmark size={15} /> Apply for Financing
            </a>
          </div>
        </div>
      </div>

      {vehicle.features.length > 0 && (
        <div className="site-card mt-9 p-5">
          <h2 className="text-[15px] font-bold text-[var(--text)]">Features</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {vehicle.features.map((f) => (
              <span key={f} className="rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-[12.5px] font-medium text-[var(--text-muted)]">{f}</span>
            ))}
          </div>
        </div>
      )}

      {vehicle.description && (
        <div className="mt-6">
          <h2 className="text-[15px] font-bold text-[var(--text)]">Description</h2>
          <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--text-muted)]">{vehicle.description}</p>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {price != null && <PaymentEstimator price={price} />}
        <VehicleInquiryForm vehicleId={vehicle.id} vehicleLabel={title} dealershipName={dealershipName} />
      </div>

      <StickyBookBar vehicleId={vehicle.id} title={title} price={price} />
    </div>
  );
}
