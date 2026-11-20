// Module 4: the Refund agent. A second agent, with its own instructions and
// its own tools, that Copper hands refund requests to. It finds the order and
// asks the app for the refund; the app's code (decideRefund) decides whether
// the money goes back now or waits for a person in the Refund Console.
import { stepCountIs, tool } from "ai";
import { z } from "zod";
import { callText } from "@/lib/ai/call";
import {
  applyDecision,
  CUSTOMER,
  decideRefund,
  ORDERS,
  type RefundDecision,
  type RefundDesk,
} from "@/lib/copper/refunds";

export const REFUND_AGENT_INSTRUCTIONS = `You are the Refund agent for Copper State Labs. Copper, the shopping assistant, hands you refund requests from ${CUSTOMER}, the signed-in customer.
1. Always call get_orders first to see her orders and their status.
2. Work out which order she wants refunded from what she said (product, plan, amount or order number). If it clearly matches exactly one order, call request_refund for it. If it matches none, or several, don't guess: say which orders she has and ask which one.
3. Never decide the outcome yourself and never promise a refund. The app decides: request_refund returns the outcome. Report exactly what it says.
Reply in one or two short, plain sentences for Copper to pass on: the order number, item, amount and outcome. If it is waiting for approval, say a team member will review it in the Refund Console and the customer will hear back here.`;

export type RefundAgentStep = { tool: string; input: unknown; output: unknown };

export type RefundAgentResult = {
  /** The Refund agent's answer, for Copper to pass on. */
  reply: string;
  /** Every refund the app decided during this hand-off. */
  decisions: RefundDecision[];
  /** The Refund agent's own tool calls, for the tool card. */
  steps: RefundAgentStep[];
};

const MAX_STEPS = 4;

/** Runs the Refund agent on one request, against the current desk. */
export async function runRefundAgent(
  request: string,
  startDesk: RefundDesk,
): Promise<RefundAgentResult> {
  let desk = startDesk;
  const decisions: RefundDecision[] = [];
  const tools = {
    get_orders: tool({
      description: `Lists ${CUSTOMER}'s orders with amount and refund status.`,
      inputSchema: z.object({}),
      execute: async () => ({
        customer: CUSTOMER,
        orders: ORDERS.map((o) => ({
          orderId: o.id,
          item: o.item,
          amountUsd: o.amountUsd,
          date: o.date,
          status: desk.statuses[o.id] ?? "paid",
        })),
      }),
    }),
    request_refund: tool({
      description:
        "Asks the app to refund one order. The app checks the amount against the auto-refund limit and returns the outcome.",
      inputSchema: z.object({
        orderId: z.string().describe("The order number, e.g. '1003'."),
        reason: z.string().describe("The customer's reason, in a few words."),
      }),
      execute: async ({ orderId }) => {
        const decision = decideRefund(desk, orderId);
        desk = applyDecision(desk, decision);
        decisions.push(decision);
        return decision;
      },
    }),
  };

  const result = await callText(
    { module: 4, feature: "refund-agent" },
    {
      system: REFUND_AGENT_INSTRUCTIONS,
      prompt: `Request from Copper: ${request}`,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    },
  );

  const steps = result.steps.flatMap((step) =>
    step.toolResults.map((r) => ({
      tool: r.toolName,
      input: r.input,
      output: r.output,
    })),
  );
  return {
    reply: result.text.trim() || "The Refund agent couldn't finish that.",
    decisions,
    steps,
  };
}
