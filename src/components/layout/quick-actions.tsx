"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, FolderKanban, ListChecks, Phone, Receipt, UserPlus, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActionIcon } from "@/components/ui/action-icon";

const ACTIONS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/leads", label: "Lead", icon: UserPlus },
  { href: "/calling", label: "Call", icon: Phone },
  { href: "/clients", label: "Client", icon: Users },
  { href: "/proposals", label: "Proposal", icon: FileText },
  { href: "/engagements", label: "Project", icon: FolderKanban },
  { href: "/work-tasks", label: "Task", icon: ListChecks },
  { href: "/invoices", label: "Invoice", icon: Receipt },
  { href: "/spend", label: "Expense", icon: Wallet },
];

export function QuickActions() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ActionIcon action="new" onClick={() => setOpen((v) => !v)} />
      {open ? (
        <ul className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-md border border-line bg-white py-1 text-sm shadow-lg">
          {ACTIONS.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-ink hover:bg-paper"
              >
                <a.icon className="h-4 w-4 text-copper" strokeWidth={1.9} />
                {a.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
