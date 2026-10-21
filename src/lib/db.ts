import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function isCurrentClient(client: PrismaClient | undefined): client is PrismaClient {
  return Boolean(client && "deliverable" in client && "nurtureTemplate" in client);
}

export const prisma = isCurrentClient(globalForPrisma.prisma) ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
