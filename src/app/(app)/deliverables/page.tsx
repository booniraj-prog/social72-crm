import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listDeliverables, listEngagements } from "@/modules/platform/service";
import { DELIVERABLE_STATUSES, PRIORITIES } from "@/modules/platform/constants";
import { SimpleBoard } from "@/components/platform/simple-board";

export default async function DeliverablesPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [rows, projects] = await Promise.all([listDeliverables(), listEngagements()]);
  return (
    <SimpleBoard
      eyebrow="Projects"
      title="Deliverables"
      summary="Work products on Social72 projects. Track status against the assigned job."
      kind="deliverable"
      canCreate={Boolean(projects[0])}
      kpis={[
        { label: "Open", value: rows.filter((r) => !["COMPLETED", "APPROVED"].includes(r.status)).length },
        { label: "Overdue", value: rows.filter((r) => r.overdue).length },
        { label: "Client review", value: rows.filter((r) => r.status === "SENT_TO_CLIENT").length },
      ]}
      columns={["title", "client", "project", "status", "dueDate", "owner"]}
      rows={rows.map((r) => ({
        id: r.id,
        title: r.title,
        client: r.client,
        project: r.project,
        status: r.status,
        dueDate: r.dueDate ? r.dueDate.slice(0, 10) : "—",
        owner: r.owner,
      }))}
      fields={[
        {
          name: "engagementId",
          label: "Project",
          required: true,
          options: projects.map((p) => ({ value: p.id, label: p.name })),
        },
        { name: "title", label: "Deliverable", required: true },
        { name: "description", label: "Description" },
        { name: "status", label: "Status", options: DELIVERABLE_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "priority", label: "Priority", options: PRIORITIES.map((s) => ({ value: s, label: s })) },
        { name: "dueDate", label: "Due", type: "date" },
      ]}
    />
  );
}
