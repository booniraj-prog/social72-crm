import { NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/session";
import { listIndustries } from "@/modules/clients/service";

export async function GET() {
  try {
    await requireUser();
    const industries = await listIndustries();
    return NextResponse.json({ industries });
  } catch (error) {
    return jsonError(error);
  }
}
