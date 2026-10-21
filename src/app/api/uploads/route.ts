import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { saveUpload } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  try {
    await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { message: "Choose a file to upload" } }, { status: 400 });
    }
    const folder = String(form.get("folder") || "files");
    const saved = await saveUpload(file, folder);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
