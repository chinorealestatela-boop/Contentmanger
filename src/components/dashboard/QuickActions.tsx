"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CalendarPlus, ListPlus } from "lucide-react";
import { NewTaskModal } from "@/components/tasks/NewTaskButton";

export function DashboardQuickActions({ customers }: { customers: { id: string; firstName: string; lastName: string }[] }) {
  const [taskModalOpen, setTaskModalOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/leads/new" className="btn btn-primary">
        <UserPlus size={15} /> Add Lead
      </Link>
      <Link href="/appointments/new" className="btn btn-secondary">
        <CalendarPlus size={15} /> Schedule Appointment
      </Link>
      <button className="btn btn-secondary" onClick={() => setTaskModalOpen(true)}>
        <ListPlus size={15} /> Add Task
      </button>
      {taskModalOpen && <NewTaskModal customers={customers} onClose={() => setTaskModalOpen(false)} />}
    </div>
  );
}
