export const SCORE_HOT = 20;

export const STATUS_SCORE_EVENTS: Record<string, string> = {
  INTERESTED: "interested",
  NOT_INTERESTED: "not_interested",
  DOCUMENTATION: "documentation_started",
  INVALID: "invalid",
  WRONG_NUMBER: "invalid",
  DO_NOT_CALL: "do_not_call",
  UNWANTED: "unwanted",
  NOT_AVAILABLE: "not_reachable",
};

export const SCORE_RULES = [
  { eventKey: "responded", points: 10, description: "Lead responded" },
  { eventKey: "interested", points: 10, description: "Interested" },
  { eventKey: "budget_confirmed", points: 15, description: "Budget confirmed" },
  { eventKey: "decision_maker_confirmed", points: 15, description: "Decision maker confirmed" },
  { eventKey: "visit_agreed", points: 10, description: "Site/campus visit agreed" },
  { eventKey: "visit_completed", points: 20, description: "Site/campus visit completed" },
  { eventKey: "documentation_started", points: 20, description: "Documentation started" },
  { eventKey: "not_reachable", points: -10, description: "Not reachable repeatedly" },
  { eventKey: "low_budget", points: -15, description: "Low budget" },
  { eventKey: "not_interested", points: -20, description: "Not interested" },
  { eventKey: "invalid", points: -30, description: "Invalid or wrong number" },
  { eventKey: "do_not_call", points: -25, description: "Asked not to call" },
  { eventKey: "unwanted", points: -25, description: "Unwanted / out of market" },
] as const;

export function scoreClass(value: number) {
  if (value >= SCORE_HOT) return "text-copper font-medium";
  if (value < 0) return "text-danger";
  return "text-ink-soft";
}
