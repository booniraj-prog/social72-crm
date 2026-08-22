"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { canSeeNav, NAV_GROUPS, type AuthUser } from "@/lib/rbac";
import { cn } from "@/lib/cn";

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col bg-sidebar text-[#d8cfc3]">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-display text-xl tracking-tight text-[#f4efe6]">Social72</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#8d8072]">
            Lead operations
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => canSeeNav(user, item));
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="mb-5">
                <p className="px-2 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[#8d8072]">
                  {group.title}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center justify-between rounded-md px-2 py-1.5 text-[13px]",
                            active
                              ? "bg-white/10 text-[#f4efe6]"
                              : "text-[#c4b8a8] hover:bg-white/5 hover:text-[#f4efe6]",
                          )}
                        >
                          {item.label}
                          {item.phase > 3 ? (
                            <span className="text-[10px] text-[#8d8072]">P{item.phase}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <form
          action="/leads"
          className="border-t border-white/10 px-3 py-3"
        >
          <input
            name="q"
            placeholder="Search name, mobile, ID"
            className="h-8 w-full rounded-md border-0 bg-white/10 px-2 text-xs text-[#f4efe6] outline-none placeholder:text-[#8d8072]"
          />
        </form>
        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm text-[#f4efe6]">{user.name}</p>
          <p className="truncate text-xs text-[#8d8072]">{user.roleName}</p>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 text-xs text-[#c4b8a8] hover:text-[#f4efe6]"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
