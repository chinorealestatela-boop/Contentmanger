"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Users } from "lucide-react";
import { setOpsStage } from "@/lib/actions/trips";
import { OPS_STAGES } from "@/lib/constants";
import { formatTime12h, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";

export type OpsBookingCard = {
  id: string;
  bookingNumber: string;
  opsStage: string;
  pickupTime: string;
  passengers: number;
  customer: { firstName: string; lastName: string; tier: string };
  vehicle: { name: string } | null;
  driver: { firstName: string; lastName: string } | null;
};

export function OpsBoard({ bookings: initial }: { bookings: OpsBookingCard[] }) {
  const [bookings, setBookings] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = new Map<string, OpsBookingCard[]>();
    for (const s of OPS_STAGES) map.set(s.value, []);
    for (const b of bookings) map.get(b.opsStage)?.push(b);
    return map;
  }, [bookings]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string);
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const bookingId = active.id as string;
    const newStage = over.id as string;
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.opsStage === newStage) return;
    setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, opsStage: newStage } : b)));
    startTransition(() => setOpsStage(bookingId, newStage));
  }

  const active = bookings.find((b) => b.id === activeId);

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {OPS_STAGES.map((stage) => (
          <Column key={stage.value} stage={stage} bookings={byStage.get(stage.value) ?? []} />
        ))}
      </div>
      <DragOverlay>{active && <BookingCard booking={active} dragging />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, bookings }: { stage: { value: string; label: string; color?: string }; bookings: OpsBookingCard[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-xl border border-[var(--border)] bg-white/[0.02]", isOver && "ring-2 ring-[var(--brand-line)]")}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: stage.color }} />
          <span className="text-[12px] font-semibold text-[var(--text)]">{stage.label}</span>
        </div>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--text-muted)]">{bookings.length}</span>
      </div>
      <div className="min-h-[80px] space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: "calc(100vh - 260px)" }}>
        {bookings.map((b) => <DraggableCard key={b.id} booking={b} />)}
        {bookings.length === 0 && <p className="px-2 py-6 text-center text-[11px] text-[var(--text-faint)]">Empty</p>}
      </div>
    </div>
  );
}

function DraggableCard({ booking }: { booking: OpsBookingCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: booking.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <BookingCard booking={booking} />
    </div>
  );
}

function BookingCard({ booking, dragging }: { booking: OpsBookingCard; dragging?: boolean }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      onClick={(e) => dragging && e.preventDefault()}
      className={cn("card block cursor-grab p-3 active:cursor-grabbing", dragging && "rotate-1 shadow-xl")}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[var(--text)]">{formatTime12h(booking.pickupTime)}</p>
        {booking.customer.tier !== "STANDARD" && <span className="badge badge-gold !text-[9px] !px-1.5 !py-0.5">{booking.customer.tier}</span>}
      </div>
      <p className="mt-1 truncate text-[12.5px] font-medium text-[var(--text)]">{fullName(booking.customer)}</p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">{booking.vehicle?.name ?? "Vehicle TBD"}{booking.driver ? ` · ${fullName(booking.driver)}` : ""}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[var(--text-faint)]"><Users size={10} /> {booking.passengers}</p>
    </Link>
  );
}
