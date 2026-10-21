import { getAuthUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return <div className="min-h-screen bg-white text-ink">{children}</div>;
}
