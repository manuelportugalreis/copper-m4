"use client";

// Module 4: the Refund Console. Holds the refund state for the Support page:
// the auto-refund limit, each order's status and the refunds waiting for a
// person. The docked Ask Copper chat sends the limit and statuses with each
// question; when the app decides a refund, the console updates; when a person
// clicks Approve or Reject, the console posts the outcome into the chat.
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { AskCopper, type ChatNotice } from "@/components/copper/ask-copper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUsd } from "@/lib/copper/catalog";
import {
  applyDecision,
  CUSTOMER,
  newDesk,
  ORDERS,
  type OrderStatus,
  type RefundDecision,
  type RefundDesk,
} from "@/lib/copper/refunds";

const STATUS_LABELS: Record<OrderStatus, string> = {
  paid: "Paid",
  pending: "Waiting",
  refunded: "Refunded",
  rejected: "Refund declined",
};

const MAX_LIMIT_USD = 10_000;

export function RefundConsole({ aiConfigured }: { aiConfigured: boolean }) {
  const [desk, setDesk] = useState<RefundDesk>(newDesk);
  const [limitDraft, setLimitDraft] = useState(String(desk.limitUsd));
  const [notices, setNotices] = useState<ChatNotice[]>([]);

  const pending = ORDERS.filter((o) => desk.statuses[o.id] === "pending");

  function changeLimit(value: string) {
    setLimitDraft(value);
    const amount = Number(value);
    if (value.trim() !== "" && Number.isFinite(amount) && amount >= 0)
      setDesk((d) => ({ ...d, limitUsd: Math.min(amount, MAX_LIMIT_USD) }));
  }

  function onDecisions(decisions: RefundDecision[]) {
    setDesk((d) => decisions.reduce(applyDecision, d));
  }

  function decide(orderId: string, approve: boolean) {
    const order = ORDERS.find((o) => o.id === orderId);
    if (!order || desk.statuses[orderId] !== "pending") return;
    setDesk((d) => ({
      ...d,
      statuses: { ...d.statuses, [orderId]: approve ? "refunded" : "rejected" },
    }));
    const amount = formatUsd(order.amountUsd);
    const text = approve
      ? `Good news: a team member approved your refund for order #${order.id} (${order.item}, ${amount}). The ${amount} is on its way back to your original payment method.`
      : `Update on order #${order.id} (${order.item}, ${amount}): a team member reviewed your refund request and declined it, so no refund was issued and you have not been charged anything extra. If you have questions, contact the Copper Crew in the Copper app (Settings > Help).`;
    setNotices((all) => [
      ...all,
      { id: `${orderId}-${approve ? "approved" : "rejected"}`, text },
    ]);
  }

  return (
    <>
      <main
        data-testid="refund-console"
        className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8"
      >
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold">Refund Console</h1>
          <p className="text-muted-foreground text-sm">
            Ask for a refund in the chat as the customer. Copper hands you to
            the Refund agent, which asks the app for the refund. The app checks
            the amount against your limit: at or under it, the refund goes
            through; over it, it waits here for you.
          </p>
        </div>

        <section className="bg-card space-y-2 rounded-xl border p-4">
          <label htmlFor="refund-limit" className="text-sm font-semibold">
            Auto-refund limit
          </label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <input
              id="refund-limit"
              type="number"
              min={0}
              step={1}
              inputMode="decimal"
              value={limitDraft}
              onChange={(event) => changeLimit(event.target.value)}
              className="bg-background focus-visible:ring-ring h-9 w-32 rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Refunds up to {formatUsd(desk.limitUsd)} go through on their own.
            Anything larger needs your approval.
          </p>
        </section>

        <section className="space-y-3" data-testid="refund-queue">
          <h2 className="text-lg font-semibold">Waiting for your approval</h2>
          {pending.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border p-4 text-sm">
              Nothing is waiting. Refunds over the limit will stop here.
            </p>
          ) : (
            pending.map((order) => (
              <div
                key={order.id}
                className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    #{order.id} {order.item}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatUsd(order.amountUsd)} is over your{" "}
                    {formatUsd(desk.limitUsd)} limit
                  </p>
                </div>
                <Button size="sm" onClick={() => decide(order.id, true)}>
                  <CheckIcon /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => decide(order.id, false)}
                >
                  <XIcon /> Reject
                </Button>
              </div>
            ))
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{CUSTOMER}&apos;s orders</h2>
          <ul className="bg-card divide-y rounded-xl border">
            {ORDERS.map((order) => {
              const status = desk.statuses[order.id] ?? "paid";
              return (
                <li
                  key={order.id}
                  data-testid={`order-${order.id}`}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-muted-foreground font-mono">
                    #{order.id}
                  </span>
                  <span className="flex-1 font-medium">{order.item}</span>
                  <Badge
                    variant={
                      status === "refunded"
                        ? "default"
                        : status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {STATUS_LABELS[status]}
                  </Badge>
                  <span className="w-16 text-right font-mono">
                    {formatUsd(order.amountUsd)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </main>
      <AskCopper
        aiConfigured={aiConfigured}
        docked
        refunds={{ desk, onDecisions, notices }}
      />
    </>
  );
}
