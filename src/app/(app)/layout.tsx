import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthUser } from "@/lib/session";
import { listNotifications, unreadCount } from "@/modules/ops/service";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const [unread, items] = await Promise.all([unreadCount(user.id), listNotifications(user.id)]);

  return (
    <AppShell
      user={user}
      unreadCount={unread}
      notifications={items.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        leadId: n.leadId,
        leadName: n.lead?.fullName ?? null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      }))}
    >
      {children}
    </AppShell>
  );
}
