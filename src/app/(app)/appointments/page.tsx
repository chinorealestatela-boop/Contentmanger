import { redirect } from "next/navigation";

// The dedicated Appointments page was folded into the unified Calendar tab
// (which shows appointments and follow-ups together). This redirect keeps
// old links/bookmarks/stat-card hrefs working.
export default function AppointmentsRedirect() {
  redirect("/calendar");
}
