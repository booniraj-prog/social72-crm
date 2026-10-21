import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listClients } from "@/modules/clients/service";
import { listDocuments, listEngagements, listInvoices, projectEconomics } from "@/modules/platform/service";
import { listClientOrders } from "@/modules/resources/service";
import { BILLING_MODELS, ENGAGEMENT_STATUSES, PROJECT_TYPES, SERVICE_LINES } from "@/modules/platform/constants";
import { formatInr } from "@/lib/money";
import { SimpleBoard } from "@/components/platform/simple-board";
import { ApprovalQueue } from "@/components/platform/approval-queue";
import { AttachmentsPanel } from "@/components/platform/attachments-panel";
import { canApprove } from "@/lib/approvals";
import { canDeleteRecords } from "@/lib/rbac";

export default async function EngagementsPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [rows, clients, economics, approver, files, invoices, orders] = await Promise.all([
    listEngagements(),
    listClients(),
    projectEconomics(),
    canApprove(actor, "project"),
    listDocuments(),
    listInvoices(),
    listClientOrders(),
  ]);
  const byId = Object.fromEntries(economics.map((e) => [e.id, e]));
  const pending = rows.filter((r) => r.approvalStatus === "PENDING");
  return (
    <div>
      {approver ? (
        <ApprovalQueue
          title="Projects awaiting approval"
          kind="engagement-decide"
          items={pending.map((r) => ({ id: r.id, title: r.name, meta: r.client.name }))}
        />
      ) : pending.length ? (
        <p className="mb-4 text-sm text-ink-soft">{pending.length} project(s) waiting for approval.</p>
      ) : null}
      <SimpleBoard
      eyebrow="Projects"
      title="Projects"
      summary="Onboard a project under a client. Estimate people, ads, tools and other cost before you approve. Margin below 25% is flagged."
      kind="engagement"
      lifecycleEntity="engagement"
      columns={["name", "client", "status", "budget", "cost", "gross", "net"]}
      rows={rows.map((r) => {
        const e = byId[r.id];
        const status =
          r.approvalStatus === "PENDING"
            ? "Pending approval"
            : r.approvalStatus === "REJECTED"
              ? "Rejected"
              : r.status;
        return {
          id: r.id,
          name: r.name,
          client: r.client.name,
          status: r.isActive === false ? `${status} · Paused` : status,
          isActive: r.isActive,
          budget: `₹${formatInr(e?.budget ?? r.budget)}`,
          cost: `₹${formatInr(e?.actualAll ?? r.cost ?? 0)}`,
          gross: e ? `₹${formatInr(e.gross)} (${e.grossPct}%)` : "—",
          net: e ? `₹${formatInr(e.net)} (${e.netPct}%)` : "—",
        };
      })}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "clientId", label: "Client", required: true, options: clients.map((c) => ({ value: c.id, label: c.name })) },
        { name: "projectType", label: "Project type", options: PROJECT_TYPES.map((s) => ({ value: s, label: s })) },
        { name: "serviceLine", label: "Service line", options: SERVICE_LINES.map((s) => ({ value: s, label: s })) },
        { name: "billingModel", label: "Billing model", options: BILLING_MODELS.map((s) => ({ value: s, label: s })) },
        { name: "status", label: "Status", options: ENGAGEMENT_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "budget", label: "Revenue / budget", type: "number" },
        { name: "poValue", label: "PO value", type: "number" },
        { name: "estimatedPeople", label: "Est. people cost", type: "number" },
        { name: "estimatedAds", label: "Est. ads / media", type: "number" },
        { name: "estimatedTools", label: "Est. tools", type: "number" },
        { name: "estimatedOther", label: "Est. other cost", type: "number" },
        { name: "dueDate", label: "Due", type: "date" },
      ]}
    />
      <AttachmentsPanel
        compact
        title="Project attachments"
        canDelete={canDeleteRecords(actor)}
        files={files.filter((f) => f.engagementId)}
        clients={clients.map((c) => ({ value: c.id, label: c.name }))}
        projects={rows.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` }))}
        invoices={invoices.filter((i) => i.kind !== "QUOTE").map((i) => ({ value: i.id, label: `${i.number} · ${i.client.name}` }))}
        orders={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.client ?? "PO"}` }))}
      />
    </div>
  );
}
