"use client";

import { Bell, BellRing, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PortalNotification } from "@/types/engagement";

function isSameLocalDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function timeLabel(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa rõ thời gian";
  const time = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  if (isSameLocalDate(date, now)) return `Hôm nay, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDate(date, yesterday)) return `Hôm qua, ${time}`;
  const day = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    ...(date.getFullYear() === now.getFullYear()
      ? {}
      : { year: "numeric" as const }),
  }).format(date);
  return `${day}, ${time}`;
}

export function StudentNotificationPopup({
  open,
  notifications,
  onClose,
  onOpenNotification,
}: {
  open: boolean;
  notifications: PortalNotification[];
  onClose: () => void;
  onOpenNotification: (item: PortalNotification) => Promise<void>;
}) {
  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return (
    <Modal
      open={open}
      title="Thông báo"
      description={
        unreadCount
          ? `Bạn có ${unreadCount} thông báo chưa đọc.`
          : "Bạn đã đọc tất cả thông báo."
      }
      onClose={onClose}
      width="max-w-xl"
    >
      {notifications.length ? (
        <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
          {notifications.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-3 transition ${item.readAt ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50/60"}`}
            >
              <div className="flex items-start gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.readAt ? "bg-slate-100 text-slate-500" : "bg-brand-600 text-white"}`}>
                  {item.readAt ? <Bell className="size-4" /> : <BellRing className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h3 className="line-clamp-2 font-bold leading-5 text-slate-900">{item.title}</h3>
                    <time
                      dateTime={item.createdAt}
                      title={new Date(item.createdAt).toLocaleString("vi-VN")}
                      className="shrink-0 text-xs font-medium text-slate-400"
                    >
                      {timeLabel(item.createdAt)}
                    </time>
                  </div>
                  <p
                    className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-5 text-slate-600"
                    title={item.message}
                  >
                    {item.message}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Từ {item.senderName}</span>
                    <Button
                      size="sm"
                      variant={item.readAt ? "outline" : "primary"}
                      className="h-8 shrink-0 px-2.5"
                      onClick={() => void onOpenNotification(item)}
                    >
                      {item.actionUrl || item.examId ? "Xem" : "Đánh dấu đã đọc"}
                      <ChevronRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <div>
            <Bell className="mx-auto size-6 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-slate-600">Bạn chưa có thông báo nào.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
