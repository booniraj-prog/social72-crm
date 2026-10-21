"use client";

import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ui/action-icon";

export function ApprovalQueue({
  title,
  kind,
  items,
}: {
  title: string;
  kind: "people-decide" | "engagement-decide" | "invoice-decide";
  items: Array<{ id: string; title: string; meta?: string }>;
}) {
  const router = useRouter();
  if (!items.length) return null;

  async function decide(id: string, status: "APPROVED" | "REJECTED" | "SENT" | "VOID") {
    await fetch(`/api/platform?kind=${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }

  const pass = kind === "invoice-decide" ? "SENT" : "APPROVED";
  const fail = kind === "invoice-decide" ? "VOID" : "REJECTED";

  return (
    <section className="surface mt-5 rounded-lg p-4">
      <h2 className="font-display text-xl">
        {title} <span className="text-sm font-sans text-ink-soft">({items.length})</span>
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {item.title}
              {item.meta ? <span className="text-ink-soft"> · {item.meta}</span> : null}
            </span>
            <span className="flex gap-0.5">
              <ActionIcon action="approve" onClick={() => void decide(item.id, pass)} />
              <ActionIcon action="reject" onClick={() => void decide(item.id, fail)} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
