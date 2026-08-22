import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { HttpError } from "@/lib/session";

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(72),
  roleId: z.string().uuid(),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  clientId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  mobile: z.string().trim().max(20).optional().or(z.literal("")),
  roleId: z.string().uuid().optional(),
  clientId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(72).optional(),
});

function publicUser<T extends object>(user: T) {
  const copy = { ...user } as T & { accounts?: unknown };
  delete copy.accounts;
  return copy;
}

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { role: true, client: { select: { id: true, name: true } } },
  });
  return users;
}

export async function listRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

export async function createUser(actorId: string, input: z.infer<typeof createUserSchema>) {
  const data = createUserSchema.parse(input);
  const exists = await prisma.user.findUnique({ where: { email: data.email } });
  if (exists) throw new HttpError(409, "A user with this email already exists", "DUPLICATE");

  const role = await prisma.role.findUnique({ where: { id: data.roleId } });
  if (!role) throw new HttpError(400, "Invalid role", "INVALID_ROLE");

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      id: userId,
      name: data.name,
      email: data.email,
      emailVerified: true,
      roleId: data.roleId,
      mobile: data.mobile || null,
      clientId: data.clientId || null,
      isActive: data.isActive ?? true,
      accounts: {
        create: {
          id: crypto.randomUUID(),
          accountId: userId,
          providerId: "credential",
          issuer: "local:credential",
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    },
    include: { role: true, client: { select: { id: true, name: true } } },
  });

  await writeAudit({
    userId: actorId,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    newValue: { email: user.email, role: role.key },
  });

  return publicUser(user);
}

export async function updateUser(
  actorId: string,
  id: string,
  input: z.infer<typeof updateUserSchema>,
) {
  const data = updateUserSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new HttpError(404, "User not found", "NOT_FOUND");

  if (data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: data.roleId } });
    if (!role) throw new HttpError(400, "Invalid role", "INVALID_ROLE");
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: {
        name: data.name,
        mobile: data.mobile === undefined ? undefined : data.mobile || null,
        roleId: data.roleId,
        clientId: data.clientId === undefined ? undefined : data.clientId,
        isActive: data.isActive,
      },
      include: { role: true, client: { select: { id: true, name: true } } },
    });

    if (data.password) {
      const passwordHash = await hashPassword(data.password);
      const account = await tx.account.findFirst({
        where: { userId: id, providerId: "credential" },
      });
      if (account) {
        await tx.account.update({
          where: { id: account.id },
          data: { password: passwordHash, updatedAt: new Date() },
        });
      } else {
        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: id,
            accountId: id,
            providerId: "credential",
            issuer: "local:credential",
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    return updated;
  });

  await writeAudit({
    userId: actorId,
    action: "user.updated",
    entityType: "user",
    entityId: id,
    oldValue: { role: existing.role.key, isActive: existing.isActive },
    newValue: { role: user.role.key, isActive: user.isActive },
  });

  return user;
}
