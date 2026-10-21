export const LIFECYCLE_ENTITIES = ["client", "campaign", "engagement", "project", "lead", "employee"] as const;
export type LifecycleEntity = (typeof LIFECYCLE_ENTITIES)[number];
