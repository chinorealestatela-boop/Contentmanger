// Follow-up task automation — the fix for "I followed up with this
// customer and the task/dashboard still says OVERDUE."
//
// Root cause (confirmed by reading every call site before writing this):
// there are two separate places a customer's "needs follow-up" signal
// lives, and neither was ever updated by the actions that actually
// represent following up:
//
// 1. Task rows (type CALL/TEXT/EMAIL/FOLLOW_UP/...) — src/lib/queries/
//    tasks.ts already computes OVERDUE correctly and *only* from
//    {status: "PENDING", dueDate < today} (never stored as its own
//    value — see getTaskDisplayStatus below, now the one place that
//    computation happens). The actual bug was that nothing except the
//    manual "Complete" button (completeTask in actions/tasks.ts) ever
//    moved a task to COMPLETED — updating a customer, adding a note,
//    logging a call, or booking an appointment through the CRM never
//    touched Task.status at all, so a task someone had genuinely acted
//    on just sat there PENDING until its due date passed and it started
//    reading OVERDUE forever.
//
// 2. Lead.nextFollowUpAt — set once at lead creation (createLead) and by
//    the *public* booking flow, then never advanced again by anything
//    in the internal CRM. This field independently drives the
//    dashboard's "Overdue Follow-Ups" tile, the Action Center list, the
//    Follow-Up Queue, the pipeline board's badge, and the "Next
//    follow-up" line on the customer profile — all of which kept
//    reading overdue for the same reason as (1): nothing ever cleared
//    it after a real follow-up happened.
//
// recordFollowUpAction() is the single entry point that fixes both at
// once — call it from every action that represents a genuine follow-up
// touch (see the qualifying-action call sites: actions/customers.ts,
// notes.ts, communications.ts, appointments.ts, leads.ts, payments.ts).
// Deliberately scoped to touches whose date has already arrived (today
// or earlier): a follow-up scheduled for next week is a *different*,
// still-necessary future touchpoint and must never be silently closed
// out just because something unrelated happened today.

import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";

export type FollowUpTaskType = "CALL" | "TEXT" | "EMAIL" | "FOLLOW_UP" | "APPOINTMENT" | "TRADE" | "CREDIT" | "DELIVERY" | "OTHER";
export type TaskDisplayStatus = "PENDING" | "OVERDUE" | "COMPLETED" | "SNOOZED" | "CANCELLED";

/** The single source of truth for whether a task reads as OVERDUE.
 * Task.status itself never stores "OVERDUE" — a task is PENDING right up
 * until it's COMPLETED/SNOOZED/CANCELLED, and OVERDUE is just what a
 * still-PENDING task looks like once its due date has passed. That
 * means completing a task (status -> COMPLETED) always and immediately
 * clears OVERDUE everywhere this function is used, with nothing to fall
 * out of sync — there's no separate "overdue" flag anywhere to forget to
 * update. */
export function getTaskDisplayStatus(task: { status: string; dueDate: Date }, now: Date = new Date()): TaskDisplayStatus {
  if (task.status === "PENDING" && task.dueDate < startOfDay(now)) return "OVERDUE";
  return task.status as TaskDisplayStatus;
}

/** Auto-completes this customer's due-or-overdue PENDING tasks whose
 * type matches the action that just happened (see each call site for
 * why that type list was chosen — e.g. a note only completes CALL/TEXT/
 * EMAIL/FOLLOW_UP/OTHER tasks, never a TRADE or CREDIT task, since a
 * note alone isn't evidence either of those specific things happened).
 * Never touches a task due in the future, matching "preserve scheduled
 * future follow-ups when they are still necessary." */
async function completeQualifyingTasks(params: { customerId: string; leadId?: string | null; actorId: string; taskTypes: FollowUpTaskType[]; source: string }) {
  const tasks = await prisma.task.findMany({
    where: { customerId: params.customerId, status: "PENDING", type: { in: params.taskTypes }, dueDate: { lte: endOfDay(new Date()) } },
  });
  if (tasks.length === 0) return;

  for (const task of tasks) {
    const previousStatus = getTaskDisplayStatus(task);
    await prisma.task.update({ where: { id: task.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await logActivity({
      customerId: params.customerId,
      leadId: params.leadId ?? task.leadId,
      type: "TASK_COMPLETED",
      description: `Task auto-completed: "${task.title}" — ${params.source}.`,
      actorId: params.actorId,
      metadata: { taskId: task.id, previousStatus, newStatus: "COMPLETED", completionSource: params.source },
    });
  }
}

/** Clears the "you owe this customer a follow-up" signal that drives
 * the dashboard tile / Action Center / Follow-Up Queue / pipeline badge
 * / customer profile "Next follow-up" line — all of which read straight
 * off Lead.nextFollowUpAt. Only clears it when it was actually due
 * (today or earlier); a deliberately-scheduled future follow-up date is
 * left untouched. Setting it to null (rather than guessing a new date)
 * means "no follow-up currently owed" — a fresh one gets set the next
 * time an automation or salesperson schedules one. */
async function bumpFollowUp(params: { customerId: string }) {
  const dueLeads = await prisma.lead.findMany({
    where: { customerId: params.customerId, status: "ACTIVE", nextFollowUpAt: { lte: endOfDay(new Date()), not: null } },
    select: { id: true },
  });
  if (dueLeads.length === 0) return;

  await prisma.lead.updateMany({
    where: { id: { in: dueLeads.map((l) => l.id) } },
    data: { nextFollowUpAt: null, lastContactedAt: new Date() },
  });
}

/** Call this from any action that represents a genuine follow-up touch
 * on a customer. Fixes both systems described above in one call, then
 * revalidates every page that reads either of them. Callers still do
 * their own revalidatePath for whatever they changed directly (e.g.
 * addNote revalidates the customer page) — this only covers the
 * task/follow-up-specific views. */
export async function recordFollowUpAction(params: { customerId: string; leadId?: string | null; actorId: string; taskTypes: FollowUpTaskType[]; source: string }) {
  await Promise.all([completeQualifyingTasks(params), bumpFollowUp(params)]);

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/pipeline");
}
