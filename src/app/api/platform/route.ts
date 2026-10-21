import { NextRequest, NextResponse } from "next/server";
import { jsonError, requirePermission, requireUser, HttpError } from "@/lib/session";
import {
  completeWorkTask,
  createEngagement,
  createExpense,
  createInvoice,
  updateInvoice,
  updateExpense,
  updatePurchase,
  updateLicense,
  createLeave,
  createLicense,
  createEmployee,
  updateEmployee,
  createPurchase,
  createServiceLead,
  createWorkTask,
  decideExpense,
  decideInvoice,
  decideLeave,
  decideLicense,
  decidePerson,
    decidePurchase,
  decideEngagement,
  expenseSchema,
  invoiceSchema,
  licenseSchema,
  engagementSchema,
  leaveSchema,
  peopleSchema,
  purchaseSchema,
  serviceDetailsSchema,
  serviceLeadSchema,
  taskSchema,
  attendanceSchema,
  markAttendance,
  upsertServiceDetails,
  convertLeadToProject,
  createDeliverable,
  createVendor,
  deliverableSchema,
  vendorSchema,
  deleteExpense,
  deletePurchase,
  deleteLicense,
  deleteInvoice,
  deletePerson,
  tagProposalSchema,
  tagProposalToProject,
  createDocument,
  updateDocument,
  deleteDocument,
  deleteLeadImportFile,
  documentSchema,
} from "@/modules/platform/service";
import { createNurtureTemplate, logNurture } from "@/modules/today/service";
import {
  allocationSchema,
  clientOrderSchema,
  contactSchema,
  createAllocation,
  createClientOrder,
  createContact,
} from "@/modules/resources/service";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireUser();
    const body = await request.json();
    const kind = request.nextUrl.searchParams.get("kind");
    if (kind === "engagement") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await createEngagement(actor, engagementSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "service-lead") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await createServiceLead(actor, serviceLeadSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "task") {
      return NextResponse.json({ row: await createWorkTask(actor, taskSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "task-complete") {
      return NextResponse.json({ row: await completeWorkTask(body.id) });
    }
    if (kind === "license") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createLicense(actor, licenseSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "invoice") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createInvoice(actor, invoiceSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "invoice-update") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await updateInvoice(actor, invoiceSchema.parse(body)) });
    }
    if (kind === "expense-update") {
      return NextResponse.json({ row: await updateExpense(actor, String(body.id), expenseSchema.parse(body)) });
    }
    if (kind === "purchase-update") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await updatePurchase(actor, String(body.id), purchaseSchema.parse(body)) });
    }
    if (kind === "license-update") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await updateLicense(actor, String(body.id), licenseSchema.parse(body)) });
    }
    if (kind === "proposal-tag") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await tagProposalToProject(actor, tagProposalSchema.parse(body)) });
    }
    if (kind === "purchase") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createPurchase(actor, purchaseSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "expense") {
      return NextResponse.json({ row: await createExpense(actor, expenseSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "expense-decide") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await decideExpense(body.id, body.status, actor) });
    }
    if (kind === "purchase-decide") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await decidePurchase(body.id, body.status, actor) });
    }
    if (kind === "license-decide") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await decideLicense(body.id, body.status, actor) });
    }
    if (kind === "invoice-decide") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await decideInvoice(body.id, body.status, actor) });
    }
    if (kind === "people-decide") {
      await requirePermission("user.read");
      return NextResponse.json({ row: await decidePerson(body.id, body.status, actor) });
    }
    if (kind === "engagement-decide") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await decideEngagement(body.id, body.status, actor) });
    }
    if (kind === "expense-delete") {
      return NextResponse.json({ row: await deleteExpense(actor, String(body.id)) });
    }
    if (kind === "purchase-delete") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await deletePurchase(actor, String(body.id)) });
    }
    if (kind === "license-delete") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await deleteLicense(actor, String(body.id)) });
    }
    if (kind === "invoice-delete") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await deleteInvoice(actor, String(body.id)) });
    }
    if (kind === "people-delete") {
      await requirePermission("user.read");
      return NextResponse.json({ row: await deletePerson(actor, String(body.id)) });
    }
    if (kind === "people") {
      await requirePermission("user.read");
      return NextResponse.json({ row: await createEmployee(actor, peopleSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "people-update") {
      await requirePermission("user.read");
      return NextResponse.json({ row: await updateEmployee(actor, peopleSchema.parse({ ...body, userId: body.userId || body.id })) });
    }
    if (kind === "leave") {
      return NextResponse.json({ row: await createLeave(actor, leaveSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "leave-decide") {
      await requirePermission("user.read");
      return NextResponse.json({ row: await decideLeave(body.id, body.status) });
    }
    if (kind === "attendance") {
      return NextResponse.json({ row: await markAttendance(actor, attendanceSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "service-details") {
      await requirePermission("lead.write");
      return NextResponse.json({
        row: await upsertServiceDetails(String(body.leadId), serviceDetailsSchema.parse(body)),
      });
    }
    if (kind === "deliverable") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await createDeliverable(actor, deliverableSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "vendor") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createVendor(vendorSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "convert-project") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await convertLeadToProject(actor, String(body.leadId)) }, { status: 201 });
    }
    if (kind === "nurture") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await createNurtureTemplate(body) }, { status: 201 });
    }
    if (kind === "nurture-send") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await logNurture(actor, String(body.leadId), String(body.templateId)) });
    }
    if (kind === "contact") {
      await requirePermission("client.write");
      return NextResponse.json({ row: await createContact(actor, contactSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "allocation") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await createAllocation(actor, allocationSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "client-order") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createClientOrder(actor, clientOrderSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "document") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await createDocument(actor, documentSchema.parse(body)) }, { status: 201 });
    }
    if (kind === "document-update") {
      await requirePermission("report.read");
      return NextResponse.json({ row: await updateDocument(actor, documentSchema.parse(body)) });
    }
    if (kind === "document-delete") {
      return NextResponse.json({ row: await deleteDocument(actor, String(body.id)) });
    }
    if (kind === "lead-import-delete") {
      await requirePermission("lead.write");
      return NextResponse.json({ row: await deleteLeadImportFile(actor, String(body.id)) });
    }
    if (kind === "trash-restore") {
      return NextResponse.json({ row: await restoreTrashItem(actor, String(body.id)) });
    }
    throw new HttpError(400, "Unknown platform action", "UNKNOWN_ACTION");
  } catch (error) {
    return jsonError(error);
  }
}
