"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  GraduationCap,
  Library,
  RefreshCw,
  School,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import { dashboardService } from "@/lib/dashboard-api";
import type { User } from "@/types/auth";
import type { DashboardMetric, DashboardOverview } from "@/types/dashboard";

const metricIcons = {
  students: GraduationCap,
  teachers: UsersRound,
  classes: School,
  subjects: Library,
  questions: BookOpenCheck,
  exams: CalendarDays,
} as const;

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const Icon = metricIcons[metric.key as keyof typeof metricIcons] ?? CircleUserRound;
  return (
    <article className="rounded-2xl border border-blue-400 bg-gradient-to-br from-brand-500 to-brand-600 p-4 text-white shadow-[0_12px_30px_rgba(52,136,251,0.18)] sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-100">{metric.label}</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
            {metric.value.toLocaleString("vi-VN")}
          </p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-inset ring-white/20">
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 truncate text-xs font-medium text-blue-100" title={metric.helper}>
        {metric.helper}
      </p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Đang tải dữ liệu tổng quan" aria-busy="true">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.75fr)]">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

export function OverviewDashboard({ user }: { user: User }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (!refresh) setIsLoading(true);
    setError("");
    try {
      setData(await dashboardService.getOverview());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải dữ liệu tổng quan");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = user.role === "ADMIN";

  if (isLoading && !data) return <DashboardSkeleton />;

  if (!data) {
    return (
      <section className="grid min-h-[420px] place-items-center rounded-3xl border border-rose-100 bg-white p-8 text-center shadow-card">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-black text-slate-600">Chưa tải được dữ liệu tổng quan</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">
            <RefreshCw className="size-4" /> Thử lại
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="pb-5">
      {error ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Dữ liệu mới nhất chưa tải được: {error}</span>
          <button type="button" onClick={() => void load(true)} className="shrink-0 font-bold">Thử lại</button>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Chỉ số tổng quan">
        {data.metrics.map((metric) => <MetricCard key={metric.key} metric={metric} />)}
      </section>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)]">
        {isAdmin ? <GrowthChart data={data.growth} /> : <UpcomingExams items={data.upcomingExams} onOpen={(id) => router.push(`/teacher/exams/${id}`)} />}
        <AttentionPanel items={data.attention} onOpen={(href) => router.push(href)} />
      </div>

      <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.75fr)]">
        <CoveragePanel items={data.coverage} isAdmin={isAdmin} onOpen={() => router.push(isAdmin ? "/admin/subject-assignments" : "/teacher/exams")} />
        <RecentActivity items={data.recentActivity} onOpen={(href) => router.push(href)} />
      </div>

    </div>
  );
}

function GrowthChart({ data }: { data: DashboardOverview["growth"] }) {
  const max = Math.max(1, ...data.map((item) => item.students + item.teachers));
  return (
    <section className="h-full rounded-2xl border border-blue-100/80 bg-white p-5 shadow-[0_10px_30px_rgba(37,99,235,0.06)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-600">Người dùng mới</h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-blue-600" /> Học viên</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-400" /> Giảng viên</span>
        </div>
      </div>
      <div className="mt-5 grid h-40 grid-cols-6 items-end gap-3 border-b border-blue-100 bg-[linear-gradient(to_bottom,transparent_32%,#eff6ff_33%,transparent_34%,transparent_65%,#eff6ff_66%,transparent_67%)] px-1 sm:gap-5">
        {data.map((item) => {
          const studentHeight = (item.students / max) * 108;
          const teacherHeight = (item.teachers / max) * 108;
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-col items-center justify-end">
              <div className="mb-1.5 text-[11px] font-black text-blue-700">{item.students + item.teachers}</div>
              <div className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded-t-md bg-blue-50" title={`${item.students} học viên, ${item.teachers} giảng viên`}>
                <div className="bg-blue-600" style={{ height: `${studentHeight}px` }} />
                <div className="bg-sky-400" style={{ height: `${teacherHeight}px` }} />
              </div>
              <span className="mt-2 w-full truncate text-center text-[11px] font-bold capitalize text-slate-400">{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AttentionPanel({ items, onOpen }: { items: DashboardOverview["attention"]; onOpen: (href: string) => void }) {
  const highestCount = Math.max(1, ...items.map((item) => item.count));
  return (
    <section id="dashboard-attention" className="h-full rounded-2xl border border-blue-100/80 bg-white p-5 shadow-[0_10px_30px_rgba(37,99,235,0.06)] sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-600">Tồn đọng</h2>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => onOpen(item.href)} className="group block w-full text-left">
            <span className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-bold text-slate-600">{attentionLabel(item.key, item.title)}</span>
              <span className={`shrink-0 text-sm font-black ${item.count === 0 ? "text-emerald-600" : item.severity === "critical" ? "text-rose-600" : "text-blue-700"}`}>
                {item.count === 0 ? <CheckCircle2 className="size-4" /> : item.count}
              </span>
            </span>
            <span className="mt-2 flex h-2 overflow-hidden rounded-full bg-blue-50">
              <span
                className={`h-full rounded-full transition-all ${item.count === 0 ? "bg-emerald-400" : item.severity === "critical" ? "bg-rose-500" : "bg-blue-500"}`}
                style={{ width: item.count === 0 ? "100%" : `${Math.max(12, (item.count / highestCount) * 100)}%` }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CoveragePanel({ items, isAdmin, onOpen }: { items: DashboardOverview["coverage"]; isAdmin: boolean; onOpen: () => void }) {
  return (
    <section className="h-full overflow-hidden rounded-2xl border border-blue-100/80 bg-white shadow-[0_10px_30px_rgba(37,99,235,0.06)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-600">{isAdmin ? "Lớp học mới cập nhật" : "Môn học được phân công"}</h2>
        </div>
        <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 text-sm font-bold text-brand-600 hover:text-brand-800">Xem tất cả <ArrowRight className="size-4" /></button>
      </div>
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400">
              <tr><th className="px-6 py-3">Lớp / môn học</th><th className="px-4 py-3 text-center">Học viên</th><th className="px-6 py-3 text-right">{isAdmin ? "Phân công" : "Trạng thái"}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-3.5"><p className="font-bold text-slate-700">{item.name}</p><p className="mt-0.5 text-xs font-semibold text-brand-600">{item.code}</p></td>
                  <td className="px-4 py-3.5 text-center text-sm font-black text-blue-900">{item.students}</td>
                  <td className="px-6 py-3.5 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${item.assignments ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isAdmin ? `${item.assignments} bộ môn` : "Đang phụ trách"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid min-h-52 place-items-center p-8 text-center text-sm text-slate-500"><div><School className="mx-auto size-8 text-slate-300" /><p className="mt-3 font-semibold">Chưa có dữ liệu phân công</p></div></div>
      )}
    </section>
  );
}

function RecentActivity({ items, onOpen }: { items: DashboardOverview["recentActivity"]; onOpen: (href: string) => void }) {
  return (
    <section className="h-full rounded-2xl border border-blue-100/80 bg-white p-5 shadow-[0_10px_30px_rgba(37,99,235,0.06)] sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-slate-600">Cập nhật gần đây</h2>
      <div className="mt-5 space-y-1">
        {items.length ? items.map((item, index) => (
          <button key={item.id} type="button" onClick={() => onOpen(item.href)} className="group relative flex w-full gap-3 rounded-xl px-2 py-3 text-left hover:bg-slate-50">
            {index < items.length - 1 ? <span className="absolute bottom-0 left-[21px] top-10 w-px bg-slate-100" /> : null}
            <span className={`relative grid size-8 shrink-0 place-items-center rounded-lg ${item.category === "user" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>
              {item.category === "user" ? <UserRoundPlus className="size-4" /> : <BookOpenCheck className="size-4" />}
            </span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-700">{item.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{item.description}</span><span className="mt-1 block text-[11px] font-medium text-slate-500">{formatRelativeTime(item.occurredAt)}</span></span>
          </button>
        )) : <div className="py-10 text-center text-sm text-slate-400">Chưa có hoạt động mới</div>}
      </div>
    </section>
  );
}

function UpcomingExams({ items, onOpen }: { items: DashboardOverview["upcomingExams"]; onOpen: (id: string) => void }) {
  return (
    <section className="h-full rounded-2xl border border-blue-100/80 bg-white p-5 shadow-[0_10px_30px_rgba(37,99,235,0.06)] sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-600">Lịch sắp tới</p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-600">Bài kiểm tra đang mở và sắp mở</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.length ? items.map((item) => (
          <button key={item.id} type="button" onClick={() => onOpen(item.id)} className="rounded-2xl border border-slate-100 p-4 text-left transition hover:border-brand-200 hover:bg-blue-50/30">
            <div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-brand-600"><Clock3 className="size-5" /></span><span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">{formatExamState(item.startsAt, item.endsAt)}</span></div>
            <p className="mt-4 truncate font-bold text-slate-700">{item.title}</p><p className="mt-1 truncate text-xs text-slate-500">{item.subjectName} · {item.className}</p><p className="mt-3 text-xs font-semibold text-brand-700">{new Date(item.startsAt).toLocaleString("vi-VN")}</p>
          </button>
        )) : <div className="col-span-full grid min-h-44 place-items-center text-center text-sm text-slate-400"><div><CalendarDays className="mx-auto size-8 text-slate-300" /><p className="mt-3">Chưa có bài kiểm tra sắp tới</p></div></div>}
      </div>
    </section>
  );
}

function formatRelativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString("vi-VN");
}

function attentionLabel(key: string, fallback: string): string {
  const labels: Record<string, string> = {
    "pending-accounts": "Chờ kích hoạt",
    "locked-accounts": "Tài khoản khóa",
    "unassigned-classes": "Chưa phân công",
    "missing-grade-config": "Thiếu cấu hình điểm",
    "draft-exams": "Chưa công bố",
    "upcoming-exams": "Sắp diễn ra",
  };
  return labels[key] ?? fallback;
}

function formatExamState(startsAt: string, endsAt: string): string {
  const now = Date.now();
  if (now < new Date(startsAt).getTime()) return "Sắp mở";
  if (now <= new Date(endsAt).getTime()) return "Đang mở";
  return "Đã kết thúc";
}
