"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, CreditCard, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { useActionNotification } from "@/components/ui/action-notification";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/auth-api";
import { billingService } from "@/lib/billing-api";
import {
  creditWasCapped,
  cycleName,
  expiryLevel,
  expiryMessage,
  formatLimit,
  formatVnd,
  isSettled,
  limitLabels,
  maxPollAttempts,
  newBillingKey,
  offerAction,
  orderKindLabel,
  orderStatusLabel,
  pollDelayMs,
  quoteBreakdown,
  returnedOrderCode,
} from "@/lib/billing-view";
import type { BillingCycle, BillingOrder, BillingOverview } from "@/types/billing";

const dateText = (value: string) => new Date(value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const dateTimeText = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const messageOf = (error: unknown) => (error instanceof ApiError || error instanceof Error ? error.message : "Không thể xử lý yêu cầu.");

type Banner = { tone: "ok" | "wait" | "bad"; text: string } | null;

export function BillingPanel() {
  const { user } = useAuth();
  const { notify } = useActionNotification();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("YEAR");
  const [contact, setContact] = useState({ contactName: user?.fullName ?? "", contactEmail: user?.email ?? "", contactPhone: user?.phoneNumber ?? "" });
  const [buying, setBuying] = useState("");
  const [banner, setBanner] = useState<Banner>(null);
  const keys = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setOverview(await billingService.overview());
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Coming back from PayOS: verify with the server (which asks PayOS), not the URL.
  useEffect(() => {
    const code = returnedOrderCode(window.location.search);
    if (!code) return;
    window.history.replaceState(null, "", window.location.pathname);
    let attempt = 0;
    let live = true;
    setBanner({ tone: "wait", text: "Đang xác nhận thanh toán với PayOS…" });
    const poll = async () => {
      let order: BillingOrder | null = null;
      try {
        order = await billingService.order(code);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setBanner({ tone: "bad", text: "Không tìm thấy đơn hàng này trong trường của bạn." });
          return;
        }
      }
      if (!live) return;
      if (order && isSettled(order)) {
        if (order.status === "PAID" && order.fulfilmentStatus === "DONE")
          setBanner({ tone: "ok", text: `Thanh toán thành công — gói ${order.planName} đã được kích hoạt${order.periodEnd ? ` đến ${dateText(order.periodEnd)}` : ""}.` });
        else if (order.status === "PAID") setBanner({ tone: "bad", text: `Đã nhận thanh toán đơn ${order.orderCode} nhưng chưa kích hoạt được tự động. Vui lòng liên hệ hỗ trợ kèm mã đơn.` });
        else setBanner({ tone: "bad", text: order.status === "CANCELLED" ? "Bạn đã huỷ thanh toán. Chưa có khoản tiền nào bị trừ." : "Đơn hàng đã hết hạn. Hãy tạo đơn mới." });
        void load();
        return;
      }
      if (attempt >= maxPollAttempts) {
        setBanner({ tone: "wait", text: "Chưa nhận được xác nhận thanh toán. Nếu bạn đã chuyển khoản, trạng thái sẽ tự cập nhật — bấm “Làm mới” sau ít phút." });
        void load();
        return;
      }
      timer.current = setTimeout(() => void poll(), pollDelayMs(attempt++));
    };
    void poll();
    return () => {
      live = false;
      clearTimeout(timer.current);
    };
  }, [load]);

  async function buy(planCode: string) {
    const key = `${planCode}:${cycle}`;
    keys.current[key] ??= newBillingKey();
    setBuying(planCode);
    try {
      const created = await billingService.createOrder(planCode, cycle, contact, keys.current[key]);
      window.location.assign(created.checkoutUrl);
    } catch (e) {
      notify(messageOf(e), { variant: "error" });
      if (e instanceof ApiError && e.status === 409) delete keys.current[key];
      setBuying("");
    }
  }
  async function cancel(order: BillingOrder) {
    try {
      await billingService.cancel(order.orderCode);
      notify("Đã huỷ đơn thanh toán");
    } catch (e) {
      notify(messageOf(e), { variant: "error" });
    }
    await load();
  }

  if (!overview) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-rose-700"><CircleAlert size={16} /> {error}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin" size={16} /> Đang tải thông tin gói…</p>
        )}
      </section>
    );
  }

  const { subscription: sub } = overview;
  const level = expiryLevel(sub);
  const contactReady = contact.contactName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.contactEmail.trim());
  const tone = { ok: "border-emerald-200 bg-emerald-50 text-emerald-800", wait: "border-amber-200 bg-amber-50 text-amber-800", bad: "border-rose-200 bg-rose-50 text-rose-800" };

  return (
    <div className="space-y-6">
      {banner && (
        <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${tone[banner.tone]}`}>
          {banner.tone === "ok" ? <CheckCircle2 size={18} className="mt-0.5" /> : banner.tone === "wait" ? <LoaderCircle size={18} className="mt-0.5 animate-spin" /> : <CircleAlert size={18} className="mt-0.5" />}
          <span>{banner.text}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" aria-labelledby="billing-current">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="billing-current" className="text-sm font-bold uppercase tracking-wide text-slate-500">Gói hiện tại</h2>
            <p className="mt-1 text-2xl font-black text-slate-900">{sub.planName}</p>
            <p className="mt-1 text-sm text-slate-600">
              {sub.active ? "Hiệu lực" : "Đã hết hạn"} đến <strong>{dateText(sub.periodEnd)}</strong>
              {sub.active && ` (còn ${sub.daysLeft} ngày)`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw size={14} /> Làm mới</Button>
        </div>
        {level !== "ok" && (
          <p role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${level === "expired" ? tone.bad : tone.wait}`}>{expiryMessage(sub)}</p>
        )}
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {Object.entries(sub.limits).map(([resource, value]) => (
            <div key={resource} className="rounded-xl bg-slate-50 px-4 py-3">
              <dt className="text-slate-500">{limitLabels[resource] ?? resource}</dt>
              <dd className="font-bold text-slate-900">{formatLimit(resource, value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" aria-labelledby="billing-buy">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="billing-buy" className="text-lg font-black text-slate-900">Gia hạn &amp; nâng cấp</h2>
          <div role="group" aria-label="Chu kỳ thanh toán" className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(["MONTH", "YEAR"] as const).map((value) => (
              <Button key={value} size="sm" variant={cycle === value ? "primary" : "ghost"} aria-pressed={cycle === value} onClick={() => setCycle(value)}>
                {value === "MONTH" ? "Theo tháng" : "Theo năm"}
              </Button>
            ))}
          </div>
        </div>
        {!overview.paymentsEnabled && (
          <p role="alert" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone.wait}`}>Thanh toán trực tuyến chưa được bật. Vui lòng liên hệ quản trị nền tảng để gia hạn.</p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input label="Họ tên người thanh toán" value={contact.contactName} maxLength={120} onChange={(e) => setContact({ ...contact, contactName: e.target.value })} />
          <Input label="Email nhận hoá đơn" type="email" value={contact.contactEmail} maxLength={254} onChange={(e) => setContact({ ...contact, contactEmail: e.target.value })} />
          <Input label="Số điện thoại (không bắt buộc)" type="tel" value={contact.contactPhone} maxLength={20} onChange={(e) => setContact({ ...contact, contactPhone: e.target.value })} />
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {overview.offers.map((offer) => {
            const action = offerAction(offer, cycle, sub);
            const current = offer.code === sub.planCode;
            return (
              <article key={offer.code} className={`flex flex-col rounded-2xl border p-5 ${current ? "border-brand-500 ring-2 ring-brand-500/15" : "border-slate-200"}`}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-slate-900">{offer.name}</h3>
                  {current && <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">Đang dùng</span>}
                </div>
                <p className="mt-1 min-h-[2.5rem] text-sm text-slate-500">{offer.description}</p>
                <p className="mt-3 text-2xl font-black text-slate-900">
                  {offer.prices[cycle] === undefined ? "—" : formatVnd(offer.prices[cycle] as number)}
                  <span className="text-sm font-medium text-slate-500"> / {cycleName(cycle)}</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">
                  {Object.entries(offer.limits).map(([resource, value]) => (
                    <li key={resource}>{formatLimit(resource, value)} · {(limitLabels[resource] ?? resource).toLowerCase()}</li>
                  ))}
                </ul>
                {action.kind !== "blocked" && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Thanh toán: <strong>{quoteBreakdown(action.quote)}</strong>
                    {action.kind === "upgrade" && creditWasCapped(action.quote) && (
                      <span className="mt-1 block text-amber-700">Giá trị còn lại của gói cũ lớn hơn giá gói này; chọn chu kỳ dài hơn để tận dụng trọn vẹn.</span>
                    )}
                  </p>
                )}
                <Button
                  className="mt-4 w-full"
                  variant={action.kind === "blocked" ? "outline" : current ? "primary" : "secondary"}
                  disabled={action.kind === "blocked" || !overview.paymentsEnabled || !contactReady || buying !== ""}
                  onClick={() => void buy(offer.code)}
                >
                  {buying === offer.code ? <LoaderCircle className="animate-spin" size={16} /> : <CreditCard size={16} />}
                  {action.label}
                </Button>
              </article>
            );
          })}
        </div>
        {!contactReady && <p className="mt-3 text-xs text-slate-500">Nhập họ tên và email hợp lệ để bật nút thanh toán.</p>}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm" aria-labelledby="billing-orders">
        <h2 id="billing-orders" className="text-lg font-black text-slate-900">Lịch sử thanh toán</h2>
        {overview.orders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Chưa có giao dịch nào.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-2 pr-3">Mã đơn</th>
                  <th scope="col" className="py-2 pr-3">Loại</th>
                  <th scope="col" className="py-2 pr-3">Gói</th>
                  <th scope="col" className="py-2 pr-3 text-right">Số tiền</th>
                  <th scope="col" className="py-2 pr-3">Trạng thái</th>
                  <th scope="col" className="py-2 pr-3">Ngày</th>
                  <th scope="col" className="py-2"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overview.orders.map((order) => (
                  <tr key={order.orderCode}>
                    <td className="py-2 pr-3 font-mono text-xs">{order.orderCode}</td>
                    <td className="py-2 pr-3">{orderKindLabel[order.kind]}</td>
                    <td className="py-2 pr-3">{order.planName} · {cycleName(order.cycle)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatVnd(order.amount)}</td>
                    <td className="py-2 pr-3">{orderStatusLabel(order)}</td>
                    <td className="py-2 pr-3 text-slate-500">{dateTimeText(order.createdAt)}</td>
                    <td className="py-2 text-right">
                      {order.status === "PENDING" && order.checkoutUrl && (
                        <span className="inline-flex gap-2">
                          <a className="text-sm font-bold text-brand-700 hover:underline" href={order.checkoutUrl}>Thanh toán</a>
                          <Button variant="ghost" size="sm" onClick={() => void cancel(order)}>Huỷ</Button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {overview.invoices.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">Hoá đơn</h3>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {overview.invoices.map((invoice) => (
                <li key={invoice.invoiceNo} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><strong>{invoice.invoiceNo}</strong> · {invoice.planName} ({cycleName(invoice.cycle)}) · {dateText(invoice.periodStart)} – {dateText(invoice.periodEnd)}</span>
                  <span className="font-semibold">{formatVnd(invoice.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
