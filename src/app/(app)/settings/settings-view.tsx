import { prisma } from "@/lib/db";

export default async function SettingsView() {
  const [statusCount, dispositionCount, slaCount] = await Promise.all([
    prisma.leadStatus.count(),
    prisma.disposition.count(),
    prisma.slaRule.count(),
  ]);

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Settings</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
        Workflow configuration is seeded and will be editable here in a later
        phase. Statuses, dispositions, scoring, and SLA rules already exist in
        the database.
      </p>
      <dl className="mt-8 grid max-w-xl gap-3 text-sm">
        <Row label="Lead statuses" value={statusCount} />
        <Row label="Call dispositions" value={dispositionCount} />
        <Row label="SLA rules" value={slaCount} />
        <Row label="Timezone" value="Asia/Kolkata" />
        <Row label="Currency" value="INR" />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-line bg-white px-4 py-3">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
