"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { controlClass, Field, FormBanner, focusInvalid } from "@/components/platform/form-field";
import { ActionIcon } from "@/components/ui/action-icon";

export function SectionNewClient({
  industryKey,
  label,
}: {
  industryKey: "services";
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save(formEl: HTMLFormElement) {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Client name is required";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) {
      requestAnimationFrame(() => focusInvalid(formEl));
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        industryKey,
        contactName,
        createStarterCampaign: true,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(json.error?.message ?? "Could not create client");
      return;
    }
    setOpen(false);
    setName("");
    setContactName("");
    const clientId = json.client?.id as string | undefined;
    const path = "/services";
    router.push(clientId ? `${path}?clientId=${clientId}` : path);
    router.refresh();
  }

  return (
    <>
      <ActionIcon
        action="new"
        label={label}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
      />
      {open ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/40 p-4">
          <form
            noValidate
            className="w-full max-w-md rounded-lg bg-paper p-6"
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget);
            }}
          >
            <h2 className="font-display text-2xl">{label}</h2>
            <p className="mt-2 text-sm text-ink-soft">
              Creates a client on this industry and a starter campaign so you can import leads immediately.
            </p>
            <FormBanner message={error} />
            <div className="mt-4">
              <Field label="Client name" required error={fieldErrors.name}>
                <input
                  value={name}
                  aria-invalid={Boolean(fieldErrors.name)}
                  onChange={(e) => {
                    setName(e.target.value);
                    setFieldErrors((c) => ({ ...c, name: "" }));
                  }}
                  placeholder="Agency or product client"
                  className={controlClass(Boolean(fieldErrors.name))}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Contact name">
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={controlClass()} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <ActionIcon action="cancel" onClick={() => setOpen(false)} />
              <ActionIcon type="submit" action="save" disabled={saving} label="Save client" />
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
