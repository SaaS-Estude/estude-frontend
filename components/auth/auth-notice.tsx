import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function AuthNotice({
  message,
  type = 'error',
}: {
  message: string;
  type?: 'error' | 'success';
}) {
  const Icon = type === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm leading-5 ${
        type === 'error'
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
      role="alert"
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
