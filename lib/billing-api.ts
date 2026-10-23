import { authenticatedRequest } from "@/lib/auth-api";
import type { BillingCreatedOrder, BillingCycle, BillingOrder, BillingOverview } from "@/types/billing";

export interface BillingContact {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

/** The price is never sent: the server prices the order from its catalogue. */
export const billingService = {
  overview: () => authenticatedRequest<BillingOverview>("/billing/overview", { cache: "no-store" }),
  createOrder: (planCode: string, cycle: BillingCycle, contact: BillingContact, idempotencyKey: string) =>
    authenticatedRequest<BillingCreatedOrder>("/billing/orders", {
      method: "POST",
      body: JSON.stringify({ planCode, cycle, idempotencyKey, ...contact }),
    }),
  order: (orderCode: number) =>
    authenticatedRequest<BillingOrder>(`/billing/orders/${orderCode}`, { cache: "no-store" }),
  cancel: (orderCode: number) =>
    authenticatedRequest<BillingOrder>(`/billing/orders/${orderCode}/cancel`, { method: "POST", body: "{}" }),
};
