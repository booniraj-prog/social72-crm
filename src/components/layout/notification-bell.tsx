"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell } from "lucide-react";
import { ActionIcon } from "@/components/ui/action-icon";

type Note = {
  id: string;
  title: string;
  body: string | null;
  leadId: string | null;
  leadName: string | null;
  readAt: string | null;
  createdAt: string;
  emailTo?: string | null;
  phoneTo?: string | null;
};

export function NotificationBell({
  initialUnread,
  initialItems,
}: {
  initialUnread: number;
  initialItems: Note[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(initialItems);

  async function markRead() {
    await fetch("/api/notifications/read", { method: "POST" });
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="action-icon action-icon-preview relative"
        aria-label="Alerts"
        title="Alerts"
        data-tooltip="Alerts"
      >
        <Bell className="h-4 w-4" strokeWidth={1.9} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-copper px-1 text-center text-[10px] leading-4 text-white">
            {unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-10 z-30 w-80 rounded-lg border border-line bg-white p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">Notifications</p>
            {unread > 0 ? (
              <ActionIcon action="complete" label="Mark read" onClick={markRead} />
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-2 py-4 text-sm text-ink-soft">No alerts yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-t border-line first:border-0">
                  {n.leadId ? (
                    <Link
                      href={`/leads/${n.leadId}`}
                      prefetch={false}
                      className="block rounded-lg px-2 py-2 hover:bg-paper"
                      onClick={() => setOpen(false)}
                    >
                      <p className="text-sm text-ink">{n.title}</p>
          <p className="text-xs text-[#8d8072]">{n.body ?? n.leadName ?? ""}</p>
                      {n.emailTo || n.phoneTo ? (
                        <p className="text-[10px] text-ink-soft">
                          {n.emailTo ? `Email ${n.emailTo}` : ""}
                          {n.emailTo && n.phoneTo ? " · " : ""}
                          {n.phoneTo ? `SMS ${n.phoneTo}` : ""}
                        </p>
                      ) : null}
                    </Link>
                  ) : (
                    <div className="px-2 py-2">
                      <p className="text-sm text-ink">{n.title}</p>
                      <p className="text-xs text-ink-soft">{n.body ?? ""}</p>
                      {n.emailTo || n.phoneTo ? (
                        <p className="text-[10px] text-ink-soft">
                          {n.emailTo ? `Email ${n.emailTo}` : ""}
                          {n.emailTo && n.phoneTo ? " · " : ""}
                          {n.phoneTo ? `SMS ${n.phoneTo}` : ""}
                        </p>
                      ) : null}
                    </div>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
