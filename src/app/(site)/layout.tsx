import Link from "next/link";
import { Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getBookingSettings } from "@/lib/availability";

async function getDealership() {
  const row = await prisma.setting.findUnique({ where: { key: "dealership" } });
  const parsed = row ? JSON.parse(row.value) : {};
  return { name: parsed.name || "AutoMax LV", phone: parsed.phone || "702-325-3898" };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [dealership, settings] = await Promise.all([getDealership(), getBookingSettings()]);
  const telHref = `tel:${dealership.phone.replace(/[^\d+]/g, "")}`;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)]">
      <header className="site-glass-nav sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand)] text-[15px] font-extrabold text-white shadow-[0_4px_14px_rgba(216,19,36,0.35)]">A</span>
            <span className="text-[15px] font-bold tracking-tight text-[var(--text)]">{dealership.name}</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/inventory" className="hidden text-[13px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--brand)] sm:block">
              Inventory
            </Link>
            <Link href="/consultation" className="hidden text-[13px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--brand)] sm:block">
              Financing
            </Link>
            <a href={telHref} className="hidden items-center gap-1.5 text-[13px] font-semibold text-[var(--text-muted)] transition-colors hover:text-[var(--brand)] sm:flex">
              <Phone size={14} /> {dealership.phone}
            </a>
            <Link href="/book" className="btn btn-primary btn-sm shadow-[0_4px_14px_rgba(216,19,36,0.3)] sm:px-4 sm:py-2">
              Book My Test Drive
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--site-ink)] py-12 text-white">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand)] text-[16px] font-extrabold text-white">A</span>
          <p className="mt-3 text-[14px] font-bold">{dealership.name}</p>
          <p className="mt-1 text-[12.5px] text-white/60">{settings.location}</p>
          <a href={telHref} className="mt-1.5 inline-block text-[13px] font-semibold text-white/90 hover:text-white">{dealership.phone}</a>

          <div className="mx-auto mt-6 h-px w-full max-w-xs bg-white/10" />

          <p className="mx-auto mt-6 max-w-xl text-[11px] leading-relaxed text-white/40">
            By requesting a test drive you agree to be contacted by phone, text, or email about your inquiry. Message and data rates may apply for SMS. See our{" "}
            <Link href="/privacy" className="underline hover:text-white/60">privacy &amp; SMS terms</Link> and{" "}
            <Link href="/terms" className="underline hover:text-white/60">terms &amp; conditions</Link>.
          </p>
          <p className="mt-4 text-[11px] text-white/30">
            <Link href="/login" className="hover:text-white/60">Staff login</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
