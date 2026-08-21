import { differenceInCalendarDays, format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from "date-fns";

export function formatCurrency(n: number | null | undefined) {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatDate(d: Date | string | null | undefined, fmt = "MMM d, yyyy") {
  if (!d) return "—";
  return format(new Date(d), fmt);
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return format(new Date(d), "MMM d, yyyy 'at' h:mm a");
}

export function formatRelativeDay(d: Date | string | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0 && days >= -7) return `${Math.abs(days)}d ago`;
  if (days > 0 && days <= 7) return `In ${days}d`;
  return format(date, "MMM d");
}

export function formatTimeAgo(d: Date | string | null | undefined) {
  if (!d) return "—";
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function formatTime12h(time: string | null | undefined) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

export function isOverdue(d: Date | string | null | undefined) {
  if (!d) return false;
  const date = new Date(d);
  const now = new Date();
  return date < now && !isToday(date) ? true : date < now && isToday(date) && date.getHours() < now.getHours();
}

export function daysBetween(a: Date | string, b: Date | string = new Date()) {
  return differenceInCalendarDays(new Date(b), new Date(a));
}

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}
