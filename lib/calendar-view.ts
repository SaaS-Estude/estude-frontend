import type { CalendarEvent } from "@/types/calendar";

export const calendarZone =
  process.env.NEXT_PUBLIC_CALENDAR_TIME_ZONE || "Asia/Ho_Chi_Minh";

export function calendarDay(value: Date, zone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(value).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function calendarMonth(month: string) {
  const [year, number] = month.split("-").map(Number);
  const from = `${month}-01`;
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const to = `${month}-${String(last).padStart(2, "0")}`;
  const offset = (new Date(`${from}T12:00:00Z`).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: Math.ceil((offset + last) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > last ? null : `${month}-${String(day).padStart(2, "0")}`;
  });
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  return { from, to, weeks };
}

export function shiftCalendarMonth(month: string, amount: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7);
}

export function calendarTime(value: string, zone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

// Exam windows can span several days; their ending instant is exclusive.
export function calendarEventTime(event: CalendarEvent, day: string, zone: string) {
  const start = calendarDay(new Date(event.startAt), zone);
  const end = event.endAt
    ? calendarDay(new Date(new Date(event.endAt).getTime() - 1), zone)
    : start;
  if (day < start || day > end) return null;
  return day === start ? calendarTime(event.startAt, zone) : "00:00";
}
