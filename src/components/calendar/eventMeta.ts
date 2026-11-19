import {
  Phone, PhoneCall, Car, Building2, Eye, DollarSign, ArrowLeftRight, Briefcase, Truck, MoreHorizontal, MessageCircle, AlertTriangle,
  Mail, Search, Users, Bell, Landmark,
  type LucideIcon,
} from "lucide-react";
import { optionColor, APPOINTMENT_TYPES, TASK_TYPES } from "@/lib/constants";

// Icon per calendar event type (Appointment.type values + the synthetic
// "FOLLOW_UP" / "PAYMENT_FIRST_DUE" / "PAYMENT_FIRST_LATE" /
// "PAYMENT_PICK_DUE" / "PAYMENT_PICK_LATE" types used for FollowUp and
// Payment rows on the unified calendar — see queries/calendar.ts).
export const EVENT_ICONS: Record<string, LucideIcon> = {
  CUSTOMER_CALL: Phone,
  FOLLOW_UP_CALL: PhoneCall,
  FOLLOW_UP: PhoneCall,
  TEST_DRIVE: Car,
  DEALERSHIP_APPOINTMENT: Building2,
  VEHICLE_WALKAROUND: Eye,
  FINANCING_DISCUSSION: DollarSign,
  TRADE_IN_EVALUATION: ArrowLeftRight,
  SALES_APPOINTMENT: Briefcase,
  DELIVERY: Truck,
  CONSULTATION: MessageCircle,
  PAYMENT_FIRST_DUE: Landmark,
  PAYMENT_FIRST_LATE: AlertTriangle,
  PAYMENT_PICK_DUE: DollarSign,
  PAYMENT_PICK_LATE: AlertTriangle,
  OTHER: MoreHorizontal,
};

// Icon per Task.type value — used when a calendar event's `kind` is "task"
// (see queries/calendar.ts's taskEvents()), keyed the same as TASK_TYPES in
// constants.ts so a task's color/icon match whatever TaskRow.tsx shows for
// it on the Tasks list.
export const TASK_EVENT_ICONS: Record<string, LucideIcon> = {
  CALL: Phone,
  TEXT: MessageCircle,
  EMAIL: Mail,
  FOLLOW_UP: PhoneCall,
  APPOINTMENT: Car,
  VEHICLE_INFO: Eye,
  VEHICLE_AVAILABILITY: Search,
  FINANCING_REQUEST: DollarSign,
  INVENTORY_ALERT: Bell,
  TRADE: ArrowLeftRight,
  CREDIT: Briefcase,
  DELIVERY: Truck,
  REFERRAL: Users,
  OTHER: MoreHorizontal,
};

// Payment Type color coding (applies everywhere a payment date shows —
// calendar, customer profile, dashboard, reminders): FIRST (bank/lender)
// is always red, PICK (dealership down payment) is always green,
// regardless of due/late status — status still shows via the separate
// badge EventRow/PaymentRow render, so color here means "who it's owed
// to," not "how urgent."
export function eventColor(type: string, kind?: string) {
  if (kind === "task") return optionColor(TASK_TYPES, type);
  if (type === "FOLLOW_UP") return "#0891b2";
  if (type.startsWith("PAYMENT_FIRST")) return "#DC2626";
  if (type.startsWith("PAYMENT_PICK")) return "#16A34A";
  return optionColor(APPOINTMENT_TYPES, type);
}

export function eventIcon(type: string, kind?: string): LucideIcon {
  if (kind === "task") return TASK_EVENT_ICONS[type] ?? MoreHorizontal;
  return EVENT_ICONS[type] ?? MoreHorizontal;
}
