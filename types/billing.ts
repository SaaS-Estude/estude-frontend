export type BillingCycle = "MONTH" | "YEAR";
export type BillingOrderStatus = "PENDING" | "PAID" | "CANCELLED" | "EXPIRED";
export type BillingFulfilment = "NONE" | "PENDING" | "DONE" | "FAILED";

export interface BillingQuote {
  kind: "RENEW" | "UPGRADE" | "NEW";
  listAmount: number;
  creditAmount: number;
  amount: number;
}

export interface BillingOffer {
  id: string;
  code: string;
  name: string;
  description: string;
  tier: number;
  limits: Record<string, number>;
  features: Record<string, boolean>;
  prices: Partial<Record<BillingCycle, number>>;
  quotes: Partial<Record<BillingCycle, BillingQuote>>;
  unavailable?: Partial<Record<BillingCycle, string>>;
}

export interface BillingSubscription {
  planCode: string;
  planName: string;
  tier: number;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";
  periodStart: string;
  periodEnd: string;
  active: boolean;
  daysLeft: number;
  limits: Record<string, number>;
}

export interface BillingOrder {
  orderCode: number;
  kind: "NEW" | "RENEW" | "UPGRADE";
  planCode: string;
  planName: string;
  cycle: BillingCycle;
  listAmount: number;
  creditAmount: number;
  amount: number;
  status: BillingOrderStatus;
  fulfilmentStatus: BillingFulfilment;
  checkoutUrl?: string;
  paidAt?: string;
  periodStart?: string;
  periodEnd?: string;
  expiresAt: string;
  createdAt: string;
}

export interface BillingInvoice {
  invoiceNo: string;
  orderCode: number;
  planName: string;
  cycle: BillingCycle;
  kind: "NEW" | "RENEW" | "UPGRADE";
  amount: number;
  creditAmount: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
}

export interface BillingOverview {
  subscription: BillingSubscription;
  offers: BillingOffer[];
  orders: BillingOrder[];
  invoices: BillingInvoice[];
  paymentsEnabled: boolean;
}

export interface BillingCreatedOrder {
  orderCode: number;
  checkoutUrl: string;
  amount: number;
  kind: string;
  expiresAt: string;
}
