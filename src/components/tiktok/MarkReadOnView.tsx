"use client";

import { useEffect } from "react";
import { markConversationRead } from "@/lib/actions/tiktok";

export function MarkReadOnView({ conversationId, unread }: { conversationId: string; unread: boolean }) {
  useEffect(() => {
    if (unread) markConversationRead(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
  return null;
}
