import { NextRequest, NextResponse } from "next/server";
import { jsonError, HttpError } from "@/lib/session";
import { leadgenEvents, verifyMetaSignature } from "@/lib/meta-ingest";
import { ingestLeadgenEvent, loadMetaConfig } from "@/modules/meta/service";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const config = await loadMetaConfig();
  if (mode === "subscribe" && config.verifyToken && token === config.verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: { code: "FORBIDDEN", message: "Verify token mismatch" } }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    const config = await loadMetaConfig();
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyMetaSignature(raw, signature, config.appSecret)) {
      throw new HttpError(401, "Invalid Meta signature", "UNAUTHORIZED");
    }
    let payload: unknown = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      throw new HttpError(400, "Invalid JSON", "INVALID_JSON");
    }
    const events = leadgenEvents(payload);
    const results = [];
    for (const event of events) {
      results.push(await ingestLeadgenEvent(event, config));
    }
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    return jsonError(error);
  }
}
