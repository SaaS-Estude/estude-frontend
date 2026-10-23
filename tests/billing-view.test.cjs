require('./helpers/register-ui.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const view = require('../lib/billing-view.ts');
const api = require('../lib/billing-api.ts');

const sub = (over = {}) => ({ planCode: 'basic', planName: 'Cơ bản', tier: 1, status: 'ACTIVE', periodStart: '2026-01-01', periodEnd: '2026-02-01', active: true, daysLeft: 20, limits: {}, ...over });
const offer = (over = {}) => ({ id: '1', code: 'standard', name: 'Tiêu chuẩn', description: '', tier: 2, limits: {}, features: {}, prices: { MONTH: 799000 }, quotes: {}, ...over });
const quote = (over = {}) => ({ kind: 'UPGRADE', listAmount: 799000, creditAmount: 199000, amount: 600000, ...over });

test('plan cards follow the server quote and never offer a downgrade', () => {
  assert.deepEqual(view.offerAction(offer({ quotes: { MONTH: quote() } }), 'MONTH', sub()), { kind: 'upgrade', label: 'Nâng cấp ngay', quote: quote() });
  const renew = view.offerAction(offer({ code: 'basic', quotes: { MONTH: quote({ kind: 'RENEW', creditAmount: 0, amount: 799000 }) } }), 'MONTH', sub());
  assert.equal(renew.kind, 'renew');
  assert.match(renew.label, /Gia hạn thêm 1 tháng/);
  assert.match(view.offerAction(offer({ code: 'basic', quotes: { YEAR: quote({ kind: 'RENEW' }) } }), 'YEAR', sub({ active: false })).label, /Kích hoạt lại 1 năm/);
  const blocked = view.offerAction(offer({ quotes: {}, unavailable: { MONTH: 'DOWNGRADE' } }), 'MONTH', sub());
  assert.equal(blocked.kind, 'blocked');
  assert.match(blocked.label, /hạ gói/);
  assert.equal(view.offerAction(offer({ quotes: {} }), 'YEAR', sub()).kind, 'blocked');
});

test('the upgrade price is shown as list price minus credit', () => {
  assert.equal(view.quoteBreakdown(quote({ creditAmount: 0, amount: 799000 })), view.formatVnd(799000));
  const text = view.quoteBreakdown(quote());
  assert.match(text, /khấu trừ/);
  assert.ok(text.includes(view.formatVnd(600000)));
  assert.equal(view.creditWasCapped(quote({ creditAmount: 799000, amount: 2000 })), true);
  assert.equal(view.creditWasCapped(quote()), false);
  assert.equal(view.creditWasCapped(quote({ kind: 'RENEW', creditAmount: 0 })), false);
});

test('expiry warnings: expired, soon, trial, healthy', () => {
  assert.equal(view.expiryLevel(sub({ active: false, status: 'EXPIRED', daysLeft: 0 })), 'expired');
  assert.equal(view.expiryLevel(sub({ daysLeft: 7 })), 'soon');
  assert.equal(view.expiryLevel(sub({ daysLeft: 8 })), 'ok');
  assert.equal(view.expiryLevel(sub({ status: 'TRIAL' })), 'trial');
  assert.match(view.expiryMessage(sub({ active: false, daysLeft: 0 })), /hết hạn/);
  assert.match(view.expiryMessage(sub({ daysLeft: 3 })), /còn 3 ngày/);
  assert.equal(view.expiryMessage(sub()), '');
});

test('order labels and settlement', () => {
  const o = (status, fulfilmentStatus) => ({ status, fulfilmentStatus });
  assert.equal(view.orderStatusLabel(o('PENDING', 'NONE')), 'Chờ thanh toán');
  assert.equal(view.orderStatusLabel(o('PAID', 'DONE')), 'Đã kích hoạt');
  assert.match(view.orderStatusLabel(o('PAID', 'FAILED')), /cần hỗ trợ/);
  assert.equal(view.isSettled(o('PAID', 'PENDING')), false);
  assert.equal(view.isSettled(o('PENDING', 'NONE')), false);
  for (const s of [o('PAID', 'DONE'), o('PAID', 'FAILED'), o('CANCELLED', 'NONE'), o('EXPIRED', 'NONE')]) assert.equal(view.isSettled(s), true);
});

test('only a plain order code is trusted from the return URL', () => {
  assert.equal(view.returnedOrderCode('?orderCode=1792679969783315&code=00&status=PAID'), 1792679969783315);
  for (const bad of ['', '?orderCode=', '?orderCode=abc', '?orderCode=-4', '?orderCode=0', '?orderCode=1e9', '?orderCode=99999999999999999']) assert.equal(view.returnedOrderCode(bad), null, bad);
});

test('polling backs off, billing keys are random hex', () => {
  assert.equal(view.pollDelayMs(0), 1500);
  assert.equal(view.pollDelayMs(40), 8000);
  const a = view.newBillingKey(), b = view.newBillingKey();
  assert.notEqual(a, b);
  assert.match(a, /^bill-[0-9a-f]{32}$/);
});

test('limits are formatted for people', () => {
  assert.equal(view.formatLimit('storage_bytes', 5 * 1024 ** 3), '5 GB');
  assert.match(view.formatLimit('ai_tokens', 5000000), /5 triệu/);
  assert.equal(view.formatLimit('email_messages', 5000), (5000).toLocaleString('vi-VN'));
});

test('the order request carries no price field', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../lib/billing-api.ts'), 'utf8');
  assert.ok(!/amount|price/i.test(source.replace(/The price is never sent[^\n]*/, '')), 'billing-api must not send amounts');
  assert.ok(source.includes('idempotencyKey'));
  assert.equal(typeof api.billingService.createOrder, 'function');
});
