"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { authApi } from "@/lib/auth-api";
import { newPasswordError } from "@/lib/account-security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-control";
import { AuthNotice } from "./auth-notice";
import type { UserRole } from "@/types/auth";

export function ChangePasswordForm({ role }: { role: UserRole }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = newPasswordError(password, confirmation);
    if (!current || invalid || password === current) {
      setError(
        !current
          ? "Vui lòng nhập mật khẩu hiện tại."
          : (invalid ?? "Mật khẩu mới phải khác mật khẩu hiện tại."),
      );
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await authApi.changePassword(current, password, confirmation);
      setCurrent("");
      setPassword("");
      setConfirmation("");
      router.replace(`/${role.toLowerCase()}/login?password=changed`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không thể đổi mật khẩu.",
      );
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 space-y-4 border-t border-slate-100 pt-6"
    >
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <KeyRound className="size-4" />
          Đổi mật khẩu của bạn
        </h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Nhập mật khẩu hiện tại để đổi. Sau khi lưu, bạn cần đăng nhập lại trên
          tất cả thiết bị. Nếu quên mật khẩu, hãy liên hệ quản trị viên SaaS.
        </p>
      </div>
      {error && <AuthNotice message={error} />}
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input
            label="Mật khẩu hiện tại"
            type="password"
            showPasswordToggle
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <Input
          label="Mật khẩu mới"
          type="password"
          showPasswordToggle
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="8–128 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt; không chứa khoảng trắng."
        />
        <Input
          label="Nhập lại mật khẩu mới"
          type="password"
          showPasswordToggle
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            {busy ? "Đang đổi mật khẩu…" : "Đổi mật khẩu"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
