export type NavItem = {
  label: string;
  href: string;
  icon: string; // lucide-react icon name, resolved in Sidebar
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Leads", href: "/leads", icon: "UserPlus" },
  { label: "Customers", href: "/customers", icon: "Users" },
  { label: "Pipeline", href: "/pipeline", icon: "Kanban" },
  { label: "Calendar", href: "/calendar", icon: "CalendarClock" },
  { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
  { label: "Vehicles", href: "/vehicles", icon: "Car" },
  { label: "Trade-Ins", href: "/trade-ins", icon: "ArrowLeftRight" },
  { label: "Communications", href: "/communications", icon: "MessageSquare" },
  { label: "Message Log", href: "/messages", icon: "Inbox" },
  { label: "Follow-Up Sequences", href: "/follow-up-sequences", icon: "Workflow" },
  { label: "Lost Leads", href: "/lost-leads", icon: "XCircle" },
  { label: "Reactivation", href: "/reactivation", icon: "RefreshCcw" },
  { label: "Reports", href: "/reports", icon: "BarChart3" },
  { label: "Automations", href: "/automations", icon: "Zap" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Today", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Pipeline", href: "/pipeline", icon: "Kanban" },
  { label: "Tasks", href: "/tasks", icon: "CheckSquare" },
  { label: "Customers", href: "/customers", icon: "Users" },
  { label: "More", href: "/more", icon: "Menu" },
];
