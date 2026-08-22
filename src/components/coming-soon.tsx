export function ComingSoon({ title, phase, summary }: { title: string; phase: number; summary: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-soft">Phase {phase}</p>
      <h1 className="mt-2 font-display text-4xl text-ink">{title}</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-ink-soft">{summary}</p>
      <div className="mt-8 rounded-lg border border-dashed border-line bg-paper-2 px-5 py-8 text-sm text-ink-soft">
        This module is scheduled after the foundation. Navigation is in place so the
        floor layout stays stable as later phases land.
      </div>
    </div>
  );
}
