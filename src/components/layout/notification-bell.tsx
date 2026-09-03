"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Note = {
  id: string;
  title: string;
  body: string | null;
  leadId: string | null;
  leadName: string | null;
  readAt: string | null;
  createdAt: string;
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
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="relative rounded-md px-2 py-1 text-xs text-[#c4b8a8] hover:bg-white/5 hover:text-[#f4efe6]"
      >
        Alerts
        {unread > 0 ? (
          <span className="ml-1 rounded-full bg-copper px-1.5 py-0.5 text-[10px] text-white">{unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute bottom-10 left-0 z-20 w-80 rounded-md border border-white/10 bg-sidebar p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs uppercase tracking-wide text-[#8d8072]">Notifications</p>
            {unread > 0 ? (
              <button type="button" onClick={markRead} className="text-[11px] text-[#c4b8a8] hover:text-[#f4efe6]">
                Mark read
              </button>
            ) : null}
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-2 py-4 text-xs text-[#8d8072]">No alerts yet.</li>
            ) : (
              items.map((n) => (
                <li key={n.id} className="border-t border-white/10 first:border-0">
                  {n.leadId ? (
                    <Link
                      href={`/leads/${n.leadId}`}
                      prefetch={false}
                      className="block px-2 py-2 hover:bg-white/5"
                      onClick={() => setOpen(false)}
                    >
                      <p className="text-xs text-[#f4efe6]">{n.title}</p>
                      <p className="text-[11px] text-[#8d8072]">{n.body ?? n.leadName ?? ""}</p>
                    </Link>
                  ) : (
                    <div className="px-2 py-2">
                      <p className="text-xs text-[#f4efe6]">{n.title}</p>
                      <p className="text-[11px] text-[#8d8072]">{n.body ?? ""}</p>
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
