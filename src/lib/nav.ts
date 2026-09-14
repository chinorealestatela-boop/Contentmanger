export type NavItem = {
  label: string;
  href: string;
  icon: string; // lucide-react icon name, resolved in Sidebar
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Leads", href: "/leads", icon: "UserPlus" },
  { label: "Pipeline", href: "/pipeline", icon: "Kanban" },
  { label: "Clients", href: "/customers", icon: "Users" },
  { label: "Bookings", href: "/bookings", icon: "CalendarCheck" },
  { label: "Quotes", href: "/quotes", icon: "FileText" },
  { label: "Operations", href: "/operations", icon: "Radar" },
  { label: "Calendar", href: "/calendar", icon: "CalendarClock" },
  { label: "Fleet", href: "/fleet", icon: "Car" },
  { label: "Live Map", href: "/live-map", icon: "MapPin" },
  { label: "Drivers", href: "/drivers", icon: "IdCard" },
  { label: "Payments", href: "/payments", icon: "CreditCard" },
  { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
  { label: "Follow-Ups", href: "/follow-ups", icon: "Workflow" },
  { label: "Analytics", href: "/analytics", icon: "BarChart3" },
  { label: "Automations", href: "/automations", icon: "Zap" },
  { label: "AI Assistant", href: "/assistant", icon: "Sparkles" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Leads", href: "/leads", icon: "UserPlus" },
  { label: "Bookings", href: "/bookings", icon: "CalendarCheck" },
  { label: "Fleet", href: "/fleet", icon: "Car" },
  { label: "More", href: "/more", icon: "Menu" },
];

export const DRIVER_NAV_ITEMS: NavItem[] = [
  { label: "My Trips", href: "/driver", icon: "Route" },
];
