import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/tiktok/knowledge-base";
import { TikTokTabs } from "@/components/tiktok/TikTokTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { GlobalModeButtons } from "@/components/tiktok/GlobalModeButtons";
import { SettingsForm } from "@/components/tiktok/SettingsForm";

export default async function TikTokSettingsPage() {
  const [settings, pendingReview] = await Promise.all([getSettings(), prisma.tikTokEscalation.count({ where: { status: "PENDING" } })]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">TikTok AI Settings</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Global defaults — any conversation can still be set to its own mode from its page.</p>
      </div>

      <TikTokTabs pendingReview={pendingReview} />

      <SectionCard title="Default Mode">
        <GlobalModeButtons mode={settings.mode} />
      </SectionCard>

      <SectionCard title="Confidence & Voice">
        <SettingsForm settings={settings} />
      </SectionCard>

      <SectionCard title="TikTok Connection">
        <p className="text-[13px] text-[var(--text-muted)]">
          TikTok doesn&rsquo;t offer a public API for a creator&rsquo;s own DMs — only approved Business Messaging partners get one. Until that&rsquo;s connected, messages
          are logged manually (see the Inbox) and AI replies are copied into TikTok by hand. Nothing about that changes how the AI thinks — see{" "}
          <span className="font-mono text-[12px]">src/lib/tiktok/connector.ts</span> for the seam a real integration plugs into later.
        </p>
      </SectionCard>
    </div>
  );
}
