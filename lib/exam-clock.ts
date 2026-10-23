// The exam deadline is enforced by the server clock, so the countdown must not
// trust the student's device clock: a fast clock would submit the attempt early
// and a slow one would keep accepting answers the server already rejects.

/** Server minus client time in ms; 0 when the server time is missing or invalid. */
export function clockOffsetMs(serverNow: string | null | undefined, clientNow: number): number {
  if (!serverNow) return 0;
  const server = Date.parse(serverNow);
  return Number.isFinite(server) ? server - clientNow : 0;
}

/** Deadline in epoch ms, falling back to start time plus duration. */
export function attemptDeadlineMs(attempt: {
  expiresAt?: string | null;
  startedAt: string;
  durationMinutes: number;
}): number {
  return attempt.expiresAt
    ? new Date(attempt.expiresAt).getTime()
    : new Date(attempt.startedAt).getTime() + attempt.durationMinutes * 60_000;
}

/** Whole seconds left, measured on the server's timeline. Never negative. */
export function secondsRemaining(deadlineMs: number, clientNow: number, offsetMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - (clientNow + offsetMs)) / 1000));
}
