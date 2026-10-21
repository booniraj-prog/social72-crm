"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionIcon } from "@/components/ui/action-icon";
import type { LifecycleEntity } from "@/modules/lifecycle/types";

export function ActiveToggle({
  entity,
  id,
  active,
  name,
}: {
  entity: LifecycleEntity;
  id: string;
  active: boolean;
  name?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !active;
    const label = name ? ` ${name}` : " this record";
    const pause =
      entity === "employee"
        ? "They cannot sign in. Pay and timesheets stay on file."
        : entity === "lead"
          ? "Calling and follow-ups will skip it. History stays on file."
          : "Calling and new work pause. Invoices, POs and spend stay on file.";
    if (!window.confirm(next ? `Activate${label}?` : `Deactivate${label}? ${pause}`)) {
      return;
    }
    setBusy(true);
    const res = await fetch("/api/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity, id, active: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      window.alert(json.error?.message ?? "Could not update");
      return;
    }
    router.refresh();
  }

  return (
    <ActionIcon
      action={active ? "deactivate" : "restore"}
      label={active ? "Deactivate" : "Activate"}
      disabled={busy}
      onClick={() => void toggle()}
    />
  );
}
