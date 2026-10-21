import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { hasPermission, canDeleteRecords } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { HttpError } from "@/lib/session";
import { formatInr } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { getCustomer360 } from "@/modules/platform/service";
import { ContactsPanel } from "../contacts-panel";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";

export default async function Customer360Page({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "client.read")) redirect("/dashboard");
  const { id } = await params;
  try {
    const client = await getCustomer360(id);
    const r = client.review;
    const overdueInvoices = client.invoices.filter((i) => i.payment === "Overdue");
    return (
      <div>
        <Link href="/clients" className="text-xs text-ink-soft hover:text-ink">
          ← Clients
        </Link>
        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-soft">Account review</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-ink">{client.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {client.industry?.name ?? "No industry"}
              {client.contactName ? ` · ${client.contactName}` : ""}
              {client.contactPhone ? ` · ${client.contactPhone}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Jump href={`/campaigns?clientId=${client.id}`} label="Campaigns" />
            <Jump href={`/leads?clientId=${client.id}&import=1`} label="Upload CSV" />
            <Jump href={`/leads?clientId=${client.id}`} label="Leads" />
            <Jump href={`/calling?clientId=${client.id}`} label="Calling" />
            <Jump href={`/follow-ups?clientId=${client.id}&bucket=today`} label="Follow-ups" />
            <Jump href="/engagements" label="Projects" />
            <Jump href="/orders" label="POs" />
            <Jump href="/invoices" label="Invoices" />
            <Jump href="/profit" label="Profit" />
          </div>
        </div>

        <p className="mt-5 text-[10px] uppercase tracking-[0.14em] text-ink-soft">
          This month · {formatIstDate(client.month.from)} – {formatIstDate(client.month.to)}
        </p>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Leads in" value={r.monthLeads} hint={`${r.leads} lifetime`} href={`/leads?clientId=${client.id}`} />
          <Stat label="Ad spend" value={`₹${formatInr(r.monthAdSpend)}`} hint={`CPL ₹${formatInr(r.monthCpl)}`} href={`/campaigns?clientId=${client.id}`} />
          <Stat
            label="Calling"
            value={r.monthCalls}
            hint={`${r.monthConnected} connected · ${r.monthWon} won`}
            href={`/calling?clientId=${client.id}`}
          />
          <Stat
            label="Floor pressure"
            value={r.firstCallLate + r.overdueFollowups + r.unassigned}
            hint={`${r.firstCallLate} late first call · ${r.overdueFollowups} overdue follow-up · ${r.inNurture} nurture`}
            warn={r.firstCallLate + r.overdueFollowups + r.unassigned > 0}
            href={`/follow-ups?clientId=${client.id}&bucket=overdue`}
          />
        </dl>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Collected" value={`₹${formatInr(client.collected)}`} />
          <Stat label="Outstanding" value={`₹${formatInr(client.outstanding)}`} warn={client.outstanding > 1} href="/invoices" />
          <Stat
            label="PO vs billed"
            value={r.billedVsPo == null ? "—" : `${r.billedVsPo}%`}
            hint={r.poValue ? `₹${formatInr(r.poRemaining)} left on PO` : "No client PO"}
            href="/orders"
          />
          <Stat label="Total cost" value={`₹${formatInr(client.cost)}`} hint={`Ads ₹${formatInr(r.adSpend)} · ops ₹${formatInr(r.opsCost)}`} />
          <Stat
            label="Social72 profit"
            value={`₹${formatInr(client.profit)}`}
            hint="Collected minus ads and ops cost"
            tone={client.profit >= 0 ? "pine" : "danger"}
            href="/profit"
          />
        </dl>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <Panel
            title="Ad campaigns"
            action={
              <Link href={`/campaigns?clientId=${client.id}`} className="text-xs text-copper">
                Open
              </Link>
            }
          >
            {client.campaigns.length === 0 ? (
              <p className="text-sm text-ink-soft">No campaigns on this client.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase text-ink-soft">
                    <th className="pb-2 font-medium">Campaign</th>
                    <th className="pb-2 font-medium">Spend</th>
                    <th className="pb-2 font-medium">Leads</th>
                    <th className="pb-2 font-medium">CPL</th>
                    <th className="pb-2 font-medium">Won</th>
                  </tr>
                </thead>
                <tbody>
                  {client.campaigns.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="py-2">
                        <Link href={`/campaigns/${c.id}`} className="text-copper underline">
                          {c.name}
                        </Link>
                        <p className="text-xs text-ink-soft">
                          {c.platform ?? "—"} · {c.owner}
                          {c.isActive ? "" : " · paused"}
                        </p>
                      </td>
                      <td className="py-2">
                        ₹{formatInr(c.spend)}
                        <p className="text-xs text-ink-soft">of ₹{formatInr(c.budget)}</p>
                      </td>
                      <td className="py-2">{c.leads}</td>
                      <td className="py-2">₹{formatInr(c.cpl)}</td>
                      <td className="py-2">
                        {c.won}
                        <p className="text-xs text-ink-soft">{c.conversionRate}%</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            title="Leads & calling"
            action={
              <Link href={`/leads?clientId=${client.id}&import=1`} className="text-xs text-copper">
                Upload CSV
              </Link>
            }
          >
            {client.leads.length === 0 ? (
              <p className="text-sm text-ink-soft">No leads yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {client.leads.map((l) => (
                  <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 last:border-0">
                    <div>
                      <Link className="text-copper underline" href={`/leads/${l.id}`}>
                        {l.fullName}
                      </Link>
                      <p className="text-xs text-ink-soft">
                        {l.leadNumber} · {l.status.name} · {l.assignedUser?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <p className="text-xs text-ink-soft">
                      {l.nextFollowupAt ? `Next ${formatIstDate(l.nextFollowupAt)}` : "No follow-up"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Projects" action={<Link href="/engagements" className="text-xs text-copper">Open</Link>}>
            {client.engagements.length === 0 ? (
              <p className="text-sm text-ink-soft">No projects yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {client.engagements.map((e) => (
                  <li key={e.id}>
                    {e.name} · {e.status}
                    <p className="text-xs text-ink-soft">
                      Budget ₹{formatInr(e.budget)} · billed ₹{formatInr(e.billed)}
                      {e.dueDate ? ` · due ${formatIstDate(e.dueDate)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Cash" action={<Link href="/invoices" className="text-xs text-copper">Invoices</Link>}>
            <p className="text-xs text-ink-soft">
              {overdueInvoices.length} overdue invoice{overdueInvoices.length === 1 ? "" : "s"}
            </p>
            {client.orders.length === 0 && client.invoices.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">No POs or invoices.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {client.orders.map((o) => (
                  <li key={o.id}>
                    PO {o.number} · {o.status} · ₹{formatInr(o.value)}
                    <p className="text-xs text-ink-soft">
                      Remaining ₹{formatInr(o.remaining)}
                      {o.project ? ` · ${o.project}` : ""}
                      {o.followUp && o.followUp !== "—" ? ` · follow-up ${o.followUp}` : ""}
                    </p>
                  </li>
                ))}
                {client.invoices.map((i) => (
                  <li key={i.id}>
                    <Link className="text-copper underline" href={`/invoices/${i.id}`}>
                      {i.number}
                    </Link>{" "}
                    · {i.payment} · ₹{formatInr(i.outstanding)} due
                    {i.project && i.project !== "—" ? <span className="text-ink-soft"> · {i.project}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <ContactsPanel clientId={client.id} contacts={client.contacts} />
          <AttachmentsPanel
            compact
            title="Documents"
            canDelete={canDeleteRecords(actor)}
            defaults={{ clientId: client.id }}
            files={client.files.map((f) => ({
              id: f.id,
              filename: f.filename,
              kind: f.kind,
              url: f.url,
              client: f.client,
              project: f.project,
              invoice: "invoice" in f && typeof f.invoice === "string" ? f.invoice : "—",
              po: "po" in f && typeof f.po === "string" ? f.po : "—",
              followUp: f.followUp,
              createdAt: f.createdAt,
              clientId: "clientId" in f ? (f.clientId as string | null) : client.id,
              engagementId: "engagementId" in f ? (f.engagementId as string | null) : null,
              invoiceId: "invoiceId" in f ? (f.invoiceId as string | null) : null,
              clientOrderId: "clientOrderId" in f ? (f.clientOrderId as string | null) : null,
            }))}
            clients={[{ value: client.id, label: client.name }]}
            projects={client.engagements.map((e) => ({ value: e.id, label: e.name }))}
            invoices={client.invoices.map((i) => ({ value: i.id, label: i.number }))}
            orders={client.orders.map((o) => ({ value: o.id, label: o.number }))}
          />
          <Panel title="Licenses">
            {client.licenses.length === 0 ? (
              <p className="text-sm text-ink-soft">No linked tools.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {client.licenses.map((l) => (
                  <li key={l.id}>
                    {l.name} · {l.expiryDate ? l.expiryDate.slice(0, 10) : "no expiry"}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
}

function Jump({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex h-8 items-center rounded-md border border-line bg-white px-3 text-ink hover:bg-paper">
      {label}
    </Link>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
  warn,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  warn?: boolean;
  tone?: "pine" | "danger";
}) {
  const inner = (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === "pine"
          ? "border-pine bg-pine text-white"
          : tone === "danger" || warn
            ? "border-danger/30 bg-white"
            : "border-line bg-white"
      }`}
    >
      <p className={`text-[11px] uppercase tracking-[0.14em] ${tone === "pine" ? "text-white/70" : "text-ink-soft"}`}>
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl ${tone === "pine" ? "text-white" : warn || tone === "danger" ? "text-danger" : "text-ink"}`}>
        {value}
      </p>
      {hint ? (
        <p className={`mt-1 text-xs ${tone === "pine" ? "text-white/70" : "text-ink-soft"}`}>{hint}</p>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
