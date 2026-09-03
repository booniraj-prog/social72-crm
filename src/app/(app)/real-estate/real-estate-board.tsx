"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatIst } from "@/lib/time";
import { CONFIGURATIONS, PROPERTY_TYPES } from "@/modules/real-estate/types";
import type { LeadRow } from "@/modules/leads/types";

type Item = LeadRow & {
  realEstate: {
    configuration: string | null;
    preferredLocation: string | null;
    registrationStatus: string | null;
    project: { name: string } | null;
    property: { name: string } | null;
  } | null;
  latestVisit: { scheduledAt: string | null; completedAt: string | null } | null;
};

type Stage = { id: string; name: string; statusKey: string; count: number };

type Inventory = {
  projects: Array<{ id: string; name: string; location: string | null; clientName: string; clientId: string }>;
  properties: Array<{
    id: string;
    name: string;
    configuration: string | null;
    location: string | null;
    value: number | null;
    projectName: string | null;
    clientName: string;
    clientId: string;
    projectId: string | null;
  }>;
};

type Kpis = {
  leads: number;
  visitsScheduled: number;
  visitsDone: number;
  bookings: number;
  registrations: number;
  properties: number;
};

export function RealEstateBoard({
  pipeline,
  kpis,
  items,
  inventory,
  filters,
  clients,
  canManageInventory,
}: {
  pipeline: Stage[];
  kpis: Kpis;
  items: Item[];
  inventory: Inventory;
  filters: { q: string; statusKey: string; visit: string };
  clients: Array<{ id: string; name: string }>;
  canManageInventory: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");

  async function create(path: string, body: unknown) {
    setError("");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error?.message ?? "Could not save inventory");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Sales</p>
      <h1 className="mt-2 font-display text-4xl text-ink">Real estate</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-soft">
        Projects, properties, site visits, booking, and registration for Social72 developer campaigns.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Leads" value={kpis.leads} />
        <Kpi label="Visits set" value={kpis.visitsScheduled} />
        <Kpi label="Visits done" value={kpis.visitsDone} />
        <Kpi label="Bookings" value={kpis.bookings} />
        <Kpi label="Registrations" value={kpis.registrations} />
        <Kpi label="Units" value={kpis.properties} />
      </dl>

      <form className="mt-6 flex flex-wrap gap-2" action="/real-estate">
        <input
          name="q"
          defaultValue={filters.q}
          placeholder="Name, mobile, property"
          className="h-10 min-w-[220px] flex-1 rounded-md border border-line bg-white px-3 text-sm"
        />
        <select name="visit" defaultValue={filters.visit} className="h-10 rounded-md border border-line bg-white px-3 text-sm">
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
          <Link href="/real-estate" className="flex h-10 items-center px-3 text-sm text-ink-soft">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <StageChip href="/real-estate" label="All" count={kpis.leads} active={!filters.statusKey} />
        {pipeline.map((stage) => (
          <StageChip
            key={stage.id}
            href={`/real-estate?statusKey=${stage.statusKey}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}${filters.visit ? `&visit=${filters.visit}` : ""}`}
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
              <th className="px-4 py-3 font-medium">Buyer</th>
              <th className="px-4 py-3 font-medium">Property</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Visit</th>
              <th className="px-4 py-3 font-medium">Registration</th>
              <th className="px-4 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={6}>
                  No real estate leads in this view.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-line hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${item.id}`} className="font-medium hover:underline">
                      {item.fullName}
                    </Link>
                    <p className="text-xs text-ink-soft">{item.mobileE164}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {item.realEstate?.property?.name ?? item.realEstate?.project?.name ?? "—"}
                    <p className="text-xs">
                      {item.realEstate?.configuration ?? "—"}
                      {item.realEstate?.preferredLocation ? ` · ${item.realEstate.preferredLocation}` : ""}
                    </p>
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
                  <td className="px-4 py-3 text-ink-soft">{item.realEstate?.registrationStatus ?? "—"}</td>
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

      <h2 className="mt-10 font-display text-2xl text-ink">Inventory</h2>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {canManageInventory ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <form
            className="rounded-lg border border-line bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void create("/api/real-estate/projects", {
                clientId: String(data.get("clientId") ?? ""),
                name: String(data.get("name") ?? ""),
                location: String(data.get("location") ?? ""),
              });
              e.currentTarget.reset();
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">New project</p>
            <div className="mt-3 grid gap-2">
              <select name="clientId" required className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input name="name" required placeholder="Project name" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="location" placeholder="Location" className="h-10 rounded-md border border-line px-3 text-sm" />
              <button type="submit" className="h-9 rounded-md bg-ink text-sm text-white">
                Add project
              </button>
            </div>
          </form>
          <form
            className="rounded-lg border border-line bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void create("/api/real-estate/properties", {
                clientId: String(data.get("clientId") ?? ""),
                projectId: String(data.get("projectId") ?? ""),
                name: String(data.get("name") ?? ""),
                propertyType: String(data.get("propertyType") ?? ""),
                configuration: String(data.get("configuration") ?? ""),
                location: String(data.get("location") ?? ""),
                value: String(data.get("value") ?? ""),
              });
              e.currentTarget.reset();
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">New unit</p>
            <div className="mt-3 grid gap-2">
              <select name="clientId" required className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select name="projectId" className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Project (optional)</option>
                {inventory.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input name="name" required placeholder="Unit name" className="h-10 rounded-md border border-line px-3 text-sm" />
              <select name="propertyType" className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Type</option>
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select name="configuration" className="h-10 rounded-md border border-line px-3 text-sm">
                <option value="">Configuration</option>
                {CONFIGURATIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <input name="location" placeholder="Location" className="h-10 rounded-md border border-line px-3 text-sm" />
              <input name="value" placeholder="Value" className="h-10 rounded-md border border-line px-3 text-sm" />
              <button type="submit" className="h-9 rounded-md bg-ink text-sm text-white">
                Add unit
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper-2 text-xs uppercase tracking-[0.12em] text-ink-soft">
            <tr>
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Config</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {inventory.properties.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-ink-soft" colSpan={5}>
                  No inventory yet.
                </td>
              </tr>
            ) : (
              inventory.properties.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.projectName ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.clientName}</td>
                  <td className="px-4 py-3 text-ink-soft">{row.configuration ?? row.location ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-ink-soft">
                    {row.value != null ? `₹${row.value.toLocaleString("en-IN")}` : "—"}
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
