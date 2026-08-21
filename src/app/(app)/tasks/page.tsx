import Link from "next/link";
import { requireScope } from "@/lib/queries/scope";
import { getTasks, getTaskCounts, type TaskView } from "@/lib/queries/tasks";
import { TaskRow } from "@/components/tasks/TaskRow";
import { cn } from "@/lib/utils";

const VIEWS: { key: TaskView; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const scope = await requireScope();
  const view = (sp.view as TaskView) ?? "today";
  const [tasks, counts] = await Promise.all([getTasks(scope, view), getTaskCounts(scope)]);

  const countMap: Record<string, number> = { overdue: counts.overdue, today: counts.today, tomorrow: counts.tomorrow, upcoming: counts.upcoming, completed: counts.completed };

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text)]">Tasks</h1>
        <p className="text-[13px] text-[var(--text-muted)]">Every call, text, and follow-up you own — automations create these too.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] pb-3">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/tasks?view=${v.key}`}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] font-medium",
              view === v.key ? "bg-[var(--brand)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            {v.label} <span className="ml-1 text-[11px] opacity-80">{countMap[v.key]}</span>
          </Link>
        ))}
      </div>

      <div className="space-y-2.5">
        {tasks.length === 0 && <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Nothing here. Nice work staying ahead.</div>}
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} overdue={view === "overdue"} />
        ))}
      </div>
    </div>
  );
}
