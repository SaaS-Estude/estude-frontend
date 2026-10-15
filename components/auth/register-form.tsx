'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AtSign,
  Check,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from 'lucide-react';
import { AuthHeading } from '@/components/auth/auth-heading';
import { AuthNotice } from '@/components/auth/auth-notice';
import { FormField } from '@/components/auth/form-field';
import { useAuth } from '@/context/auth-context';
import { ApiError } from '@/lib/auth-api';
import { getRoleHome } from '@/lib/role-routes';

interface RegisterErrors {
  fullName?: string;
  accountName?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const strongPassword =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[^\s]{8,128}$/;

export function RegisterForm() {
  const router = useRouter();
  const { user, isInitializing, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isInitializing && user) {
      router.replace(getRoleHome(user.role));
    }
  }, [isInitializing, router, user]);

  const passwordChecks = useMemo(
    () => [
      { label: 'Từ 8 ký tự', valid: password.length >= 8 },
      {
        label: 'Chữ hoa & thường',
        valid: /[a-z]/.test(password) && /[A-Z]/.test(password),
      },
      {
        label: 'Số & ký tự đặc biệt',
        valid: /\d/.test(password) && /[^A-Za-z\d]/.test(password),
      },
    ],
    [password],
  );

  function validate(): RegisterErrors {
    const nextErrors: RegisterErrors = {};
    if (fullName.trim().length < 2)
      nextErrors.fullName = 'Họ và tên cần có ít nhất 2 ký tự.';
    if (!/^[a-z0-9._-]{3,50}$/.test(accountName.trim().toLowerCase())) {
      nextErrors.accountName = 'Tên tài khoản không hợp lệ.';
    }
    if (!strongPassword.test(password))
      nextErrors.password = 'Mật khẩu chưa đáp ứng đủ yêu cầu bảo mật.';
    if (confirmPassword !== password)
      nextErrors.confirmPassword = 'Mật khẩu xác nhận chưa trùng khớp.';
    if (!acceptTerms)
      nextErrors.terms = 'Bạn cần đồng ý với điều khoản để tiếp tục.';
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setApiError('');
    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const registeredUser = await signUp({
        fullName,
        accountName,
        password,
        confirmPassword,
      });
      router.replace(getRoleHome(registeredUser.role));
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : 'Đã có lỗi xảy ra. Vui lòng thử lại.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <AuthHeading mode="register" />
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {apiError ? <AuthNotice message={apiError} /> : null}

        <FormField
          id="fullName"
          name="fullName"
          type="text"
          label="Họ và tên"
          icon={UserRound}
          placeholder="Nhập họ và tên"
          autoComplete="name"
          value={fullName}
          error={errors.fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setErrors((current) => ({ ...current, fullName: undefined }));
          }}
        />
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
          placeholder="Tạo mật khẩu mạnh"
          autoComplete="new-password"
          value={password}
          error={errors.password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
        />

        {password ? (
          <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-slate-50 px-3.5 py-3 sm:grid-cols-3">
            {passwordChecks.map((check) => (
              <span
                key={check.label}
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  check.valid ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                <Check className="size-3.5" aria-hidden="true" />
                {check.label}
              </span>
            ))}
          </div>
        ) : null}

        <FormField
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Xác nhận mật khẩu"
          icon={LockKeyhole}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
          value={confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }}
        />

        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5 text-slate-600">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(event) => {
                setAcceptTerms(event.target.checked);
                setErrors((current) => ({ ...current, terms: undefined }));
              }}
              className="mt-0.5 size-4 shrink-0 rounded border-slate-300 accent-brand-600"
              aria-invalid={Boolean(errors.terms)}
            />
            <span>
              Tôi đồng ý với{' '}
              <button
                type="button"
                className="font-semibold text-brand-600 hover:text-brand-800"
              >
                Điều khoản sử dụng
              </button>{' '}
              và Chính sách bảo mật.
            </span>
          </label>
          {errors.terms ? (
            <p className="mt-1.5 text-sm text-red-600">{errors.terms}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isInitializing}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 focus:outline-none focus:ring-4 focus:ring-brand-200"
        >
          {isSubmitting ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : null}
          {isSubmitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link
          href="/login"
          className="font-bold text-brand-600 hover:text-brand-800"
        >
          Đăng nhập
        </Link>
      </p>
    </>
  );
}
