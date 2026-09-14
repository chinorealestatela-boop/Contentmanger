import { requireScope } from "@/lib/queries/scope";
import { prisma } from "@/lib/prisma";
import { RuleToggle } from "@/components/automations/RuleToggle";
import { RunChecksButton } from "@/components/automations/RunChecksButton";
import { NewRuleForm } from "@/components/automations/NewRuleForm";
import { DeleteRuleButton } from "@/components/automations/DeleteRuleButton";
import { optionLabel, TRIGGER_EVENTS } from "@/lib/constants";
import { formatTimeAgo } from "@/lib/format";

function describeAction(a: { type: string; title?: string; taskType?: string; sequenceName?: string; notifyType?: string; templateKey?: string }) {
  if (a.type === "CREATE_TASK") return `create task "${a.title}"`;
  if (a.type === "NOTIFY_STAFF") return `notify staff (${a.notifyType})`;
  if (a.type === "SEND_MESSAGE") return `send "${a.templateKey}" message`;
  if (a.type === "ENROLL_SEQUENCE") return `enroll in "${a.sequenceName ?? "default"}" sequence`;
  return "advance sequence";
}

export default async function AutomationsPage() {
  await requireScope();
  const [rules, recentRuns, templates] = await Promise.all([
    prisma.automationRule.findMany({ orderBy: { order: "asc" } }),
    prisma.automationRun.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { rule: true } }),
    prisma.messageTemplate.findMany({ select: { key: true } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-[var(--text)]">Automations</h1>
          <p className="text-[13px] text-[var(--text-muted)]">Rules that create tasks, notify staff, and send messages automatically — with a full audit trail.</p>
        </div>
        <RunChecksButton />
      </div>

      <section className="space-y-2.5">
        {rules.map((rule) => {
          const actions = JSON.parse(rule.actions) as { type: string; title?: string; taskType?: string; sequenceName?: string; notifyType?: string; templateKey?: string }[];
          return (
            <div key={rule.id} className="card flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--text)]">{rule.name}</p>
                <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                  WHEN {optionLabel(TRIGGER_EVENTS, rule.triggerEvent)} → {actions.map(describeAction).join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <RuleToggle ruleId={rule.id} active={rule.active} />
                <DeleteRuleButton ruleId={rule.id} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-[13.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Create Custom Rule</h2>
        <NewRuleForm templateKeys={templates.map((t) => t.key)} />
      </section>

      <section className="card">
        <div className="border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent Activity</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {recentRuns.length === 0 && <p className="px-5 py-8 text-center text-sm text-[var(--text-muted)]">No automations have fired yet.</p>}
          {recentRuns.map((run) => (
            <div key={run.id} className="flex items-center justify-between px-5 py-2.5 text-[12.5px]">
              <span className="text-[var(--text)]">{run.rule.name}{run.detail ? ` — ${run.detail}` : ""}</span>
              <span className="text-[var(--text-faint)]">{formatTimeAgo(run.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
