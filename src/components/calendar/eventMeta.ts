import {
  Phone, PhoneCall, Car, Building2, Eye, DollarSign, ArrowLeftRight, Briefcase, Truck, MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { optionColor, APPOINTMENT_TYPES } from "@/lib/constants";

// Icon per calendar event type (Appointment.type values + the synthetic
// "FOLLOW_UP" type used for FollowUp rows on the unified calendar).
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
  OTHER: MoreHorizontal,
};

export function eventColor(type: string) {
  if (type === "FOLLOW_UP") return "#0891b2";
  return optionColor(APPOINTMENT_TYPES, type);
}

export function eventIcon(type: string): LucideIcon {
  return EVENT_ICONS[type] ?? MoreHorizontal;
}
