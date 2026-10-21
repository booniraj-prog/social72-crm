import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Inbox } from "lucide-react";
import { getAuthUser } from "@/lib/session";
import { roleInbox } from "@/modules/today/service";
import { IconChip } from "@/components/ui/icons";

export default async function TodayPage() {
  const actor = await getAuthUser();
  if (!actor) redirect("/login");
  const inbox = await roleInbox(actor);
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">{inbox.playbook.desk}</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Today</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-soft">{inbox.playbook.summary}</p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {inbox.playbook.steps.map((step, i) => (
          <li key={step.label} className="surface rounded-lg px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-copper">
              Step {i + 1}
            </p>
            <p className="mt-1 font-medium text-ink">{step.label}</p>
            <p className="mt-1 text-xs text-ink-soft">{step.detail}</p>
          </li>
        ))}
      </ol>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat label="In your queue" value={inbox.due} />
        <Stat label="Overdue" value={inbox.overdue} warn={inbox.overdue > 0} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {inbox.queues.map((queue) => (
          <List key={`${queue.title}-${queue.href}`} title={queue.title} href={queue.href} items={queue.items} danger={queue.danger} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="surface flex items-center gap-3 rounded-xl px-4 py-3">
      <IconChip icon={warn ? AlertTriangle : Inbox} tone={warn ? "danger" : "copper"} />
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-ink-soft">{label}</p>
        <p className={`mt-0.5 font-display text-2xl leading-none ${warn ? "text-danger" : "text-ink"}`}>{value}</p>
      </div>
    </div>
  );
}

function List({
  title,
  href,
  items,
  danger,
}: {
  title: string;
  href: string;
  items: Array<{ id: string; title: string; href: string; meta: string }>;
  danger?: boolean;
}) {
  return (
    <section className="surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`font-display text-lg ${danger ? "text-danger" : "text-ink"}`}>
          {title} <span className="text-sm font-sans text-ink-soft">({items.length})</span>
        </h2>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs text-copper">
          Open
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.9} />
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">Clear.</p>
      ) : (
        <ul className="mt-3 space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href} className="block rounded-md px-2 py-1.5 hover:bg-paper">
                <p className="text-sm font-medium text-ink">{item.title}</p>
                {item.meta ? <p className="text-xs text-ink-soft">{item.meta}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
