"use client";

import { useState } from "react";
import { notificationService } from "@/lib/engagement-api";
import { Button } from "@/components/ui/button";
import { Select, Input, Textarea } from "@/components/ui/form-control";


export function AttendancePolicyPanel() {
  return <section className="mx-auto max-w-4xl space-y-4 rounded-2xl border bg-white p-6">
    <h1 className="text-2xl font-bold">Quản lý điểm danh</h1>
    <p>Ngày học dùng múi giờ Asia/Ho_Chi_Minh. Giáo viên được phân công quản lý từng buổi trong trang Điểm danh.</p>
    <ul className="list-disc space-y-2 pl-5 text-sm">
      <li>Danh sách học sinh được chốt khi tạo buổi; thay đổi ghi danh không làm mất lịch sử.</li>
      <li>Phải điểm danh đủ học sinh trước khi chốt. Mở lại và sửa sau chốt cần lý do, được lưu vào nhật ký.</li>
      <li>Dữ liệu thay đổi ở tab khác yêu cầu tải lại trước khi lưu.</li>
      <li>Không thể hoàn thành hoặc khóa học kỳ khi còn buổi chưa chốt. Học kỳ đã khóa không nhận chỉnh sửa.</li>
    </ul>
    <a className="inline-block text-blue-700 underline" href="/admin/course-offerings">Quản lý phân công giáo viên</a>
  </section>;
}

export function SystemNotificationComposer() {
  const [targetRole, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  return <section className="mx-auto mb-6 max-w-4xl space-y-4 rounded-2xl border bg-white p-6">
    <h1 className="text-2xl font-bold">Gửi thông báo hệ thống</h1>
    <form className="grid gap-3" onSubmit={async (event) => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setResult(""); setError("");
      try {
        const sent = await notificationService.broadcast({ targetRole: targetRole ? targetRole as "TEACHER" | "STUDENT" | "PARENT" : undefined, title, message });
        setResult(`Đã gửi đến ${sent.recipientCount} tài khoản.`); setTitle(""); setMessage("");
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể gửi thông báo"); }
      finally { setBusy(false); }
    }}>
      <label className="grid gap-1">Người nhận<Select className="rounded border p-2" value={targetRole} onChange={(event) => setRole(event.target.value)} disabled={busy}>
        <option value="">Tất cả tài khoản đang hoạt động</option><option value="TEACHER">Giáo viên</option><option value="STUDENT">Học sinh</option><option value="PARENT">Phụ huynh</option>
      </Select></label>
      <label className="grid gap-1">Tiêu đề thông báo<Input className="rounded border p-2" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required disabled={busy} /></label>
      <label className="grid gap-1">Nội dung thông báo<Textarea className="rounded border p-2" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={5000} required disabled={busy} /></label>
      <Button type="submit" permission="notifications.broadcast" disabled={busy || !title.trim() || !message.trim()}>{busy ? "Đang gửi..." : "Gửi thông báo hệ thống"}</Button>
    </form>
    {result ? <p role="status" className="text-green-700">{result}</p> : null}
    {error ? <p role="alert" className="text-red-700">{error}</p> : null}
  </section>;
}
