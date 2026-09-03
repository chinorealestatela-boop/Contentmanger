import Link from "next/link";
import { CalendarCheck, ShieldCheck, Clock, Car, MessageCircleHeart, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Schedule Your Test Drive | AutoMax LV" };
// Inventory changes as vehicles are added/sold from the admin dashboard —
// revalidate periodically instead of only at build/deploy time.
export const revalidate = 60;

async function getFeaturedVehicles() {
  return prisma.vehicle.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { year: "desc" },
    take: 6,
    select: { id: true, year: true, make: true, model: true, trim: true, condition: true, internetPrice: true, sellingPrice: true, mileage: true, bodyStyle: true },
  });
}

export default async function LandingPage() {
  const vehicles = await getFeaturedVehicles();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-[var(--sidebar-bg)] px-4 py-16 text-white sm:px-6 sm:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 20% 20%, var(--brand) 0%, transparent 55%)" }} />
        <div className="relative mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white/90">
            <Car size={13} /> Las Vegas, NV
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">Ready to Find Your Next Ride?</h1>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/75 sm:text-lg">
            Schedule your test drive and let&rsquo;s find the right vehicle and payment for you.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/book" className="btn btn-primary w-full px-6 py-3 text-[15px] sm:w-auto">
              Schedule My Test Drive
            </Link>
            <Link href="/book" className="btn w-full border border-white/25 bg-white/5 px-6 py-3 text-[15px] text-white hover:bg-white/10 sm:w-auto">
              Check Availability
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-white/50">Takes about 2 minutes · No obligation</p>
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
            <h2 className="text-2xl font-bold text-[var(--text)] sm:text-3xl">Some of What&rsquo;s on the Lot</h2>
            <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">Don&rsquo;t see what you want? You can enter any vehicle when you book.</p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((v) => (
                <Link key={v.id} href={`/book?vehicle=${v.id}`} className="card group overflow-hidden p-4 hover:shadow-md">
                  <div className="flex h-28 items-center justify-center rounded-lg bg-[var(--bg-subtle)] text-[var(--text-faint)]">
                    <Car size={36} />
                  </div>
                  <p className="mt-3 text-[14px] font-semibold text-[var(--text)]">{v.year} {v.make} {v.model}</p>
                  <p className="text-[12.5px] text-[var(--text-muted)]">{v.trim ?? v.bodyStyle ?? v.condition} · {v.mileage.toLocaleString()} mi</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[var(--brand)]">{formatCurrency(v.internetPrice ?? v.sellingPrice)}</span>
                    <span className="text-[12px] font-semibold text-[var(--brand)] opacity-0 transition-opacity group-hover:opacity-100">Book Test Drive →</span>
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
