"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { authApi } from "@/lib/auth-api";
import { newPasswordError } from "@/lib/account-security";
import { AuthNotice } from "./auth-notice";
import { Input } from "@/components/ui/form-control";
import { Button } from "@/components/ui/button";
import type { OtpChallenge } from "@/types/auth";

export function FirstLoginSetupForm({ modal = false }: { modal?: boolean }) {
  const { user, isInitializing, signOut } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(user?.email ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const lock = useRef(false);
  const needed = user?.role === "STUDENT" && user.requiresFirstLoginSetup;
  useEffect(() => {
    if (!modal && !isInitializing && !user) router.replace("/student/login");
  }, [modal, isInitializing, user, router]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  async function sendCode() {
    if (lock.current || cooldown) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email không hợp lệ.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await authApi.requestFirstLoginOtp(
        email.trim().toLowerCase(),
      );
      setChallenge(result);
      setCode("");
      setCooldown(result.retryAfter);
      setNotice(
        "Đã gửi mã xác thực đến email của bạn. Mã có hiệu lực trong 10 phút.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi mã.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    const invalid = newPasswordError(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!challenge || !/^\d{6}$/.test(code)) {
      setError("Vui lòng gửi và nhập mã xác thực gồm 6 chữ số.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await authApi.completeFirstLogin({
        challengeId: challenge.challengeId,
        email: email.trim().toLowerCase(),
        code,
        newPassword: password,
        confirmNewPassword: confirmation,
      });
      await signOut().catch(() => undefined);
      router.replace("/student/login?setup=complete");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể hoàn tất thiết lập.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!needed)
    return (
      <main className="grid min-h-screen place-items-center">
        <p>
          {isInitializing || !user
            ? "Đang tải..."
            : "Tài khoản đã được thiết lập."}
        </p>
      </main>
    );
  return (
    <main
      className={
        modal
          ? "fixed inset-0 z-[100] grid overflow-y-auto bg-slate-900/40 p-4 py-8"
          : "grid min-h-screen place-items-center bg-slate-50 px-4 py-8"
      }
    >
      <section
        role={modal ? "dialog" : undefined}
        aria-modal={modal || undefined}
        aria-labelledby="setup-title"
        className="m-auto w-full max-w-[480px] rounded-3xl bg-white p-6 shadow-xl sm:p-8"
      >
        <h1
          id="setup-title"
          className="text-center text-2xl font-extrabold text-brand-600"
        >
          Thiết lập tài khoản lần đầu
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Đổi mật khẩu mặc định và xác thực email khôi phục trước khi bắt đầu
          học.
        </p>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          {error ? <AuthNotice message={error} /> : null}
          {notice ? <AuthNotice type="success" message={notice} /> : null}
          <Input
            label="Email khôi phục"
            type="email"
            autoComplete="email"
            value={email}
            disabled={busy}
            onChange={(event) => {
              setEmail(event.target.value);
              setChallenge(null);
              setCode("");
              setNotice("");
            }}
            required
          />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={busy || cooldown > 0}
            onClick={() => void sendCode()}
          >
            {cooldown
              ? `Gửi lại mã sau ${cooldown}s`
              : challenge
                ? "Gửi lại mã"
                : "Gửi mã xác thực"}
          </Button>
          <Input
            label="Mã xác thực"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            disabled={busy || !challenge}
            required
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
            hint="8–128 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt."
          />
          <Input
            label="Nhập lại mật khẩu mới"
            type="password"
            showPasswordToggle
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            required
          />
          <Button
            type="submit"
            className="h-12 w-full"
            disabled={busy || !challenge}
          >
            {busy ? "Đang xử lý..." : "Hoàn tất & đăng nhập lại"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={busy}
            onClick={() => {
              void signOut().catch(() => undefined);
            }}
          >
            Đăng xuất
          </Button>
        </form>
      </section>
    </main>
  );
}
