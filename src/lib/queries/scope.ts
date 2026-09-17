import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { parsePermissions } from "@/lib/permissions";
import { redirect } from "next/navigation";

export type Scope = {
  userId: string;
  role: string;
  viewAll: boolean;
};

/** Prisma `where` fragment restricting Customer-owned records to what this
 * user is allowed to see: salespeople see their own book, managers/admins
 * see the whole team (per role permissions, see src/lib/permissions.ts). */
export function customerScopeWhere(scope: Scope) {
  return scope.viewAll ? {} : { ownerId: scope.userId };
}

export function leadScopeWhere(scope: Scope) {
  return scope.viewAll ? {} : { assigneeId: scope.userId };
}

/** Requires an authenticated session (redirects to auto-login otherwise) and
 * resolves the current user's visibility scope from their role.
 *
 * The session's own claims (name, roleId) are set once at sign-in and never
 * refreshed, so they go stale the moment an admin renames/reassigns the
 * account — and if the underlying User row is ever deleted, the JWT is
 * still cryptographically "valid" (NextAuth has no server-side revocation
 * for JWT sessions), so every write that used to trust session.user.id as
 * a foreign key would crash with a constraint violation instead of failing
 * cleanly. This re-reads the live User row on every call and re-triggers
 * sign-in if it's gone, so a deleted/renamed account can never masquerade
 * as a valid session. */
export async function requireScope(): Promise<Scope & { userName: string; roleId: string }> {
  const session = await auth();
  if (!session?.user) redirect("/api/auto-login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  });
  if (!user || !user.isActive) redirect("/api/auto-login");

  const perms = parsePermissions(user.role.permissions);

  return {
    userId: user.id,
    role: user.role.name,
    roleId: user.roleId,
    userName: `${user.firstName} ${user.lastName}`,
    viewAll: perms.viewAllCustomers,
  };
}

export async function listTeamUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true, avatarColor: true, title: true },
  });
}
