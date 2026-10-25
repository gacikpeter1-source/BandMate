// The current band's limits and usage, readable from plain (non-React) code such as lib/ops.ts and
// lib/images.ts. BandDataProvider keeps it up to date.
import { tr } from "../i18n";
import { EMPTY_USAGE, limitsOf, type Limits, type Usage } from "./plans";

let state: { limits: Limits; usage: Usage } = { limits: limitsOf(null), usage: EMPTY_USAGE };
export const setPlanState = (limits: Limits, usage: Usage) => {
  state = { limits, usage };
};
export const getPlanState = () => state;

/** Thrown when an action would go over the plan. The message is already translated; the screens show
 *  it next to an "Extend?" button. */
export class LimitError extends Error {
  kind: "items" | "space" | "users";
  constructor(kind: "items" | "space" | "users", message: string) {
    super(message);
    this.kind = kind;
  }
}

export function assertItemRoom(n: number) {
  const { limits, usage } = state;
  if (usage.items + n > limits.items) throw new LimitError("items", tr("limit.items", { max: limits.items }));
}
export function assertSpaceRoom(bytes: number) {
  const { limits, usage } = state;
  if (usage.bytes + bytes > limits.bytes) throw new LimitError("space", tr("limit.space", { max: Math.round(limits.bytes / (1024 * 1024)) }));
}
export function assertUserRoom() {
  const { limits, usage } = state;
  if (usage.members + 1 > limits.users) throw new LimitError("users", tr("limit.users", { max: limits.users }));
}
