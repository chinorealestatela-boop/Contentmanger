import { getOperationsBoardBookings } from "@/lib/queries/bookings";
import { OpsBoard } from "@/components/operations/OpsBoard";

export default async function OperationsPage() {
  const bookings = await getOperationsBoardBookings();

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="font-display text-3xl font-medium text-[var(--text)]">Operations Board</h1>
        <p className="text-[13px] text-[var(--text-muted)]">The command center — drag a reservation between stages as it moves through the day. Showing the next 3 days.</p>
      </div>
      <OpsBoard bookings={bookings} />
    </div>
  );
}
