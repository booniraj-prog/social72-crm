import { Suspense } from "react";
import LoginForm from "./login-form";
import { Social72Logo } from "@/components/brand/social72-logo";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <aside className="hidden flex-col justify-between bg-sidebar px-12 py-10 text-[#d5e0e4] lg:flex">
        <Social72Logo onDark className="h-8" />
        <div className="max-w-md">
          <p className="font-display text-4xl leading-tight text-white">Clients, projects, campaigns, profit.</p>
          <p className="mt-5 text-sm leading-6 text-sidebar-muted">
            Onboard clients, projects and employees. Assign roles, run tasks, ad campaigns and budgets, work leads with
            outbound calling and nurture, then follow up POs, expenses, invoices and Social72 profit.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Internal · Social72 team</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <Social72Logo className="h-8" />
          </div>
          <h1 className="font-display text-3xl text-ink">Sign in</h1>
          <p className="mt-2 mb-6 text-sm text-ink-soft">Use the account issued by your administrator.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
