interface LoadingProps {
  label?: string;
  className?: string;
}

export function ContentLoadingOverlay({
  label = "Đang tải dữ liệu...",
  className = "",
}: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-slate-100/55 px-4 pt-36 sm:pt-44 ${className}`}
    >
      <div className="flex max-w-full flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="size-12 shrink-0 rounded-full border-4 border-brand-200 border-t-brand-700 bg-white/70 shadow-card motion-safe:animate-spin"
        />
        <span className="rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-slate-800 shadow-card sm:text-base">
          {label}
        </span>
      </div>
    </div>
  );
}

export function ContentLoading({
  label = "Đang tải dữ liệu...",
  className = "",
}: LoadingProps) {
  return (
    <section
      aria-busy="true"
      className={`relative min-h-[520px] space-y-3 overflow-hidden rounded-xl ${className}`}
    >
      <div aria-hidden="true" className="space-y-3 animate-pulse">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="h-5 w-52 max-w-full rounded bg-slate-200" />
          <div className="mt-3 h-3 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 rounded-xl border border-slate-200 bg-white p-4 shadow-card"
            >
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-3 h-6 w-14 rounded bg-slate-200" />
            </div>
          ))}
        </div>
        <div className="min-h-72 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="h-4 w-44 rounded bg-slate-200" />
          <div className="mt-4 h-3 w-96 max-w-full rounded bg-slate-100" />
          <div className="mt-6 h-12 rounded-lg bg-slate-100" />
          <div className="mt-3 h-12 rounded-lg bg-slate-100" />
        </div>
      </div>
      <ContentLoadingOverlay label={label} />
    </section>
  );
}
