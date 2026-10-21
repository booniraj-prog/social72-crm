import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { listVendors } from "@/modules/platform/service";
import { SimpleBoard } from "@/components/platform/simple-board";

export default async function VendorsPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const rows = await listVendors();
  return (
    <SimpleBoard
      eyebrow="Finance"
      title="Vendors"
      summary="Supplier directory for Social72 purchase orders. Existing campaign spend stays on Campaigns."
      kind="vendor"
      columns={["name", "gstin", "phone", "category", "purchases"]}
      rows={rows.map((r) => ({
        id: r.id,
        name: r.name,
        gstin: r.gstin ?? "—",
        phone: r.phone ?? "—",
        category: r.category ?? "—",
        purchases: r._count.purchases,
      }))}
      fields={[
        { name: "name", label: "Vendor", required: true },
        { name: "contactName", label: "Contact" },
        { name: "phone", label: "Phone" },
        { name: "email", label: "Email", type: "email" },
        { name: "gstin", label: "GSTIN" },
        { name: "category", label: "Category" },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
