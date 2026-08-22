import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-10 text-[#e6dccf] lg:flex">
        <p className="font-display text-2xl tracking-tight">Social72</p>
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight text-[#f4efe6]">
            Every marketing lead deserves a next action.
          </p>
          <p className="mt-5 text-sm leading-6 text-[#b7aa9a]">
            Internal CRM for campaign intake, BPO calling, and conversion across
            education admissions and real estate.
          </p>
        </div>
        <p className="text-xs text-[#8d8072]">Phase 1 · Foundation</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="font-display text-3xl text-ink lg:hidden">Social72</p>
          <h1 className="font-display text-3xl text-ink">Sign in</h1>
          <p className="mt-2 mb-8 text-sm text-ink-soft">
            Use the account issued by your administrator. Public registration is
            disabled.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
