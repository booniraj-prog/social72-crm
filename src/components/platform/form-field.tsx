"use client";

import type { ReactNode } from "react";

export function controlClass(invalid?: boolean, extra = "") {
  return [
    "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none transition",
    invalid
      ? "field-invalid border-danger bg-[#fdf2f2] text-ink ring-2 ring-danger/25"
      : "border-line focus:border-copper focus:ring-2 focus:ring-copper/25",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function textareaClass(invalid?: boolean) {
  return [
    "w-full rounded-md border bg-white px-3 py-2 text-sm outline-none transition",
    invalid
      ? "field-invalid border-danger bg-[#fdf2f2] ring-2 ring-danger/25"
      : "border-line focus:border-copper focus:ring-2 focus:ring-copper/25",
  ].join(" ");
}

export function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className={error ? "font-medium text-danger" : "text-ink-soft"}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-3 rounded-md border border-danger/30 bg-[#fdf2f2] px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

export type FieldRule = {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  min?: number;
  max?: number;
  minLength?: number;
};

export function validateRecord(data: Record<string, string>, rules: FieldRule[]) {
  const errors: Record<string, string> = {};
  for (const rule of rules) {
    const raw = (data[rule.name] ?? "").trim();
    if (rule.required && !raw) {
      errors[rule.name] = `${rule.label} is required`;
      continue;
    }
    if (!raw) continue;
    if (rule.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      errors[rule.name] = "Enter a valid email address";
    }
    if (rule.type === "number" || rule.type === "date") {
      if (rule.type === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) errors[rule.name] = "Enter a valid number";
        else if (rule.min != null && n < rule.min) errors[rule.name] = `Must be at least ${rule.min}`;
        else if (rule.max != null && n > rule.max) errors[rule.name] = `Must be at most ${rule.max}`;
      }
    }
    if (rule.minLength && raw.length < rule.minLength) {
      errors[rule.name] = `At least ${rule.minLength} characters`;
    }
  }
  return errors;
}

export function focusInvalid(root?: HTMLElement | null) {
  const el = root?.querySelector<HTMLElement>("[aria-invalid='true']");
  el?.focus();
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function applyServerErrors(json: unknown) {
  const err = (json as { error?: { message?: string; fields?: Record<string, string> } } | undefined)?.error;
  const fields = err?.fields ?? {};
  let message = err?.message ?? "Could not save";
  if (/invalid uuid/i.test(message)) {
    message = Object.values(fields)[0] || "Choose an option from the list, or leave optional fields blank.";
  }
  return { message, fields };
}
