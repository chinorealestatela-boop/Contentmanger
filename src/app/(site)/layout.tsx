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
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg-elevated)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] font-bold text-white">A</span>
            <span className="text-[15px] font-bold text-[var(--text)]">{dealership.name}</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href={telHref} className="hidden items-center gap-1.5 text-[13px] font-semibold text-[var(--text-muted)] sm:flex hover:text-[var(--brand)]">
              <Phone size={14} /> {dealership.phone}
            </a>
            <Link href="/book" className="btn btn-primary btn-sm sm:px-4 sm:py-2">
              Book My Test Drive
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--bg-elevated)] py-8">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-[13px] font-semibold text-[var(--text)]">{dealership.name}</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">{settings.location}</p>
          <a href={telHref} className="mt-1 inline-block text-[12.5px] font-medium text-[var(--brand)]">{dealership.phone}</a>
          <p className="mt-4 text-[11px] text-[var(--text-faint)]">
            By requesting a test drive you agree to be contacted by phone, text, or email about your inquiry. Message and data rates may apply for SMS. See our{" "}
            <Link href="/privacy" className="underline">privacy &amp; SMS terms</Link>.
          </p>
          <p className="mt-3 text-[11px] text-[var(--text-faint)]">
            <Link href="/login" className="hover:text-[var(--text-muted)]">Staff login</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
