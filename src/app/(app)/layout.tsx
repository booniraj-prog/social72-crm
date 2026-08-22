import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getAuthUser } from "@/lib/session";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
