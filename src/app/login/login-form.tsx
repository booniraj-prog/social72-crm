"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { controlClass, Field, FormBanner, focusInvalid, validateRecord } from "@/components/platform/form-field";
import { ActionIcon } from "@/components/ui/action-icon";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/today";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors = validateRecord(
      { email, password },
      [
        { name: "email", label: "Work email", required: true, type: "email" },
        { name: "password", label: "Password", required: true, minLength: 1 },
      ],
    );
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      requestAnimationFrame(() => focusInvalid(e.currentTarget));
      return;
    }
    setError("");
    setLoading(true);
    const { error: signError } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (signError) {
      setError(signError.message || "Could not sign in");
      setFieldErrors({ email: "Check email", password: "Check password" });
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Work email" required error={fieldErrors.email}>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.9} />
          <input
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={Boolean(fieldErrors.email)}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((c) => ({ ...c, email: "" }));
            }}
            className={controlClass(Boolean(fieldErrors.email), "pl-9")}
          />
        </div>
      </Field>
      <Field label="Password" required error={fieldErrors.password}>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" strokeWidth={1.9} />
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={Boolean(fieldErrors.password)}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((c) => ({ ...c, password: "" }));
            }}
            className={controlClass(Boolean(fieldErrors.password), "pl-9")}
          />
        </div>
      </Field>
      <FormBanner message={error} />
      <ActionIcon type="submit" action="signin" disabled={loading} className="mt-2" />
    </form>
  );
}
