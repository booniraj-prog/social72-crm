import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getAuthUser } from "@/lib/session";
import { formatInr } from "@/lib/money";
import { profitability } from "@/modules/today/service";
import { projectEconomics } from "@/modules/platform/service";
import { ProfitTables } from "./profit-tables";

export default async function ProfitPage() {
  const actor = await getAuthUser();
  if (!actor || !hasPermission(actor, "report.read")) redirect("/dashboard");
  const [p, projects] = await Promise.all([profitability(), projectEconomics()]);
  const lines = [
    { label: "Collected revenue", value: p.revenue },
    { label: "Ad spend", value: -p.adSpend },
    { label: "Vendor / PO cost", value: -p.vendorCost },
    { label: "Tools & licenses", value: -p.toolCost },
    { label: "Delivery / other", value: -p.other },
  ];
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Finance</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Social72 profit</h1>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Collections minus ads, vendors, tools and delivery spend. Project rows use tagged proposals plus spend on that job.
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg bg-ink px-5 py-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/60">Gross margin</p>
          <p className="mt-1 font-display text-3xl leading-none">₹{formatInr(p.gross)}</p>
          <p className="mt-2 text-sm text-white/70">{p.grossPct}% on collections</p>
        </div>
        <div className="rounded-lg bg-pine px-5 py-5 text-white">
          <p className="text-[10px] uppercase tracking-[0.16em] text-white/70">Net profit</p>
          <p className="mt-1 font-display text-3xl leading-none">₹{formatInr(p.profit)}</p>
          <p className="mt-2 text-sm text-white/70">{p.margin}% on collections</p>
          <p className="mt-3 text-sm text-white/60">Billed ₹{formatInr(p.billed)}</p>
        </div>
        <ul className="surface rounded-lg px-5 py-2">
          {lines.map((line) => (
            <li key={line.label} className="flex justify-between border-b border-line py-3 text-sm last:border-0">
              <span className="text-ink-soft">{line.label}</span>
              <span className={line.value < 0 ? "text-danger" : "text-ink"}>
                {line.value < 0 ? "−" : ""}₹{formatInr(Math.abs(line.value))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <ProfitTables projects={projects} clients={p.clientRows} campaigns={p.campaigns} />
    </div>
  );
}
