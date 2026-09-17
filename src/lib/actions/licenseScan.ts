"use server";

import { prisma } from "@/lib/prisma";
import { requireScope } from "@/lib/queries/scope";

export type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  ownerName: string;
};

/** Looks for an existing customer that could be the same person as a
 * just-scanned license, matched by name. Deliberately NOT restricted to
 * the current salesperson's own book the way customerScopeWhere()
 * restricts everything else in the app — the entire point of this check
 * is catching a record a *different* salesperson already created, same
 * reasoning as why vehicle search in globalSearch() is unscoped. Returns
 * only enough to tell two people apart (name/phone/email/city/owner), not
 * the full customer record. */
export async function findPossibleDuplicates(firstName: string, lastName: string): Promise<DuplicateMatch[]> {
  await requireScope();
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f || !l) return [];

  const matches = await prisma.customer.findMany({
    where: { firstName: { contains: f }, lastName: { contains: l } },
    include: { owner: true },
    take: 5,
  });

  return matches.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    city: c.city,
    ownerName: `${c.owner.firstName} ${c.owner.lastName}`,
  }));
}
