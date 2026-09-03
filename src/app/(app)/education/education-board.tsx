"use client";

import Link from "next/link";
import { formatIst } from "@/lib/time";
import type { EducationPipelineStage } from "@/modules/education/types";
import type { LeadRow } from "@/modules/leads/types";

type Item = LeadRow & {
  education: {
    studentName: string | null;
    parentName: string | null;
    targetClass: string | null;
    preferredCampus: string | null;
    admissionStatus: string | null;
    counsellingDate: string | null;
  } | null;
  latestVisit: {
    id: string;
    scheduledAt: string | null;
    completedAt: string | null;
    campus: string | null;
  } | null;
};

type Kpis = {
  leads: number;
  campusScheduled: number;
  campusCompleted: number;
  counselling: number;
  applications: number;
  admissions: number;
};

export function EducationBoard({
  pipeline,
  kpis,
  items,
  filters,
}: {
  pipeline: EducationPipelineStage[];
  kpis: Kpis;
  items: Item[];
  filters: { q: string; statusKey: string; visit: string };
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admissions</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Education</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Education leads, counselling, campus visits, and admission status for Social72 school campaigns.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={kpis.leads} />
        <Kpi label="Counselling" value={kpis.counselling} />
        <Kpi label="Visits scheduled" value={kpis.campusScheduled} />
        <Kpi label="Visits done" value={kpis.campusCompleted} />
        <Kpi label="Applications" value={kpis.applications} />
        <Kpi label="Admissions" value={kpis.admissions} />
      </dl>

      <form className="mt-6 flex flex-wrap gap-2" action="/education">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Student, parent, mobile, ID"
          className="h-10 min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 text-sm"
        />
        <select
          name="visit"
          defaultValue={filters.visit}
          className="h-10 rounded-md border border-line bg-white px-3 text-sm"
        >
          <option value="">All visits</option>
          <option value="scheduled">Visit scheduled</option>
          <option value="completed">Visit completed</option>
          <option value="none">No visit</option>
        </select>
        {filters.statusKey ? <input type="hidden" name="statusKey" value={filters.statusKey} /> : null}
        <button type="submit" className="h-10 rounded-md bg-ink px-4 text-sm text-white">
          Filter
        </button>
        {filters.q || filters.visit || filters.statusKey ? (
          <Link href="/education" className="flex h-10 items-center px-3 text-sm text-ink-soft">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <StageChip href="/education" label="All" count={kpis.leads} active={!filters.statusKey} />
        {pipeline.map((stage) => (
          <StageChip
            key={stage.id}
            href={`/education?statusKey=${stage.statusKey}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}${filters.visit ? `&visit=${filters.visit}` : ""}`}
            label={stage.name}
            count={stage.count}
            active={filters.statusKey === stage.statusKey}
          />
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Class / campus</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Visit</th>
              <th className="px-4 py-3 font-medium">Admission</th>
              <th className="px-4 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={6}>
                  No education leads in this view.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${item.id}`} className="font-medium hover:underline">
                      {item.education?.studentName || item.fullName}
                    </Link>
                    <p className="text-xs text-ink-soft">
                      {item.education?.parentName ? `Parent: ${item.education.parentName} · ` : ""}
                      {item.mobileE164}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {item.education?.targetClass ?? "—"}
                    <p className="text-xs">{item.education?.preferredCampus ?? item.client.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: item.status.color }} />
                      {item.status.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {item.latestVisit
                      ? `${item.latestVisit.completedAt ? "Done" : "Set"} · ${formatIst(item.latestVisit.scheduledAt)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{item.education?.admissionStatus ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {item.assignedUser?.name ?? "Unassigned"}
                    <p className="text-xs">
                      <Link href={`/calling?leadId=${item.id}`} className="text-copper hover:underline">
                        Call
                      </Link>
                    </p>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-3">
      <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{label}</dt>
      <dd className="mt-1 font-display text-2xl text-ink">{value}</dd>
    </div>
  );
}

function StageChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`rounded-md px-2.5 py-1 text-xs ${
        active ? "bg-ink text-white" : "border border-line bg-white text-ink"
      }`}
    >
      {label} {count}
    </Link>
  );
}
