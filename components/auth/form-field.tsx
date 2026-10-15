'use client';

import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: LucideIcon;
  error?: string;
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, icon: Icon, error, className = '', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = props.type === 'password';
    const inputType = isPassword && showPassword ? 'text' : props.type;
    const errorId = error ? `${props.id}-error` : undefined;

    return (
      <div>
        <label
          htmlFor={props.id}
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          {label}
        </label>
        <div className="relative">
          <Icon
            className={`pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 ${
              error ? 'text-red-400' : 'text-slate-400'
            }`}
            aria-hidden="true"
          />
          <input
            {...props}
            ref={ref}
            type={inputType}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            className={`h-[52px] w-full rounded-xl border bg-white py-3 pl-12 text-[15px] text-ink outline-none transition placeholder:text-slate-400 focus:ring-4 ${
              isPassword ? 'pr-12' : 'pr-4'
            } ${
              error
                ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
                : 'border-slate-200 hover:border-slate-300 focus:border-brand-500 focus:ring-brand-100'
            } ${className}`}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          ) : null}
        </div>
        {error ? (
          <p id={errorId} className="mt-1.5 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);

FormField.displayName = 'FormField';
