/** Subscription plan tier slug — admins can create custom tiers, so this is free-form text. */
export type PlanTier = string;

export interface PlanLimits {
  /** Max menu items allowed (null = unlimited) */
  maxMenuItems: number | null;
  /** Max branches allowed */
  maxBranches: number | null;
  /** Max staff members allowed */
  maxStaff: number | null;
  /** Whether accounting suite is unlocked */
  accounting: boolean;
  /** Whether loyalty program is unlocked */
  loyalty: boolean;
  /** Whether promotions/marketing tools are unlocked */
  promotions: boolean;
  /** Whether multi-floor / floor plans are unlocked */
  floorPlans: boolean;
  /** Whether the restaurant can attach a custom domain */
  customDomain: boolean;
  /** Whether the operations suite (orders, POS, kitchen, billing, tables, reservations) is unlocked */
  operations: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxMenuItems: 50,
    maxBranches: 1,
    maxStaff: 3,
    accounting: false,
    loyalty: false,
    promotions: false,
    floorPlans: false,
    customDomain: false,
    operations: false,
  },
  pro: {
    maxMenuItems: null,
    maxBranches: 3,
    maxStaff: 25,
    accounting: true,
    loyalty: true,
    promotions: true,
    floorPlans: true,
    customDomain: true,
    operations: true,
  },
  enterprise: {
    maxMenuItems: null,
    maxBranches: null,
    maxStaff: null,
    accounting: true,
    loyalty: true,
    promotions: true,
    floorPlans: true,
    customDomain: true,
    operations: true,
  },
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_PRICES: Record<PlanTier, string> = {
  free: '$0',
  pro: '$49/mo',
  enterprise: 'Custom',
};
