import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

export const auth = betterAuth({
  appName: "Social72 CRM",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  trustedOrigins: async (request) => {
    const origins = new Set<string>([
      "http://localhost:3000",
      process.env.BETTER_AUTH_URL ?? "",
      process.env.NEXT_PUBLIC_APP_URL ?? "",
    ]);
    if (request) {
      try {
        origins.add(new URL(request.url).origin);
      } catch {
        /* ignore invalid request url */
      }
      const origin = request.headers.get("origin");
      if (origin) origins.add(origin);
      const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
      const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
      if (forwardedHost) {
        const host = forwardedHost.split(",")[0]?.trim();
        const proto = forwardedProto.split(",")[0]?.trim() || "https";
        if (host) origins.add(`${proto}://${host}`);
      }
    }
    return [...origins].filter(Boolean);
  },
  plugins: [nextCookies()],
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { isActive: true },
          });
          if (!user?.isActive) {
            throw new Error("This account is inactive.");
          }
          return { data: session };
        },
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
        },
      },
    },
  },
});
