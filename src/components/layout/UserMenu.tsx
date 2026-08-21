"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { logoutAction } from "@/lib/actions/session";

export function UserMenu({
  firstName,
  lastName,
  title,
  role,
  color,
}: {
  firstName: string;
  lastName: string;
  title?: string;
  role: string;
  color: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-[var(--bg-subtle)]">
        <Avatar firstName={firstName} lastName={lastName} color={color} size="sm" />
        <div className="hidden text-left sm:block">
          <p className="text-[13px] font-semibold leading-tight text-[var(--text)]">{firstName} {lastName}</p>
          <p className="text-[11px] leading-tight text-[var(--text-muted)]">{title ?? role}</p>
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="animate-fade-in absolute right-0 z-40 mt-2 w-52 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-1.5 shadow-lg">
            <Link href="/settings/profile" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--bg-subtle)]">
              <User size={15} /> My Profile
            </Link>
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[var(--text)] hover:bg-[var(--bg-subtle)]">
              <Settings size={15} /> Settings
            </Link>
            <div className="my-1 border-t border-[var(--border)]" />
            <form action={logoutAction}>
              <button type="submit" className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] text-red-600 hover:bg-red-50">
                <LogOut size={15} /> Log Out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
