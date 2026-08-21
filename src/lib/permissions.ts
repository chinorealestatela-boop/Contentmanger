// Role-based permission architecture. Roles are stored in the database
// (see `Role` model) so new roles can be added later without a schema
// change — each role just needs a JSON permissions blob shaped like this.

export type Permissions = {
  viewAllCustomers: boolean; // manager/admin see the whole team's book, not just their own
  manageTeam: boolean; // assign leads, view team performance
  manageUsers: boolean; // create/deactivate users, change roles
  manageSettings: boolean; // pipeline stages, lead sources, lost reasons, automations, sequences
  manageInventory: boolean;
  viewReports: "own" | "team" | "all";
};

export const DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  SALESPERSON: {
    viewAllCustomers: false,
    manageTeam: false,
    manageUsers: false,
    manageSettings: false,
    manageInventory: true,
    viewReports: "own",
  },
  MANAGER: {
    viewAllCustomers: true,
    manageTeam: true,
    manageUsers: false,
    manageSettings: true,
    manageInventory: true,
    viewReports: "team",
  },
  ADMIN: {
    viewAllCustomers: true,
    manageTeam: true,
    manageUsers: true,
    manageSettings: true,
    manageInventory: true,
    viewReports: "all",
  },
};

export function parsePermissions(json: string): Permissions {
  try {
    return JSON.parse(json) as Permissions;
  } catch {
    return DEFAULT_PERMISSIONS.SALESPERSON;
  }
}
