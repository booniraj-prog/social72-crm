export const ROLE_KEYS = [
  "super_admin",
  "crm_manager",
  "bpo_leader",
  "bpo_executive",
  "marketing_manager",
  "client",
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
  phase: number;
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", roles: "*", phase: 1 },
      { href: "/leads", label: "Leads", roles: "*", phase: 2 },
      { href: "/calling", label: "Calling", roles: ["bpo_executive", "bpo_leader", "crm_manager"], phase: 3 },
      { href: "/follow-ups", label: "Follow-ups", roles: ["bpo_executive", "bpo_leader", "crm_manager"], phase: 3 },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/campaigns", label: "Campaigns", roles: ["marketing_manager", "crm_manager"], phase: 6 },
      { href: "/clients", label: "Clients", roles: ["crm_manager", "marketing_manager"], phase: 1 },
    ],
  },
  {
    title: "Performance",
    items: [
      { href: "/reports", label: "Reports", roles: ["crm_manager", "marketing_manager", "bpo_leader"], phase: 8 },
      { href: "/bpo", label: "BPO Performance", roles: ["crm_manager", "bpo_leader", "bpo_executive"], phase: 3 },
      { href: "/education", label: "Education", roles: ["crm_manager", "bpo_leader", "bpo_executive", "marketing_manager"], phase: 4 },
      { href: "/real-estate", label: "Real Estate", roles: ["crm_manager", "bpo_leader", "bpo_executive", "marketing_manager"], phase: 5 },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/users", label: "Users", roles: ["super_admin"], phase: 1 },
      { href: "/settings", label: "Settings", roles: ["super_admin"], phase: 1 },
    ],
  },
];

export function canSeeNav(user: AuthUser, item: NavItem) {
  if (item.roles === "*") return true;
  return hasAnyRole(user, item.roles);
}
