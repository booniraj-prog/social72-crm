"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { canAccessPath, navGroupsForUser, ROLE_DESK, type AuthUser } from "@/lib/rbac";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { QuickActions } from "@/components/layout/quick-actions";
import { Social72Logo } from "@/components/brand/social72-logo";
import { NAV_ICONS } from "@/components/ui/icons";
import { ActionIcon } from "@/components/ui/action-icon";

export function AppShell({
  user,
  unreadCount,
  notifications,
  children,
}: {
  user: AuthUser;
  unreadCount: number;
  notifications: Array<{
    id: string;
    title: string;
    body: string | null;
    leadId: string | null;
    leadName: string | null;
    readAt: string | null;
    createdAt: string;
    emailTo?: string | null;
    phoneTo?: string | null;
  }>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canAccessPath(user, pathname)) router.replace("/today");
  }, [pathname, router, user]);

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  const groups = navGroupsForUser(user);
  const desk = ROLE_DESK[user.roleKey] ?? user.roleName;

  const nav = (
    <>
      {groups.map((group) => (
        <div key={group.title} className="mb-5">
          <p className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-muted">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = NAV_ICONS[item.href];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                      active
                        ? "bg-copper text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]"
                        : "text-[#d5e0e4] hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.9} /> : null}
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col bg-sidebar text-[#d5e0e4] print:hidden lg:flex">
        <div className="border-b border-white/10 px-4 py-4">
          <Social72Logo onDark className="h-6" />
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.16em] text-sidebar-muted">{desk}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">{nav}</nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-sm text-white">{user.name}</p>
          <p className="truncate text-xs text-sidebar-muted">{user.roleName}</p>
          <ActionIcon action="logout" className="mt-3 text-sidebar-muted hover:text-white" onClick={signOut} />
        </div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-ink/50" type="button" onClick={() => setOpen(false)} />
          <aside className="relative z-10 flex h-full w-[248px] flex-col bg-sidebar p-4">
            <div className="mb-4">
              <Social72Logo onDark className="h-6" />
            </div>
            <nav className="flex-1 overflow-y-auto">{nav}</nav>
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-4 backdrop-blur print:hidden lg:px-6">
          <button
            type="button"
            className="action-icon action-icon-preview lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            title="Open menu"
            data-tooltip="Open menu"
          >
            <Menu className="h-4 w-4" strokeWidth={1.9} />
          </button>
          <div className="lg:hidden">
            <Social72Logo className="h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <QuickActions />
          <NotificationBell initialUnread={unreadCount} initialItems={notifications} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
