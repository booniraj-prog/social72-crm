import { redirect } from "next/navigation";
import { canApproveSpend, canDeleteRecords } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { listEngagements, listExpenses, listLicenses, listPurchases } from "@/modules/platform/service";
import { BILLING_CYCLES, EXPENSE_CATEGORIES, LICENSE_CATEGORIES } from "@/modules/platform/constants";
import { SpendBoard } from "./spend-board";

export default async function SpendPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const [expenses, purchases, licenses, projects] = await Promise.all([
    listExpenses(actor),
    listPurchases(),
    listLicenses(),
    listEngagements(),
  ]);
  const projectField = {
    name: "engagementId",
    label: "Project (for costing)",
    options: projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.client.name}` })),
  };
  return (
    <SpendBoard
      actorId={actor.id}
      canApprove={canApproveSpend(actor)}
      canDelete={canDeleteRecords(actor) || canApproveSpend(actor)}
      expenses={expenses.map((r) => ({
        id: r.id,
        category: r.category,
        amount: r.amount,
        status: r.status,
        claimant: r.claimant.name,
        claimantId: r.claimantId,
        spentOn: r.spentOn.slice(0, 10),
        notes: r.notes,
        receiptUrl: r.receiptUrl,
        project: r.project,
        engagementId: r.engagementId,
        history: r.history,
      }))}
      purchases={purchases.map((r) => ({
        id: r.id,
        number: r.number,
        title: r.title,
        vendor: r.vendor?.name ?? "—",
        status: r.status,
        amount: r.amount,
        ownerUserId: r.ownerUserId,
        project: r.project,
        engagementId: r.engagementId,
        notes: r.notes,
        history: r.history,
      }))}
      licenses={licenses.map((r) => ({
        id: r.id,
        name: r.name,
        vendor: r.vendor ?? "—",
        category: r.category ?? "—",
        status: "status" in r && typeof r.status === "string" ? r.status : "APPROVED",
        bucket: r.bucket,
        expiryDate: r.expiryDate ? r.expiryDate.slice(0, 10) : "—",
        amount: r.amount,
        ownerUserId: r.ownerUserId,
        project: r.engagement?.name ?? "—",
        engagementId: r.engagementId,
        notes: r.notes,
        history: r.history,
      }))}
      expenseFields={[
        projectField,
        { name: "category", label: "Category", required: true, options: EXPENSE_CATEGORIES.map((s) => ({ value: s, label: s })) },
        { name: "amount", label: "Amount", type: "number", required: true },
        { name: "spentOn", label: "Date", type: "date", required: true },
        { name: "receiptUrl", label: "Receipt", type: "file", folder: "receipts", preview: true },
        { name: "notes", label: "Notes" },
      ]}
      purchaseFields={[
        projectField,
        { name: "title", label: "Title", required: true },
        { name: "vendorName", label: "Vendor" },
        { name: "amount", label: "Amount", type: "number" },
        { name: "notes", label: "Notes" },
      ]}
      licenseFields={[
        projectField,
        { name: "name", label: "Tool / license", required: true },
        { name: "vendor", label: "Vendor" },
        { name: "category", label: "Category", options: LICENSE_CATEGORIES.map((s) => ({ value: s, label: s })) },
        { name: "licenseKey", label: "Key / reference" },
        { name: "seats", label: "Seats", type: "number" },
        { name: "amount", label: "Amount", type: "number" },
        { name: "billingCycle", label: "Billing", options: BILLING_CYCLES.map((s) => ({ value: s, label: s })) },
        { name: "expiryDate", label: "Expiry", type: "date" },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
