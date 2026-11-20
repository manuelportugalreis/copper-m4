// Module 4: refunds. The customer's orders, and the rule that decides what
// happens to a refund request. The rule is plain code, not the model: at or
// under the auto-refund limit the money goes back on its own; over it, the
// refund waits in the Refund Console for a person to Approve or Reject.
// No server-only imports here, so the Refund Console (a client component)
// can use the same orders and rule.
import { getPlans, getProducts } from "@/lib/copper/catalog";

export type Order = {
  id: string;
  item: string;
  amountUsd: number;
  date: string;
};

/** paid → refunded (auto or approved), or paid → pending → refunded / rejected. */
export type OrderStatus = "paid" | "pending" | "refunded" | "rejected";

/** What the Refund agent's tools can see: the limit and each order's status. */
export type RefundDesk = {
  limitUsd: number;
  statuses: Record<string, OrderStatus>;
};

export type RefundOutcome =
  | "refunded"
  | "pending_approval"
  | "already_refunded"
  | "already_pending"
  | "already_rejected"
  | "not_found";

export type RefundDecision = {
  orderId: string;
  item: string;
  amountUsd: number;
  limitUsd: number;
  outcome: RefundOutcome;
  /** One plain sentence for the Refund agent (and the tool card). */
  message: string;
};

export const CUSTOMER = "Maya Reyes";

/** The default auto-refund limit, in dollars. */
export const DEFAULT_LIMIT_USD = 50;

const price = (id: string) => getProducts().find((p) => p.id === id)!.priceUsd;
const plus = getPlans().find((p) => p.id === "copper-plus")!;

/** The signed-in customer's orders, with prices read from the catalog. */
export const ORDERS: Order[] = [
  {
    id: "1001",
    item: "Copper Plus, monthly",
    amountUsd: plus.monthlyUsd,
    date: "2026-11-02",
  },
  {
    id: "1002",
    item: "Copper Plus, annual",
    amountUsd: plus.annualUsd,
    date: "2026-10-18",
  },
  {
    id: "1003",
    item: "Copper Notes",
    amountUsd: price("copper-notes"),
    date: "2026-10-30",
  },
  {
    id: "1004",
    item: "Copper Home",
    amountUsd: price("copper-home"),
    date: "2026-11-08",
  },
];

/** A new desk: every order paid, the default limit. */
export function newDesk(): RefundDesk {
  return {
    limitUsd: DEFAULT_LIMIT_USD,
    statuses: Object.fromEntries(ORDERS.map((o) => [o.id, "paid"])),
  };
}

/** "#1003", "1003" or " #1003 " → "1003". */
export function normalizeOrderId(id: string): string {
  return id.replace(/[^0-9]/g, "");
}

/**
 * The refund rule (code, not AI): at or under the limit → refunded now;
 * over it → waits for a person. Already-handled orders are not refunded twice.
 */
export function decideRefund(desk: RefundDesk, rawId: string): RefundDecision {
  const order = ORDERS.find((o) => o.id === normalizeOrderId(rawId));
  const limitUsd = desk.limitUsd;
  if (!order)
    return {
      orderId: rawId,
      item: "",
      amountUsd: 0,
      limitUsd,
      outcome: "not_found",
      message: `There is no order ${rawId} for ${CUSTOMER}.`,
    };
  const base = {
    orderId: order.id,
    item: order.item,
    amountUsd: order.amountUsd,
    limitUsd,
  };
  const status = desk.statuses[order.id] ?? "paid";
  if (status === "refunded")
    return {
      ...base,
      outcome: "already_refunded",
      message: `Order #${order.id} was already refunded.`,
    };
  if (status === "pending")
    return {
      ...base,
      outcome: "already_pending",
      message: `Order #${order.id} is already waiting for a person to approve it.`,
    };
  if (status === "rejected")
    return {
      ...base,
      outcome: "already_rejected",
      message: `A person already reviewed order #${order.id} and declined the refund.`,
    };
  if (order.amountUsd <= limitUsd)
    return {
      ...base,
      outcome: "refunded",
      message: `Refunded automatically: $${order.amountUsd} is within the $${limitUsd} auto-refund limit.`,
    };
  return {
    ...base,
    outcome: "pending_approval",
    message: `Waiting for approval: $${order.amountUsd} is over the $${limitUsd} auto-refund limit, so a person must approve it in the Refund Console.`,
  };
}

/** The desk after a decision: the order's new status, as a new object. */
export function applyDecision(
  desk: RefundDesk,
  decision: RefundDecision,
): RefundDesk {
  const next: OrderStatus | null =
    decision.outcome === "refunded"
      ? "refunded"
      : decision.outcome === "pending_approval"
        ? "pending"
        : null;
  if (!next) return desk;
  return { ...desk, statuses: { ...desk.statuses, [decision.orderId]: next } };
}
