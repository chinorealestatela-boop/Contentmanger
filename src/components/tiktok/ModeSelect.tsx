"use client";

import { useTransition } from "react";
import { setConversationMode } from "@/lib/actions/tiktok";
import { TIKTOK_MODES, type TikTokMode } from "@/lib/constants";

export function ModeSelect({ conversationId, mode }: { conversationId: string; mode: string | null }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      disabled={pending}
      defaultValue={mode ?? ""}
      onChange={(e) => startTransition(() => setConversationMode(conversationId, (e.target.value || "DRAFT") as TikTokMode))}
      className="input !w-auto py-1 text-[12.5px]"
    >
      <option value="">Use global default</option>
      {TIKTOK_MODES.map((m) => (
        <option key={m.value} value={m.value}>{m.label.split(" — ")[0]}</option>
      ))}
    </select>
  );
}
