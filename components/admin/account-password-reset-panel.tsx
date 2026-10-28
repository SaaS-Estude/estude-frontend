"use client";

import { useRef, useState, type FormEvent } from "react";
import { authenticatedRequest } from "@/lib/auth-api";
import { newPasswordError } from "@/lib/account-security";
import type { User } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { Modal } from "@/components/ui/modal";

export function AccountPasswordResetPanel({user, onClose, onSaved}: {user: User; onClose: () => void; onSaved: () => void}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = newPasswordError(password, confirmation);
    if (invalid) { setError(invalid); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      await authenticatedRequest(`/users/${encodeURIComponent(user.id)}/password`, {
        method: "POST", body: JSON.stringify({newPassword: password, confirmNewPassword: confirmation}),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đặt lại mật khẩu.");
      lock.current = false; setBusy(false); return;
    }
    setPassword(""); setConfirmation("");
    onSaved();
  }
  return <Modal open title="ĐẶT LẠI MẬT KHẨU" onClose={() => { if (!lock.current) onClose(); }} footer={null}>
    <form className="space-y-4" onSubmit={submit}>
      <p className="text-sm text-slate-700">Cấp lại mật khẩu cho <strong>{user.fullName}</strong> ({user.accountName}).</p>
      <p className="text-sm text-slate-500">Xác minh người nhận trước khi cấp mật khẩu tạm. Các phiên cũ sẽ bị đăng xuất; người nhận phải đổi mật khẩu khi đăng nhập lại. Trạng thái khóa tài khoản được giữ nguyên.</p>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <Input label="Mật khẩu tạm" type="password" showPasswordToggle autoComplete="new-password" required maxLength={128} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} />
      <Input label="Nhập lại mật khẩu tạm" type="password" showPasswordToggle autoComplete="new-password" required maxLength={128} value={confirmation} disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
      <p className="text-xs text-slate-500">8–128 ký tự, gồm chữ hoa, chữ thường, số, ký tự đặc biệt và không có khoảng trắng.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>Hủy</Button>
        <Button type="submit" permission="accounts.reset_password" disabled={busy}>{busy ? "Đang đặt lại…" : "Đặt lại mật khẩu"}</Button>
      </div>
    </form>
  </Modal>;
}
