import Link from "next/link";
import { CalendarCheck, ShieldCheck, Clock, Car, MessageCircle, MessageCircleHeart, CheckCircle2, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { parsePhotos, estimateMonthlyPayment } from "@/lib/utils";
import { VehicleThumb } from "@/components/vehicles/VehicleThumb";
import { HAS_PHOTO_WHERE } from "@/lib/queries/publicInventory";

export const metadata = { title: "Schedule Your Test Drive | AutoMax LV" };
// Inventory changes as vehicles are added/sold from the admin dashboard —
// revalidate periodically instead of only at build/deploy time.
export const revalidate = 60;

async function getFeaturedVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: "AVAILABLE", ...HAS_PHOTO_WHERE },
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
      <section className="site-hero relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="site-eyebrow site-glass-dark rounded-full px-3 py-1.5 text-white/90">
            <Car size={13} /> Las Vegas, NV
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl">
            Ready to Find Your Next Ride?
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] text-white/70 sm:text-lg">
            Book your appointment and let&rsquo;s find the right vehicle and payment for you.
          </p>
        </div>

        {/* Glass search / booking panel — the one place in the hero that
            earns the glass treatment: it's the actual next action, floating
            over the gradient. Submits straight into the existing inventory
            search (searchPublicInventory's `q` param), so "search from the
            hero" is real functionality, not a decoration. */}
        <div className="site-glass-dark relative mx-auto mt-10 max-w-2xl rounded-2xl p-4 sm:p-5">
          <form action="/inventory" method="GET" className="flex flex-col gap-2.5 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="search"
                name="q"
                placeholder="Search make, model, year…"
                aria-label="Search available vehicles"
                className="w-full rounded-xl border border-white/15 bg-white/10 py-3 pl-10 pr-3 text-[14px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
            </div>
            <button type="submit" className="btn bg-white px-5 py-3 text-[14px] font-bold text-black hover:bg-white/90">
              Search Inventory
            </button>
          </form>
          <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row">
            <Link href="/book" className="btn btn-primary flex-1 justify-center py-2.5 text-[13.5px] shadow-[0_4px_16px_rgba(216,19,36,0.4)]">
              <CalendarCheck size={15} /> Schedule Appointment
            </Link>
            <Link href="/inventory" className="btn flex-1 justify-center border border-white/15 bg-white/5 py-2.5 text-[13.5px] font-bold text-white hover:bg-white/10">
              Browse All Inventory
            </Link>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-7 sm:px-6">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {[
            { icon: ShieldCheck, label: "No-Pressure Visit" },
            { icon: Clock, label: "Pick Your Own Time" },
            { icon: MessageCircleHeart, label: "Text Reminders" },
            { icon: CheckCircle2, label: "Free & No Obligation" },
          ].map((t) => (
            <div key={t.label} className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                <t.icon size={18} />
              </span>
              <span className="text-[12px] font-semibold">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* All buyers welcome */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">Every Buyer Starts Somewhere</h2>
          <p className="mt-3 text-[14px] text-[var(--text-muted)]">
            I work with all kinds of buyers every day — book your test drive even if you have:
          </p>
          <div className="mt-7 grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
            {["Low credit", "No credit", "Limited down payment", "Previous credit issues"].map((r) => (
              <div key={r} className="site-card site-card-hover flex items-center gap-2.5 p-4">
                <CheckCircle2 size={17} className="shrink-0 text-[var(--brand)]" />
                <span className="text-[13px] font-semibold text-[var(--text)]">{r}</span>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[12px] text-[var(--text-faint)]">
            We&rsquo;ll go over financing options together — this isn&rsquo;t a guaranteed-approval offer, just a real conversation about what&rsquo;s possible for you.
          </p>
        </div>
      </section>

      {/* Not ready to test drive yet? */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="site-card mx-auto max-w-2xl p-7 text-center sm:p-9">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
            <MessageCircle size={20} />
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-[var(--text)] sm:text-2xl">Not Ready for an Appointment Yet?</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] text-[var(--text-muted)]">
            Book a free 15-minute call instead — no vehicle needed. We&rsquo;ll just talk through financing, trade-ins, or what fits your budget.
          </p>
          <Link href="/consultation" className="btn btn-secondary mt-5 px-6 py-2.5 text-[14px]">
            <Clock size={15} /> Schedule a Free 15-Min Consultation
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--bg-subtle)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">Booking Takes 2 Minutes</h2>
          <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { n: 1, label: "Pick a vehicle" },
              { n: 2, label: "Tell us about you" },
              { n: 3, label: "Answer a few quick questions" },
              { n: 4, label: "Choose your time" },
            ].map((s) => (
              <div key={s.n} className="site-card p-5 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(216,19,36,0.35)]">{s.n}</div>
                <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 text-center">
            <Link href="/book" className="btn btn-primary px-6 py-3 text-[15px]"><CalendarCheck size={16} /> Book My Test Drive</Link>
          </div>
        </div>
      </section>

      {/* Featured vehicles */}
      {vehicles.length > 0 && (
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">Some of What&rsquo;s on the Lot</h2>
                <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">Don&rsquo;t see what you want? You can enter any vehicle when you book.</p>
              </div>
              <Link href="/inventory" className="text-[13px] font-semibold text-[var(--brand)] hover:underline">View All Available Vehicles →</Link>
            </div>
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((v) => (
                <Link key={v.id} href={`/inventory/${v.id}`} className="site-card site-card-hover group overflow-hidden">
                  <VehicleThumb src={v.photos[0]} alt={`${v.year} ${v.make} ${v.model}`} className="h-40 w-full rounded-t-2xl rounded-b-none" iconSize={36} />
                  <div className="p-4">
                    <p className="text-[14.5px] font-bold text-[var(--text)]">{v.year} {v.make} {v.model}</p>
                    <p className="text-[12.5px] text-[var(--text-muted)]">{v.trim ?? v.bodyStyle ?? v.condition} · {v.mileage.toLocaleString()} mi</p>
                    <div className="mt-2.5 flex items-end justify-between border-t border-[var(--border)] pt-2.5">
                      <div>
                        <span className="block text-[15px] font-extrabold text-[var(--brand)]">{formatCurrency(v.internetPrice ?? v.sellingPrice)}</span>
                        {(v.internetPrice ?? v.sellingPrice) != null && (
                          <span className="text-[11px] font-medium text-[var(--text-muted)]">
                            Est. {formatCurrency(Math.round(estimateMonthlyPayment((v.internetPrice ?? v.sellingPrice)!)))}/mo
                          </span>
                        )}
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100">View Details →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="site-hero px-4 py-16 sm:px-6 sm:py-20">
        <div className="site-glass-dark mx-auto max-w-2xl rounded-2xl px-6 py-10 text-center sm:px-10">
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Let&rsquo;s Get You Behind the Wheel</h2>
          <p className="mt-2 text-[14px] text-white/70">Pick a time that works for you — I&rsquo;ll have the vehicle ready.</p>
          <Link href="/book" className="btn mt-6 w-full bg-white px-6 py-3 text-[15px] font-bold text-black hover:bg-white/90 sm:w-auto">
            Schedule Your Test Drive
          </Link>
        </div>
      </section>
    </div>
  );
}
