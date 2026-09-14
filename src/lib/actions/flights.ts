"use server";

import { requireScope } from "@/lib/queries/scope";
import { setFlightStatus } from "@/lib/integrations/flights";
import { revalidatePath } from "next/cache";

export async function setFlightStatusAction(bookingId: string, status: string) {
  const scope = await requireScope();
  await setFlightStatus(bookingId, status, scope.userId);
  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/dashboard");
}
