"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log the real error for debugging; never show technical details to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle size={26} />
      </span>
      <div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Something went wrong</h1>
        <p className="mt-1 max-w-sm text-sm text-[var(--text-muted)]">
          We hit an unexpected error loading this page. Nothing was lost — try again, and if it keeps happening let your admin know.
        </p>
      </div>
      <button onClick={() => reset()} className="btn btn-primary">Try Again</button>
    </div>
  );
}
