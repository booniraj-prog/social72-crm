export const ROLE_KEYS = [
  "super_admin",
  "crm_manager",
  "bpo_leader",
  "bpo_executive",
  "marketing_manager",
  "client",
  "sales_manager",
  "project_manager",
  "accounts",
  "hr_admin",
  "employee",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleKey: RoleKey;
  roleName: string;
  permissions: string[];
  isActive: boolean;
  clientId: string | null;
};

export function hasPermission(user: AuthUser, permission: string) {
  if (user.roleKey === "super_admin") return true;
  return user.permissions.includes(permission);
}

export function hasAnyRole(user: AuthUser, roles: RoleKey[]) {
  return user.roleKey === "super_admin" || roles.includes(user.roleKey);
}

export type NavItem = {
  href: string;
  label: string;
  roles: RoleKey[] | "*";
};

export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "My day",
    items: [
      { href: "/today", label: "Today", roles: "*" },
      { href: "/dashboard", label: "Dashboard", roles: "*" },
      {
        href: "/work-tasks",
        label: "My tasks",
        roles: [
          "bpo_executive",
          "bpo_leader",
          "employee",
          "project_manager",
          "crm_manager",
          "sales_manager",
          "hr_admin",
          "marketing_manager",
          "accounts",
        ],
      },
    ],
  },
  {
    title: "Company",
    items: [
      { href: "/clients", label: "Clients", roles: ["crm_manager", "marketing_manager", "sales_manager", "accounts"] },
      { href: "/people", label: "Employees", roles: ["super_admin", "hr_admin", "crm_manager"] },
    ],
  },
  {
    title: "Demand",
    items: [
      {
        href: "/leads",
        label: "Leads",
        roles: ["bpo_executive", "bpo_leader", "sales_manager", "crm_manager", "marketing_manager", "employee", "client"],
      },
      { href: "/calling", label: "Calling", roles: ["bpo_executive", "bpo_leader", "crm_manager", "sales_manager"] },
      { href: "/follow-ups", label: "Follow-ups", roles: ["bpo_executive", "bpo_leader", "crm_manager", "sales_manager"] },
      { href: "/proposals", label: "Proposals", roles: ["crm_manager", "sales_manager", "marketing_manager", "accounts", "project_manager"] },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/campaigns", label: "Ad campaigns", roles: ["marketing_manager", "crm_manager", "client"] },
      { href: "/nurture", label: "Nurture", roles: ["marketing_manager", "crm_manager"] },
    ],
  },
  {
    title: "Projects",
    items: [
      { href: "/engagements", label: "Projects", roles: ["crm_manager", "project_manager", "employee", "accounts"] },
      { href: "/resources", label: "Resources", roles: ["crm_manager", "project_manager", "hr_admin", "accounts"] },
      { href: "/documents", label: "Documents", roles: ["crm_manager", "project_manager", "accounts", "sales_manager"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/invoices", label: "Invoices", roles: ["crm_manager", "accounts", "sales_manager"] },
      { href: "/orders", label: "Client POs", roles: ["crm_manager", "accounts", "sales_manager", "project_manager"] },
      {
        href: "/spend",
        label: "Spend",
        roles: [
          "accounts",
          "hr_admin",
          "employee",
          "project_manager",
          "crm_manager",
          "sales_manager",
          "bpo_leader",
          "bpo_executive",
        ],
      },
      { href: "/profit", label: "Social72 profit", roles: ["crm_manager", "accounts", "sales_manager"] },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        href: "/reports",
        label: "Reports",
        roles: ["crm_manager", "marketing_manager", "bpo_leader", "sales_manager", "accounts", "project_manager", "client"],
      },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/trash", label: "Trash", roles: ["super_admin", "crm_manager", "accounts", "hr_admin"] },
      { href: "/settings", label: "Settings", roles: ["super_admin"] },
    ],
  },
];

const DESK_ORDER: Record<RoleKey, string[]> = {
  bpo_executive: ["My day", "Demand", "Finance"],
  bpo_leader: ["My day", "Demand", "Insights", "Finance"],
  sales_manager: ["My day", "Demand", "Company", "Finance", "Insights"],
  marketing_manager: ["My day", "Marketing", "Demand", "Company", "Insights"],
  project_manager: ["My day", "Projects", "Finance", "Insights"],
  accounts: ["My day", "Finance", "Company", "Projects", "Demand", "Insights", "Admin"],
  hr_admin: ["My day", "Company", "Projects", "Finance", "Admin"],
  employee: ["My day", "Projects", "Demand", "Finance"],
  client: ["My day", "Marketing", "Demand", "Insights"],
  crm_manager: ["My day", "Company", "Demand", "Marketing", "Projects", "Finance", "Insights", "Admin"],
  super_admin: ["My day", "Company", "Demand", "Marketing", "Projects", "Finance", "Insights", "Admin"],
};

export const ROLE_DESK: Record<RoleKey, string> = {
  bpo_executive: "Calling floor",
  bpo_leader: "Calling floor",
  sales_manager: "Sales",
  marketing_manager: "Marketing",
  project_manager: "Projects",
  accounts: "Accounts",
  hr_admin: "People",
  employee: "Projects",
  client: "Client",
  crm_manager: "Business",
  super_admin: "All desks",
};

export function canSeeNav(user: AuthUser, item: NavItem) {
  if (item.roles === "*") return true;
  return hasAnyRole(user, item.roles);
}

export function canApproveSpend(user: AuthUser) {
  return hasAnyRole(user, ["accounts", "crm_manager", "hr_admin"]);
}

export function canApprovePeople(user: AuthUser) {
  return hasAnyRole(user, ["hr_admin", "crm_manager"]);
}

export function canApproveInvoice(user: AuthUser) {
  return hasAnyRole(user, ["accounts", "crm_manager"]);
}

export function canCreateProposal(user: AuthUser) {
  return hasAnyRole(user, ["sales_manager", "crm_manager", "marketing_manager", "accounts", "project_manager"]);
}

export function canTagProposal(user: AuthUser) {
  return hasAnyRole(user, ["sales_manager", "crm_manager", "project_manager"]);
}

export function canDeleteRecords(user: AuthUser) {
  return hasAnyRole(user, ["accounts", "crm_manager", "hr_admin"]);
}

export function canAccessPath(user: AuthUser, pathname: string) {
  const items = NAV_GROUPS.flatMap((group) => group.items);
  const match = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!match) return true;
  return canSeeNav(user, match);
}

export function navGroupsForUser(user: AuthUser): NavGroup[] {
  const preferred = DESK_ORDER[user.roleKey] ?? NAV_GROUPS.map((g) => g.title);
  const byTitle = new Map(NAV_GROUPS.map((g) => [g.title, g]));
  const titles = [...preferred];
  for (const group of NAV_GROUPS) {
    if (!titles.includes(group.title)) titles.push(group.title);
  }

  return titles
    .map((title) => byTitle.get(title))
    .filter((group): group is NavGroup => Boolean(group))
    .map((group) => ({
      title: group.title,
      items: group.items.filter((item) => canSeeNav(user, item)),
    }))
    .filter((group) => group.items.length > 0);
}
