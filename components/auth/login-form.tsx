"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, LoaderCircle, LockKeyhole } from "lucide-react";
import { AuthHeading } from "@/components/auth/auth-heading";
import { AuthNotice } from "@/components/auth/auth-notice";
import { FormField } from "@/components/auth/form-field";
import { useAuth } from "@/context/auth-context";
import { ApiError } from "@/lib/auth-api";
import { getRoleHome } from "@/lib/role-routes";

interface LoginErrors {
  accountName?: string;
  password?: string;
}

export function LoginForm() {
  const router = useRouter();
  const { user, isInitializing, signIn } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isInitializing && user) {
      router.replace(getRoleHome(user.role));
    }
  }, [isInitializing, router, user]);

  function validate(): LoginErrors {
    const nextErrors: LoginErrors = {};
    if (!/^[a-z0-9._-]{3,50}$/.test(accountName.trim().toLowerCase())) {
      nextErrors.accountName = "Tên tài khoản không hợp lệ.";
    }
    if (!password) {
      nextErrors.password = "Vui lòng nhập mật khẩu.";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setApiError("");
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const signedInUser = await signIn({ accountName, password });
      router.replace(getRoleHome(signedInUser.role));
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : "Đã có lỗi xảy ra. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading mode="login" />
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {apiError ? <AuthNotice message={apiError} /> : null}

        <FormField
          id="accountName"
          name="accountName"
          type="text"
          label="Tên tài khoản"
          icon={AtSign}
          placeholder="Nhập tên tài khoản"
          autoComplete="username"
          value={accountName}
          error={errors.accountName}
          onChange={(event) => {
            setAccountName(event.target.value);
            setErrors((current) => ({ ...current, accountName: undefined }));
          }}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="Mật khẩu"
          icon={LockKeyhole}
          placeholder="Nhập mật khẩu của bạn"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />

        <button
          type="submit"
          disabled={isSubmitting || isInitializing}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus:outline-none focus:ring-4 focus:ring-brand-200"
        >
          {isSubmitting ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-500">
        Sử dụng tài khoản do nhà trường cấp. Nếu chưa có tài khoản, hãy liên hệ
        giáo viên hoặc quản trị viên.
      </p>
    </>
  );
}
