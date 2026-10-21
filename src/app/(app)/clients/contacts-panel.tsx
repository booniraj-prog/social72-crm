"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { controlClass, Field, FormBanner } from "@/components/platform/form-field";
import { ActionIcon } from "@/components/ui/action-icon";

type Contact = {
  id: string;
  name: string;
  designation: string | null;
  email: string | null;
  mobile: string | null;
  whatsapp: string | null;
  primary: boolean;
};

export function ContactsPanel({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-xs uppercase tracking-[0.16em] text-ink-soft">Contacts</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {contacts.length === 0 ? <li className="text-ink-soft">No extra contacts yet. Primary lives on the client record.</li> : null}
        {contacts.map((c) => (
          <li key={c.id}>
            <p className="font-medium">
              {c.name}
              {c.primary ? <span className="ml-2 text-[10px] uppercase text-copper">Primary</span> : null}
            </p>
            <p className="text-xs text-ink-soft">
              {[c.designation, c.mobile || c.whatsapp, c.email].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 grid gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
          if (!data.name?.trim()) {
            setError("Name is required");
            return;
          }
          setSaving(true);
          setError("");
          const res = await fetch("/api/platform?kind=contact", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...data, clientId, isPrimary: data.isPrimary === "on" }),
          });
          setSaving(false);
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            setError(json.error?.message ?? "Could not save contact");
            return;
          }
          form.reset();
          router.refresh();
        }}
      >
        <FormBanner message={error} />
        <Field label="Add contact" required>
          <input name="name" placeholder="Name" className={controlClass()} />
        </Field>
        <input name="designation" placeholder="Designation" className={controlClass()} />
        <input name="mobile" placeholder="Mobile / WhatsApp" className={controlClass()} />
        <input name="email" placeholder="Email" className={controlClass()} />
        <label className="flex items-center gap-2 text-xs text-ink-soft">
          <input type="checkbox" name="isPrimary" />
          Primary contact
        </label>
        <ActionIcon type="submit" action="save" disabled={saving} label="Add contact" />
      </form>
    </div>
  );
}
