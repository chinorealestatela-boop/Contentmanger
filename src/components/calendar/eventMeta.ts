import {
  Phone, PhoneCall, Car, Building2, Eye, DollarSign, ArrowLeftRight, Briefcase, Truck, MoreHorizontal, MessageCircle, AlertTriangle,
  Mail, Search, Users,
  type LucideIcon,
} from "lucide-react";
import { optionColor, APPOINTMENT_TYPES, TASK_TYPES } from "@/lib/constants";

// Icon per calendar event type (Appointment.type values + the synthetic
// "FOLLOW_UP"/"PAYMENT_DUE"/"PAYMENT_LATE" types used for FollowUp and
// Payment rows on the unified calendar).
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
  PAYMENT_DUE: DollarSign,
  PAYMENT_LATE: AlertTriangle,
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
  TRADE: ArrowLeftRight,
  CREDIT: Briefcase,
  DELIVERY: Truck,
  REFERRAL: Users,
  OTHER: MoreHorizontal,
};

export function eventColor(type: string, kind?: string) {
  if (kind === "task") return optionColor(TASK_TYPES, type);
  if (type === "FOLLOW_UP") return "#0891b2";
  if (type === "PAYMENT_LATE") return "#dc2626";
  if (type === "PAYMENT_DUE") return "#16a34a";
  return optionColor(APPOINTMENT_TYPES, type);
}

export function eventIcon(type: string, kind?: string): LucideIcon {
  if (kind === "task") return TASK_EVENT_ICONS[type] ?? MoreHorizontal;
  return EVENT_ICONS[type] ?? MoreHorizontal;
}
