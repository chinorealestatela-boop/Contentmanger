import Link from "next/link";
import { CalendarCheck, ShieldCheck, Clock, Car, MessageCircle, MessageCircleHeart, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { parsePhotos, estimateMonthlyPayment } from "@/lib/utils";
import { VehicleThumb } from "@/components/vehicles/VehicleThumb";

export const metadata = { title: "Schedule Your Test Drive | AutoMax LV" };
// Inventory changes as vehicles are added/sold from the admin dashboard —
// revalidate periodically instead of only at build/deploy time.
export const revalidate = 60;

async function getFeaturedVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { year: "desc" },
    take: 6,
    select: { id: true, year: true, make: true, model: true, trim: true, condition: true, internetPrice: true, sellingPrice: true, mileage: true, bodyStyle: true, photos: true },
  });
  return vehicles.map((v) => ({ ...v, photos: parsePhotos(v.photos) }));
}

export default async function LandingPage() {
  const vehicles = await getFeaturedVehicles();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--brand)] px-4 py-16 text-black sm:px-6 sm:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 20%, #ffffff 0%, transparent 55%)" }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">
            <Car size={13} /> Las Vegas, NV
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-5xl">Ready to Find Your Next Ride?</h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/90 sm:text-lg">
            Schedule your test drive and let&rsquo;s find the right vehicle and payment for you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/book" className="btn w-full bg-white px-6 py-3 text-[15px] font-bold text-black hover:bg-white/90 sm:w-auto">
              Schedule My Test Drive
            </Link>
            <Link href="/inventory" className="btn w-full border border-white bg-white px-6 py-3 text-[15px] font-bold text-black hover:bg-white/90 sm:w-auto">
              Check Availability
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-black/60">Takes about 2 minutes · No obligation</p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {[
            { icon: ShieldCheck, label: "No-Pressure Visit" },
            { icon: Clock, label: "Pick Your Own Time" },
            { icon: MessageCircleHeart, label: "Text Reminders" },
            { icon: CheckCircle2, label: "Free & No Obligation" },
          ].map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-1.5 text-[var(--text-muted)]">
              <t.icon size={20} className="text-[var(--brand)]" />
              <span className="text-[12px] font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* All buyers welcome */}
      <section className="px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">Every Buyer Starts Somewhere</h2>
          <p className="mt-3 text-[14px] text-[var(--text-muted)]">
            I work with all kinds of buyers every day — book your test drive even if you have:
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {["Low credit", "No credit", "Limited down payment", "Previous credit issues"].map((r) => (
              <div key={r} className="card flex items-center gap-2 p-3">
                <CheckCircle2 size={16} className="shrink-0 text-[var(--brand)]" />
                <span className="text-[13px] font-medium text-[var(--text)]">{r}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-[var(--text-faint)]">
            We&rsquo;ll go over financing options together — this isn&rsquo;t a guaranteed-approval offer, just a real conversation about what&rsquo;s possible for you.
          </p>
        </div>
      </section>

      {/* Not ready to test drive yet? */}
      <section className="px-4 pb-14 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center sm:p-8">
          <MessageCircle size={22} className="mx-auto text-[var(--brand)]" />
          <h2 className="mt-2 text-xl font-bold text-[var(--text)] sm:text-2xl">Not Ready to Test Drive Yet?</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] text-[var(--text-muted)]">
            Book a free 15-minute call instead — no vehicle needed. We&rsquo;ll just talk through financing, trade-ins, or what fits your budget.
          </p>
          <Link href="/consultation" className="btn btn-secondary mt-5 px-6 py-2.5 text-[14px]">
            <Clock size={15} /> Schedule a Free 15-Min Consultation
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--bg-subtle)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold text-[var(--text)] sm:text-3xl">Booking Takes 2 Minutes</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { n: 1, label: "Pick a vehicle" },
              { n: 2, label: "Tell us about you" },
              { n: 3, label: "Answer a few quick questions" },
              { n: 4, label: "Choose your time" },
            ].map((s) => (
              <div key={s.n} className="card p-4 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-[15px] font-bold text-white">{s.n}</div>
                <p className="mt-2.5 text-[13px] font-semibold text-[var(--text)]">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/book" className="btn btn-primary px-6 py-3 text-[15px]"><CalendarCheck size={16} /> Book My Test Drive</Link>
          </div>
        </div>
      </section>

      {/* Featured vehicles */}
      {vehicles.length > 0 && (
        <section className="px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">Some of What&rsquo;s on the Lot</h2>
                <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">Don&rsquo;t see what you want? You can enter any vehicle when you book.</p>
              </div>
              <Link href="/inventory" className="text-[13px] font-semibold text-[var(--brand)] hover:underline">View All Available Vehicles →</Link>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((v) => (
                <Link key={v.id} href={`/inventory/${v.id}`} className="card group overflow-hidden p-4 hover:shadow-md">
                  <VehicleThumb src={v.photos[0]} alt={`${v.year} ${v.make} ${v.model}`} className="h-28 w-full" iconSize={36} />
                  <p className="mt-3 text-[14px] font-semibold text-[var(--text)]">{v.year} {v.make} {v.model}</p>
                  <p className="text-[12.5px] text-[var(--text-muted)]">{v.trim ?? v.bodyStyle ?? v.condition} · {v.mileage.toLocaleString()} mi</p>
                  <div className="mt-2 flex items-end justify-between">
                    <div>
                      <span className="block text-[14px] font-bold text-[var(--brand)]">{formatCurrency(v.internetPrice ?? v.sellingPrice)}</span>
                      {(v.internetPrice ?? v.sellingPrice) != null && (
                        <span className="text-[11px] font-medium text-[var(--text-muted)]">
                          Est. {formatCurrency(Math.round(estimateMonthlyPayment((v.internetPrice ?? v.sellingPrice)!)))}/mo
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] font-semibold text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100">View Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--brand)] px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">Let&rsquo;s Get You Behind the Wheel</h2>
          <p className="mt-2 text-[14px] text-white/85">Pick a time that works for you — I&rsquo;ll have the vehicle ready.</p>
          <Link href="/book" className="btn mt-6 w-full bg-white px-6 py-3 text-[15px] font-bold text-[var(--brand)] hover:bg-white/90 sm:w-auto">
            Schedule Your Test Drive
          </Link>
        </div>
      </section>
    </div>
  );
}
