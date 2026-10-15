"use client";

import { useEffect, useState } from "react";
import { BellRing, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { PortalNotification } from "@/types/engagement";

const isReviewReminder = (item: PortalNotification) =>
  item.title.startsWith("Nhắc ôn tập:");

export function StudyReviewReminderPopup({
  notifications,
  onStartReview,
}: {
  notifications: PortalNotification[];
  onStartReview: (item: PortalNotification) => Promise<void>;
}) {
  const [current, setCurrent] = useState<PortalNotification | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (current) return;
    const next = notifications.find((item) =>
      !item.readAt &&
      isReviewReminder(item) &&
      sessionStorage.getItem(`estude:review-reminder-dismissed:${item.id}`) !== "1",
    );
    if (next) setCurrent(next);
  }, [current, notifications]);

  function dismiss() {
    if (current) sessionStorage.setItem(`estude:review-reminder-dismissed:${current.id}`, "1");
    setCurrent(null);
  }

  async function startReview() {
    if (!current) return;
    setStarting(true);
    try {
      await onStartReview(current);
      setCurrent(null);
    } finally {
      setStarting(false);
    }
  }

  return (
    <Modal
      open={current !== null}
      title={current?.title ?? "Nhắc ôn tập"}
      description="Một lời nhắc theo tiến độ ôn tập gần đây của bạn."
      onClose={dismiss}
      footer={(
        <>
          <Button variant="outline" onClick={dismiss}>Để sau</Button>
          <Button disabled={starting} onClick={() => void startReview()}>
            <BookOpen className="size-4" /> {starting ? "Đang mở" : "Ôn ngay"}
          </Button>
        </>
      )}
    >
      <div className="rounded-xl bg-brand-50 p-4 text-sm leading-6 text-slate-700">
        <BellRing className="mb-2 size-5 text-brand-600" />
        <p>{current?.message}</p>
      </div>
    </Modal>
  );
}
