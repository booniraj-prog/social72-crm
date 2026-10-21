import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listLeaves } from "@/modules/platform/service";
import { SimpleBoard } from "@/components/platform/simple-board";

export default async function LeavesPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const rows = await listLeaves(actor);
  return (
    <SimpleBoard
      eyebrow="People"
      title="Leave"
      summary="Employees request leave here. Attendance can be marked as present, WFH, absent or leave."
      kind="leave"
      kpis={[
        { label: "Requests", value: rows.length },
        { label: "Pending", value: rows.filter((r) => r.status === "PENDING").length },
      ]}
      columns={["user", "type", "fromDate", "toDate", "status"]}
      rows={rows.map((r) => ({
        id: r.id,
        user: r.user.name,
        type: r.type,
        fromDate: r.fromDate.slice(0, 10),
        toDate: r.toDate.slice(0, 10),
        status: r.status,
      }))}
      fields={[
        {
          name: "type",
          label: "Type",
          options: ["CASUAL", "SICK", "EARNED", "UNPAID"].map((s) => ({ value: s, label: s })),
        },
        { name: "fromDate", label: "From", type: "date", required: true },
        { name: "toDate", label: "To", type: "date", required: true },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
