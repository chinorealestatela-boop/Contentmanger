"use client";

import { useTransition } from "react";
import { UserCheck } from "lucide-react";
import { takeOverConversation } from "@/lib/actions/tiktok";

export function TakeOverButton({ conversationId, alreadyTakenOver }: { conversationId: string; alreadyTakenOver: boolean }) {
  const [pending, startTransition] = useTransition();
  if (alreadyTakenOver) return <span className="badge badge-neutral inline-flex items-center gap-1"><UserCheck size={12} /> You&rsquo;ve taken over</span>;
  return (
    <button disabled={pending} onClick={() => startTransition(() => takeOverConversation(conversationId))} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5">
      <UserCheck size={14} /> Take Over
    </button>
  );
}
