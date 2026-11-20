// Module 4: the refund rule is code, so it is tested without a model.
import { describe, expect, it } from "vitest";
import {
  applyDecision,
  decideRefund,
  newDesk,
  ORDERS,
} from "@/lib/copper/refunds";

const desk = newDesk();
const small = ORDERS.find((o) => o.amountUsd <= desk.limitUsd)!;
const large = ORDERS.find((o) => o.amountUsd > desk.limitUsd)!;

describe("decideRefund", () => {
  it("refunds an order at or under the limit automatically", () => {
    expect(decideRefund(desk, small.id).outcome).toBe("refunded");
    const atLimit = { ...desk, limitUsd: small.amountUsd };
    expect(decideRefund(atLimit, small.id).outcome).toBe("refunded");
  });

  it("holds an order over the limit for a person", () => {
    expect(decideRefund(desk, `#${large.id}`).outcome).toBe("pending_approval");
  });

  it("follows the limit when it changes", () => {
    const high = { ...desk, limitUsd: large.amountUsd };
    expect(decideRefund(high, large.id).outcome).toBe("refunded");
  });

  it("never refunds twice, and respects a person's decision", () => {
    const refunded = applyDecision(desk, decideRefund(desk, small.id));
    expect(refunded.statuses[small.id]).toBe("refunded");
    expect(decideRefund(refunded, small.id).outcome).toBe("already_refunded");
    const pending = applyDecision(desk, decideRefund(desk, large.id));
    expect(decideRefund(pending, large.id).outcome).toBe("already_pending");
    const rejected = {
      ...desk,
      statuses: { ...desk.statuses, [large.id]: "rejected" as const },
    };
    expect(decideRefund(rejected, large.id).outcome).toBe("already_rejected");
  });

  it("reports an unknown order", () => {
    expect(decideRefund(desk, "9999").outcome).toBe("not_found");
  });

  it("does not change the desk it was given", () => {
    applyDecision(desk, decideRefund(desk, large.id));
    expect(desk.statuses[large.id]).toBe("paid");
  });
});
