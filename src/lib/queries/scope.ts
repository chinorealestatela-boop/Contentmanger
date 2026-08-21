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

/** Requires an authenticated session (redirects to /login otherwise) and
 * resolves the current user's visibility scope from their role. */
export async function requireScope(): Promise<Scope & { userName: string; roleId: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = await prisma.role.findUnique({ where: { id: session.user.roleId } });
  const perms = role ? parsePermissions(role.permissions) : null;

  return {
    userId: session.user.id,
    role: session.user.role,
    roleId: session.user.roleId,
    userName: `${session.user.firstName} ${session.user.lastName}`,
    viewAll: perms?.viewAllCustomers ?? false,
  };
}

export async function listTeamUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: { firstName: "asc" },
    select: { id: true, firstName: true, lastName: true, avatarColor: true, title: true },
  });
}
