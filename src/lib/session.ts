import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission, type AuthUser, type RoleKey } from "@/lib/rbac";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
    public details?: unknown,
  ) {
    super(message);
  }
}

export class DuplicateLeadError extends HttpError {
  constructor(message: string, existing: unknown) {
    super(409, message, "DUPLICATE", { existing });
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: {
        include: { permissions: { include: { permission: true } } },
      },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleKey: user.role.key as RoleKey,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
    isActive: user.isActive,
    clientId: user.clientId,
  };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) throw new HttpError(401, "Sign in required", "UNAUTHENTICATED");
  return user;
}

export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) {
    throw new HttpError(403, "You do not have permission to do that", "FORBIDDEN");
  }
  return user;
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION",
          message: error.issues[0]?.message ?? "Invalid input",
        },
      },
      { status: 400 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 },
  );
}
