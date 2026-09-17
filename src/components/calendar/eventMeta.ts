import {
  Phone, PhoneCall, Car, Building2, Eye, DollarSign, ArrowLeftRight, Briefcase, Truck, MoreHorizontal, MessageCircle, AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { optionColor, APPOINTMENT_TYPES } from "@/lib/constants";

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

export function eventColor(type: string) {
  if (type === "FOLLOW_UP") return "#0891b2";
  if (type === "PAYMENT_LATE") return "#dc2626";
  if (type === "PAYMENT_DUE") return "#16a34a";
  return optionColor(APPOINTMENT_TYPES, type);
}

export function eventIcon(type: string): LucideIcon {
  return EVENT_ICONS[type] ?? MoreHorizontal;
}
