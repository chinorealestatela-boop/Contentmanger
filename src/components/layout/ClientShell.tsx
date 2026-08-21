"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { GlobalSearchBar } from "@/components/layout/GlobalSearchBar";
import { NotificationBell, type NotificationDTO } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/layout/UserMenu";
import { AssistantPanel } from "@/components/ai/AssistantPanel";

export function ClientShell({
  user,
  notifications,
  children,
}: {
  user: { firstName: string; lastName: string; title?: string; role: string; avatarColor: string };
  notifications: NotificationDTO[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-64 shrink-0 lg:block">
        <Sidebar onOpenAssistant={() => setAssistantOpen(true)} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 shrink-0">
            <Sidebar onNavigate={() => setDrawerOpen(false)} onOpenAssistant={() => { setAssistantOpen(true); setDrawerOpen(false); }} />
          </div>
          <button aria-label="Close menu" className="flex-1 bg-black/30" onClick={() => setDrawerOpen(false)}>
            <X className="m-4 text-white" size={20} />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-4 sm:px-6">
          <button className="rounded-lg p-1.5 hover:bg-[var(--bg-subtle)] lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <GlobalSearchBar />
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <NotificationBell initial={notifications} />
            <div className="h-6 w-px bg-[var(--border)]" />
            <UserMenu firstName={user.firstName} lastName={user.lastName} title={user.title} role={user.role} color={user.avatarColor} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">{children}</main>
      </div>

      <MobileNav onMore={() => setDrawerOpen(true)} />
      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
