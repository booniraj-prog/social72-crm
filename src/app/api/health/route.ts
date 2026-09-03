import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { envStatus } from "@/lib/env";

export async function GET() {
  const env = envStatus();
  let database = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }
  const ok = env.ok && database === "up";
  return NextResponse.json(
    {
      ok,
      service: "social72-crm",
      database,
      env: { ok: env.ok, missing: env.missing, nodeEnv: env.nodeEnv },
    },
    { status: ok ? 200 : 503 },
  );
}
