"use client";

import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/ui/action-icon";
import { TableFrame } from "@/components/platform/table-controls";

type Item = {
  id: string;
  entityType: string;
  title: string;
  summary: string | null;
  deletedAt: string;
  purgeAt: string;
  daysLeft: number;
};

export function TrashBoard({ items }: { items: Item[] }) {
  const router = useRouter();
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Admin</p>
      <h1 className="mt-1 font-display text-3xl text-ink">Trash</h1>
      <p className="mt-1 max-w-xl text-sm text-ink-soft">
        Deleted records stay here for 30 days. Restore if something was removed by mistake. After that they are purged.
      </p>
      <div className="surface mt-5 overflow-hidden rounded-lg">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">Trash is empty.</p>
        ) : (
          <TableFrame
            rows={items.map((item) => ({
              ...item,
              record: item.title,
              type: item.entityType,
              days: item.daysLeft,
            }))}
            columns={["record", "type", "days"]}
            labels={{ days: "Days left" }}
            empty="Trash is empty."
            extraHeaders={<th className="px-3 py-2" />}
            extraColSpan={1}
            renderRow={(item) => (
              <>
                <td className="px-4 py-2">
                  {String(item.record)}
                  {item.summary ? <p className="text-xs text-ink-soft">{String(item.summary)}</p> : null}
                </td>
                <td className="px-4 py-2 capitalize">{String(item.type)}</td>
                <td className="px-4 py-2">{Number(item.days)}</td>
                <td className="px-4 py-2 text-right">
                  <ActionIcon
                    action="restore"
                    onClick={async () => {
                      await fetch("/api/platform?kind=trash-restore", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: item.id }),
                      });
                      router.refresh();
                    }}
                  />
                </td>
              </>
            )}
          />
        )}
      </div>
    </div>
  );
}
