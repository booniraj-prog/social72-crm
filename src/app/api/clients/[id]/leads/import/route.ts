import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requirePermission } from "@/lib/session";
import { optionalId, requiredId } from "@/lib/ids";
import { csvToLeadRows } from "@/lib/csv";
import { saveUpload } from "@/lib/uploads";
import { importClientLeads } from "@/modules/campaigns/service";
import { collapseDuplicateLeads } from "@/modules/leads/service";
import { createDocument } from "@/modules/platform/service";

const rowSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  mobile: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
});

const jsonSchema = z.object({
  campaignId: optionalId,
  assignedUserId: requiredId("an employee"),
  rows: z.array(rowSchema).min(1).max(500),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requirePermission("lead.write");
    const { id } = await context.params;
    const contentType = request.headers.get("content-type") ?? "";
    let campaignId: string | undefined;
    let assignedUserId: string;
    let rows: z.infer<typeof rowSchema>[];
    let fileMeta: { fileId?: string; fileName?: string } = {};

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      assignedUserId = requiredId("an employee").parse(form.get("assignedUserId"));
      const rawCampaign = form.get("campaignId");
      campaignId = rawCampaign ? optionalId.parse(rawCampaign) : undefined;
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: { message: "Choose a CSV file" } }, { status: 400 });
      }
      const saved = await saveUpload(file, "lead-imports");
      const parsed = csvToLeadRows(await file.text()).slice(0, 500);
      rows = parsed;
      const doc = await createDocument(actor, {
        title: `Lead import · ${file.name}`.slice(0, 160),
        kind: "LEAD_IMPORT",
        url: saved.url,
        clientId: id,
        notes: `${parsed.length} rows`,
      });
      fileMeta = { fileId: doc.id, fileName: file.name };
    } else {
      const body = jsonSchema.parse(await request.json());
      campaignId = body.campaignId;
      assignedUserId = body.assignedUserId;
      rows = body.rows;
    }

    const summary = await importClientLeads(actor, id, { campaignId, assignedUserId, rows });
    const dedupe = await collapseDuplicateLeads(actor, id);
    return NextResponse.json({ ...summary, ...fileMeta, collapsed: dedupe.collapsed });
  } catch (error) {
    return jsonError(error);
  }
}
