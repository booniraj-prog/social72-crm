import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/session";

export default async function DashboardPage() {
  const user = await getAuthUser();
  const [userCount, clientCount, activeClients] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.client.count({ where: { isActive: true } }),
  ]);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Today</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Foundation</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
        Signed in as {user?.name}. Phase 1 is identity, clients, and navigation.
        Lead working, calling, and dashboards arrive in later phases.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Users" value={String(userCount)} />
        <Stat label="Clients" value={String(clientCount)} />
        <Stat label="Active clients" value={String(activeClients)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white px-5 py-4">
      <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
