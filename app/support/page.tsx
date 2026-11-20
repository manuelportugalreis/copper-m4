import type { Metadata } from "next";
import { RefundConsole } from "@/components/copper/refund-console";
import { SiteHeader } from "@/components/copper/site-header";
import { isAiConfigured } from "@/lib/ai/call";

export const metadata: Metadata = { title: "Support | Copper State Labs" };

export default function Support() {
  return (
    // Leaves room on the right for the docked chat.
    <div className="flex flex-1 flex-col lg:pr-[28rem]">
      <SiteHeader />
      <RefundConsole aiConfigured={isAiConfigured()} />
    </div>
  );
}
