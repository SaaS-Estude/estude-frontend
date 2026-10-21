"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MeetingPasscode({ value, roomUrl }: { value: string; roomUrl?: string }) {
  const [notice, setNotice] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Đã sao chép mật khẩu.");
    } catch {
      setNotice("Hãy chọn mật khẩu bên trên để sao chép thủ công.");
    }
  }
  return <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
    <p className="text-xs font-semibold text-slate-600">Mật khẩu tham gia</p>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <code className="min-w-0 select-all break-all text-base font-bold text-slate-900">{value}</code>
      <Button variant="outline" size="sm" onClick={() => void copy()}><Copy className="size-4" />Sao chép mật khẩu</Button>
    </div>
    {notice ? <p role="status" className="mt-2 text-xs text-slate-600">{notice}</p> : null}
    {roomUrl ? <a href={roomUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-bold text-brand-700 underline">Mở phòng học</a> : null}
  </div>;
}
