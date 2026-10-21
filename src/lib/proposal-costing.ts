import { round2 } from "@/lib/money";

export const PROPOSAL_STREAMS = [
  { key: "digital_marketing", label: "Digital Marketing" },
  { key: "website", label: "Website development" },
  { key: "outbound", label: "Outbound calls" },
  { key: "nurture", label: "Nurturing" },
] as const;

export type ProposalStreamKey = (typeof PROPOSAL_STREAMS)[number]["key"];

export type ProposalStream = {
  key: ProposalStreamKey | string;
  adBudget: number;
  manDays: number;
  toolCharges: number;
  serviceCharges: number;
};

export type ProposalCosting = {
  manDayRate: number;
  discountPct: number;
  discountAmt: number;
  streams: ProposalStream[];
};

export function emptyProposalCosting(): ProposalCosting {
  return {
    manDayRate: 4000,
    discountPct: 0,
    discountAmt: 0,
    streams: PROPOSAL_STREAMS.map((s) => ({
      key: s.key,
      adBudget: 0,
      manDays: 0,
      toolCharges: 0,
      serviceCharges: 0,
    })),
  };
}

export function streamLabel(key: string) {
  return PROPOSAL_STREAMS.find((s) => s.key === key)?.label ?? key;
}

export function normalizeCosting(input?: Partial<ProposalCosting> | null): ProposalCosting {
  const base = emptyProposalCosting();
  if (!input) return base;
  const byKey = new Map((input.streams ?? []).map((s) => [s.key, s]));
  return {
    manDayRate: Number(input.manDayRate ?? base.manDayRate) || 0,
    discountPct: Number(input.discountPct ?? 0) || 0,
    discountAmt: Number(input.discountAmt ?? 0) || 0,
    streams: base.streams.map((stream) => {
      const row = byKey.get(stream.key);
      return {
        key: stream.key,
        adBudget: Number(row?.adBudget ?? 0) || 0,
        manDays: Number(row?.manDays ?? 0) || 0,
        toolCharges: Number(row?.toolCharges ?? 0) || 0,
        serviceCharges: Number(row?.serviceCharges ?? 0) || 0,
      };
    }),
  };
}

export function proposalCommercialLines(costing: ProposalCosting) {
  const lines: Array<{ description: string; qty: number; rate: number; amount: number }> = [];
  for (const stream of costing.streams) {
    const label = streamLabel(stream.key);
    if (stream.serviceCharges > 0) {
      lines.push({
        description: `${label} — service charges`,
        qty: 1,
        rate: round2(stream.serviceCharges),
        amount: round2(stream.serviceCharges),
      });
    }
    if (stream.adBudget > 0) {
      lines.push({
        description: `${label} — ad budget`,
        qty: 1,
        rate: round2(stream.adBudget),
        amount: round2(stream.adBudget),
      });
    }
    if (stream.toolCharges > 0) {
      lines.push({
        description: `${label} — tool charges`,
        qty: 1,
        rate: round2(stream.toolCharges),
        amount: round2(stream.toolCharges),
      });
    }
  }
  return lines;
}

export function proposalInternals(costing: ProposalCosting) {
  const plannedAd = round2(costing.streams.reduce((s, r) => s + r.adBudget, 0));
  const plannedTools = round2(costing.streams.reduce((s, r) => s + r.toolCharges, 0));
  const manDays = costing.streams.reduce((s, r) => s + r.manDays, 0);
  const plannedPeople = round2(manDays * (costing.manDayRate || 0));
  const plannedVendor = 0;
  const service = round2(costing.streams.reduce((s, r) => s + r.serviceCharges, 0));
  return { plannedAd, plannedTools, plannedPeople, plannedVendor, manDays, service };
}

export function applyProposalDiscount(gross: number, costing: ProposalCosting) {
  const fromPct = costing.discountPct > 0 ? round2(gross * (costing.discountPct / 100)) : 0;
  const discountAmt = round2(Math.max(costing.discountAmt || 0, fromPct));
  const taxable = round2(Math.max(0, gross - discountAmt));
  return { gross: round2(gross), discountAmt, taxable };
}

export function parseCostingJson(raw: unknown): ProposalCosting | null {
  if (!raw) return null;
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizeCosting(value as ProposalCosting);
  } catch {
    return null;
  }
}
