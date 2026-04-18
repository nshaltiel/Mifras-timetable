export const CONSTRAINT = {
  UNAVAILABLE: "UNAVAILABLE",
  AVOID: "AVOID",
  PREFER: "PREFER",
} as const;

export type ConstraintType = (typeof CONSTRAINT)[keyof typeof CONSTRAINT];

export const isHardConstraint = (t: string) => t === CONSTRAINT.UNAVAILABLE;
