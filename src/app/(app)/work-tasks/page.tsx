import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listWorkTasks } from "@/modules/platform/service";
import { PRIORITIES, TASK_STATUSES } from "@/modules/platform/constants";
import { SimpleBoard } from "@/components/platform/simple-board";

export default async function WorkTasksPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const rows = await listWorkTasks(actor);
  const overdue = rows.filter((r) => r.dueAt && !r.completedAt && new Date(r.dueAt) < new Date()).length;
  return (
    <SimpleBoard
      eyebrow="Projects"
      title="Tasks"
      summary="Monitor work assigned to you across leads and projects. Complete or follow up from this list."
      kind="task"
      kpis={[
        { label: "Open", value: rows.filter((r) => r.status !== "DONE").length },
        { label: "Overdue", value: overdue },
        { label: "Done", value: rows.filter((r) => r.status === "DONE").length },
      ]}
      columns={["title", "status", "priority", "assignee", "dueAt"]}
      rows={rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        assignee: r.assignee?.name ?? "—",
        dueAt: r.dueAt ? r.dueAt.slice(0, 10) : "—",
      }))}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "description", label: "Notes" },
        { name: "status", label: "Status", options: TASK_STATUSES.map((s) => ({ value: s, label: s })) },
        { name: "priority", label: "Priority", options: PRIORITIES.map((s) => ({ value: s, label: s })) },
        { name: "dueAt", label: "Due", type: "datetime-local" },
      ]}
    />
  );
}
