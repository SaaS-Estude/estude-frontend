import type { OnlineSession } from "@/lib/online-sessions-api";
export const onlineStateLabels = { DRAFT: "Bản nháp", UPCOMING: "Sắp diễn ra", LIVE: "Đang diễn ra", ENDED: "Đã kết thúc", CANCELLED: "Đã hủy" };
export function onlineTime(value: string) { return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }); }
export function onlineLocalInput(value: string) { return new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16); }
export function onlineUTC(value: string) { return new Date(`${value}:00+07:00`).toISOString(); }
export function onlineLiveState(row: OnlineSession, now: number) {
  if (row.status !== "SCHEDULED") return row.status;
  return now >= Date.parse(row.endsAt) ? "ENDED" : now >= Date.parse(row.startsAt) ? "LIVE" : "UPCOMING";
}
export function canEnterOnline(row: OnlineSession, now: number) { return row.status === "SCHEDULED" && now >= Date.parse(row.joinOpensAt) && now < Date.parse(row.endsAt); }
