// What each plan includes. These numbers are also written into firestore.rules and storage.rules
// (search for "PLAN LIMITS"), so change them in all three places together.
import type { BandInfo } from "../state/tenant";

export type Plan = "free" | "paid";

export const MB = 1024 * 1024;
/** One add-on pack: this much extra picture space, bought as often as needed. */
export const EXTRA_PACK_MB = 150;

export const PLAN_LIMITS: Record<Plan, { items: number; mb: number; users: number; design: boolean; domain: boolean }> = {
  free: { items: 100, mb: 50, users: 1, design: false, domain: false },
  paid: { items: 200, mb: 150, users: 3, design: true, domain: true },
};

/** Euro per month, Stripe's fee included. Shown in the plan table. */
export const PRICE_PAID = 2;
export const PRICE_PACK = 2;

/** Online payment is not connected yet (needs Stripe). Until it is, Paid and extra space can only be
 *  switched on by the BandMate operator in the console, and the sign-up form offers Free only. */
export const PAID_CHECKOUT_ENABLED = false;

export interface Limits {
  plan: Plan;
  items: number;
  /** Picture space in bytes, including add-on packs. */
  bytes: number;
  users: number;
  design: boolean;
  domain: boolean;
}

export function limitsOf(band: Pick<BandInfo, "plan" | "extraPacks"> | null | undefined): Limits {
  const plan: Plan = band?.plan === "paid" ? "paid" : "free";
  const l = PLAN_LIMITS[plan];
  const packs = Math.max(0, Math.floor(Number(band?.extraPacks) || 0));
  return { plan, items: l.items, bytes: (l.mb + packs * EXTRA_PACK_MB) * MB, users: l.users, design: l.design, domain: l.domain };
}

/** What a band has used so far (settings/usage). Kept up to date by the app on every change. */
export interface Usage {
  items: number;
  bytes: number;
  /** Members plus invitations still waiting to be accepted. */
  members: number;
}

export const EMPTY_USAGE: Usage = { items: 0, bytes: 0, members: 0 };

export const mbText = (bytes: number) => (Math.max(0, bytes) / MB).toFixed(1).replace(/\.0$/, "");
