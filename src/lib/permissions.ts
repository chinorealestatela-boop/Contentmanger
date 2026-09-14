// Role-based permission architecture. Roles are stored in the database
// (see `Role` model) so new roles can be added later without a schema
// change — each role just needs a JSON permissions blob shaped like this.

export type Permissions = {
  viewAllCustomers: boolean; // manager+ see the whole book, not just their own leads/bookings
  manageTeam: boolean; // assign leads, view team performance
  manageUsers: boolean; // create/deactivate employees, change roles
  manageSettings: boolean; // pipeline stages, lead sources, services, pricing, automations
  manageFleet: boolean; // vehicles, maintenance
  manageDrivers: boolean;
  manageFinance: boolean; // payments, refunds, deposits
  viewReports: "own" | "team" | "all";
  driverView: boolean; // sees the mobile driver console instead of the full CRM by default
};

export const DEFAULT_PERMISSIONS: Record<string, Permissions> = {
  OWNER: {
    viewAllCustomers: true,
    manageTeam: true,
    manageUsers: true,
    manageSettings: true,
    manageFleet: true,
    manageDrivers: true,
    manageFinance: true,
    viewReports: "all",
    driverView: false,
  },
  ADMIN: {
    viewAllCustomers: true,
    manageTeam: true,
    manageUsers: true,
    manageSettings: true,
    manageFleet: true,
    manageDrivers: true,
    manageFinance: true,
    viewReports: "all",
    driverView: false,
  },
  MANAGER: {
    viewAllCustomers: true,
    manageTeam: true,
    manageUsers: false,
    manageSettings: true,
    manageFleet: true,
    manageDrivers: true,
    manageFinance: true,
    viewReports: "team",
    driverView: false,
  },
  DISPATCHER: {
    viewAllCustomers: true,
    manageTeam: false,
    manageUsers: false,
    manageSettings: false,
    manageFleet: true,
    manageDrivers: true,
    manageFinance: false,
    viewReports: "team",
    driverView: false,
  },
  SALES: {
    viewAllCustomers: false,
    manageTeam: false,
    manageUsers: false,
    manageSettings: false,
    manageFleet: false,
    manageDrivers: false,
    manageFinance: false,
    viewReports: "own",
    driverView: false,
  },
  DRIVER: {
    viewAllCustomers: false,
    manageTeam: false,
    manageUsers: false,
    manageSettings: false,
    manageFleet: false,
    manageDrivers: false,
    manageFinance: false,
    viewReports: "own",
    driverView: true,
  },
};

export function parsePermissions(json: string): Permissions {
  try {
    return JSON.parse(json) as Permissions;
  } catch {
    return DEFAULT_PERMISSIONS.SALES;
  }
}
