import type { BillingCycle, BillingOffer, BillingOrder, BillingQuote, BillingSubscription } from "@/types/billing";

export const formatVnd = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} ₫`;
export const cycleName = (cycle: BillingCycle) => (cycle === "YEAR" ? "1 năm" : "1 tháng");

export type OfferAction =
  | { kind: "renew"; label: string; quote: BillingQuote }
  | { kind: "upgrade"; label: string; quote: BillingQuote }
  | { kind: "blocked"; label: string };

/**
 * What a plan card offers for the chosen cycle. The label follows the quote the
 * server returned; a plan below the active one is never purchasable online.
 */
export function offerAction(offer: BillingOffer, cycle: BillingCycle, current: BillingSubscription): OfferAction {
  const quote = offer.quotes[cycle];
  if (!quote) {
    return { kind: "blocked", label: offer.unavailable?.[cycle] === "DOWNGRADE" ? "Liên hệ hỗ trợ để hạ gói" : "Không khả dụng" };
  }
  if (quote.kind === "RENEW") {
    return { kind: "renew", label: current.active ? `Gia hạn thêm ${cycleName(cycle)}` : `Kích hoạt lại ${cycleName(cycle)}`, quote };
  }
  return { kind: "upgrade", label: current.active ? "Nâng cấp ngay" : `Mua gói ${offer.name}`, quote };
}

/** "Giá 799.000 ₫ − khấu trừ 199.333 ₫ = 599.667 ₫", or just the price. */
export function quoteBreakdown(quote: BillingQuote) {
  if (quote.creditAmount <= 0) return formatVnd(quote.amount);
  return `${formatVnd(quote.listAmount)} − khấu trừ ${formatVnd(quote.creditAmount)} = ${formatVnd(quote.amount)}`;
}

/** True when the credit was capped by the list price (value carried over is lost). */
export function creditWasCapped(quote: BillingQuote, rawValueHint?: number) {
  if (quote.kind !== "UPGRADE") return false;
  if (rawValueHint !== undefined) return rawValueHint > quote.creditAmount && quote.creditAmount >= quote.listAmount;
  return quote.creditAmount >= quote.listAmount;
}

export type ExpiryLevel = "ok" | "soon" | "expired" | "trial";

export function expiryLevel(sub: BillingSubscription): ExpiryLevel {
  if (!sub.active) return "expired";
  if (sub.status === "TRIAL") return "trial";
  return sub.daysLeft <= 7 ? "soon" : "ok";
}

export function expiryMessage(sub: BillingSubscription): string {
  switch (expiryLevel(sub)) {
    case "expired":
      return "Gói đã hết hạn. Dữ liệu vẫn được giữ nguyên nhưng các tính năng dùng hạn mức (AI, email, tải tệp lên) tạm dừng cho đến khi gia hạn.";
    case "soon":
      return `Gói còn ${sub.daysLeft} ngày. Gia hạn sớm để không bị gián đoạn — thời gian còn lại được cộng dồn.`;
    case "trial":
      return `Đang dùng thử, còn ${sub.daysLeft} ngày. Chọn một gói để tiếp tục sử dụng.`;
    default:
      return "";
  }
}

export function orderStatusLabel(order: Pick<BillingOrder, "status" | "fulfilmentStatus">): string {
  if (order.status === "PAID") return order.fulfilmentStatus === "FAILED" ? "Đã thanh toán — cần hỗ trợ" : order.fulfilmentStatus === "DONE" ? "Đã kích hoạt" : "Đã thanh toán — đang kích hoạt";
  return { PENDING: "Chờ thanh toán", CANCELLED: "Đã huỷ", EXPIRED: "Hết hạn" }[order.status];
}

export const orderKindLabel = { NEW: "Mua mới", RENEW: "Gia hạn", UPGRADE: "Nâng cấp" } as const;

export function isSettled(order: Pick<BillingOrder, "status" | "fulfilmentStatus">) {
  if (order.status === "CANCELLED" || order.status === "EXPIRED") return true;
  return order.status === "PAID" && order.fulfilmentStatus !== "PENDING" && order.fulfilmentStatus !== "NONE";
}

export const maxPollAttempts = 20;
export const pollDelayMs = (attempt: number) => Math.min(8000, Math.round(1500 * 1.5 ** attempt));

/** Reads `orderCode` from a query string, ignoring anything that is not a plain positive integer. */
export function returnedOrderCode(search: string): number | null {
  const raw = new URLSearchParams(search).get("orderCode");
  if (!raw || !/^\d{1,16}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function newBillingKey(random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  return `bill-${Array.from(random(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const limitLabels: Record<string, string> = {
  storage_bytes: "Dung lượng lưu trữ",
  ai_tokens: "AI tokens mỗi tháng",
  email_messages: "Email mỗi tháng",
};
export function formatLimit(resource: string, value: number) {
  if (resource === "storage_bytes") return `${(value / 1024 ** 3).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} GB`;
  return value >= 1_000_000 ? `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu` : value.toLocaleString("vi-VN");
}
