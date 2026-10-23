const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./helpers/load-typescript.cjs');

const { clockOffsetMs, attemptDeadlineMs, secondsRemaining } = loadTypeScript('lib/exam-clock.ts');

const server = Date.parse('2026-10-22T08:00:00.000Z');
const deadline = server + 30 * 60_000;

test('offset is server minus device time', () => {
  assert.equal(clockOffsetMs('2026-10-22T08:00:00.000Z', server + 5 * 60_000), -5 * 60_000);
  assert.equal(clockOffsetMs('2026-10-22T08:00:00.000Z', server - 5 * 60_000), 5 * 60_000);
});

test('missing or invalid server time leaves the device clock untouched', () => {
  for (const value of [undefined, null, '', 'not-a-date']) {
    assert.equal(clockOffsetMs(value, Date.now()), 0);
  }
});

test('a device clock running 10 minutes fast does not end the exam early', () => {
  const device = server + 10 * 60_000;
  const offset = clockOffsetMs('2026-10-22T08:00:00.000Z', device);
  assert.equal(secondsRemaining(deadline, device, offset), 30 * 60);
  assert.equal(secondsRemaining(deadline, device, 0), 20 * 60, 'without correction 10 minutes are lost');
});

test('a device clock running 10 minutes slow does not extend the exam', () => {
  const device = server - 10 * 60_000;
  const offset = clockOffsetMs('2026-10-22T08:00:00.000Z', device);
  assert.equal(secondsRemaining(deadline, device, offset), 30 * 60);
  assert.equal(secondsRemaining(deadline, device, 0), 40 * 60, 'without correction 10 extra minutes appear');
});

test('countdown follows the corrected clock and reaches zero exactly at the server deadline', () => {
  const device = server + 3 * 60_000;
  const offset = clockOffsetMs('2026-10-22T08:00:00.000Z', device);
  assert.equal(secondsRemaining(deadline, device + 29 * 60_000 + 59_000, offset), 1);
  assert.equal(secondsRemaining(deadline, device + 30 * 60_000, offset), 0);
  assert.equal(secondsRemaining(deadline, device + 31 * 60_000, offset), 0, 'never negative');
});

test('deadline prefers server expiresAt and falls back to start plus duration', () => {
  assert.equal(
    attemptDeadlineMs({ expiresAt: '2026-10-22T08:30:00.000Z', startedAt: '2026-10-22T08:00:00.000Z', durationMinutes: 99 }),
    Date.parse('2026-10-22T08:30:00.000Z'),
  );
  assert.equal(
    attemptDeadlineMs({ expiresAt: null, startedAt: '2026-10-22T08:00:00.000Z', durationMinutes: 45 }),
    Date.parse('2026-10-22T08:45:00.000Z'),
  );
});
