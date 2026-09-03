const REQUIRED = ["DATABASE_URL"] as const;

export function envStatus() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  return {
    ok: missing.length === 0,
    missing,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    nodeEnv: process.env.NODE_ENV ?? "development",
  };
}
