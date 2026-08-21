import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Compass size={26} />
      </span>
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Page not found</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved.</p>
      </div>
      <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
    </div>
  );
}
