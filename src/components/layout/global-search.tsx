"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Extra = {
  leads?: Array<{ id: string; fullName: string; leadNumber: string }>;
  clients?: Array<{ id: string; name: string }>;
  invoices?: Array<{ id: string; number: string }>;
  licenses?: Array<{ id: string; name: string }>;
  people?: Array<{ id: string; name: string }>;
  engagements?: Array<{ id: string; name: string }>;
  tasks?: Array<{ id: string; title: string }>;
  purchases?: Array<{ id: string; number: string; title: string }>;
};

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<Extra>({});

  useEffect(() => {
    if (q.trim().length < 2) {
      setExtra({});
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((json) => setExtra(json.extra ?? {}))
        .catch(() => setExtra({}));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const groups: Array<{ label: string; href: (id: string) => string; items: Array<{ id: string; label: string }> }> = [
    {
      label: "Leads",
      href: (id) => `/leads/${id}`,
      items: (extra.leads ?? []).map((l) => ({ id: l.id, label: `${l.fullName} · ${l.leadNumber}` })),
    },
    {
      label: "Clients",
      href: () => "/clients",
      items: (extra.clients ?? []).map((c) => ({ id: c.id, label: c.name })),
    },
    {
      label: "Projects",
      href: () => "/engagements",
      items: (extra.engagements ?? []).map((e) => ({ id: e.id, label: e.name })),
    },
    {
      label: "Tasks",
      href: () => "/work-tasks",
      items: (extra.tasks ?? []).map((t) => ({ id: t.id, label: t.title })),
    },
    {
      label: "Invoices",
      href: () => "/invoices",
      items: (extra.invoices ?? []).map((i) => ({ id: i.id, label: i.number })),
    },
  ];

  return (
    <div className="relative w-full max-w-xl">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.9} />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search leads, clients, projects…"
        className="h-9 w-full rounded-md border border-line bg-paper px-9 text-sm text-ink outline-none ring-copper/25 placeholder:text-ink-soft focus:bg-white focus:ring-2"
      />
      {open && q.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-10 z-30 max-h-80 overflow-y-auto rounded-lg border border-line bg-white p-2 text-sm shadow-lg">
          {groups.every((g) => g.items.length === 0) ? (
            <p className="px-3 py-4 text-ink-soft">No matches</p>
          ) : (
            groups.map((group) =>
              group.items.length ? (
                <div key={group.label} className="mb-2">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-ink-soft">{group.label}</p>
                  {group.items.map((item) => (
                    <Link
                      key={item.id}
                      href={group.href(item.id)}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-paper"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ) : null,
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
