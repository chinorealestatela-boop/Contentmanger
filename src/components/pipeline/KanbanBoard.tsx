"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Avatar } from "@/components/ui/Avatar";
import { TemperatureBadge, Badge } from "@/components/ui/Badge";
import { formatTimeAgo, daysBetween } from "@/lib/format";
import { changeLeadStage } from "@/lib/actions/leads";
import { cn } from "@/lib/utils";

type Stage = { id: string; name: string; color: string; order: number; isClosedWon: boolean; isClosedLost: boolean };
type LeadCardData = {
  id: string;
  stageId: string;
  score: number;
  temperature: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  stageEnteredAt: string;
  customer: { id: string; firstName: string; lastName: string };
  vehicle: string | null;
  hasAppointment: boolean;
};

export function KanbanBoard({ stages, leads: initialLeads }: { stages: Stage[]; leads: LeadCardData[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = new Map<string, LeadCardData[]>();
    for (const s of stages) map.set(s.id, []);
    for (const l of leads) map.get(l.stageId)?.push(l);
    return map;
  }, [leads, stages]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const leadId = active.id as string;
    const newStageId = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === newStageId) return;

    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId: newStageId } : l)));
    startTransition(() => changeLeadStage(leadId, newStageId));
  }

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column key={stage.id} stage={stage} leads={byStage.get(stage.id) ?? []} />
        ))}
      </div>
      <DragOverlay>{activeLead && <LeadCard lead={activeLead} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, leads }: { stage: Stage; leads: LeadCardData[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div ref={setNodeRef} className={cn("flex w-72 shrink-0 flex-col rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]", isOver && "ring-2 ring-[var(--brand)]")}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
          <span className="text-[12.5px] font-semibold text-[var(--text)]">{stage.name}</span>
        </div>
        <span className="rounded-full bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--text-muted)]">{leads.length}</span>
      </div>
      <div className="min-h-[80px] space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {leads.map((lead) => (
          <DraggableLeadCard key={lead.id} lead={lead} />
        ))}
        {leads.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-[var(--text-faint)]">No leads</p>}
      </div>
    </div>
  );
}

function DraggableLeadCard({ lead }: { lead: LeadCardData }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <LeadCard lead={lead} />
    </div>
  );
}

function LeadCard({ lead, dragging }: { lead: LeadCardData; dragging?: boolean }) {
  const daysInStage = daysBetween(lead.stageEnteredAt);
  return (
    <Link
      href={`/customers/${lead.customer.id}`}
      onClick={(e) => dragging && e.preventDefault()}
      className={cn("block cursor-grab rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-sm hover:shadow-md active:cursor-grabbing", dragging && "rotate-2 shadow-xl")}
    >
      <div className="flex items-center gap-2">
        <Avatar firstName={lead.customer.firstName} lastName={lead.customer.lastName} size="xs" />
        <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{lead.customer.firstName} {lead.customer.lastName}</p>
      </div>
      <p className="mt-1.5 truncate text-[11px] text-[var(--text-muted)]">{lead.vehicle ?? "No vehicle noted"}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <TemperatureBadge temperature={lead.temperature} className="!text-[9px] !px-1.5 !py-0.5" />
        {lead.hasAppointment && <Badge variant="appointment" className="!text-[9px] !px-1.5 !py-0.5">Appt</Badge>}
        <span className="badge badge-neutral !text-[9px] !px-1.5 !py-0.5">{lead.score}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span>{lead.lastContactedAt ? formatTimeAgo(lead.lastContactedAt) : "Never contacted"}</span>
        <span>{daysInStage}d in stage</span>
      </div>
    </Link>
  );
}
