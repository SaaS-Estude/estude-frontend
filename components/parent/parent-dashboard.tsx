"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { authenticatedRequest } from "@/lib/auth-api";
import { LearningSummary } from "@/components/dashboard/student-overview-summary";
import { InternalGradeReport } from "@/components/assessment/internal-grade-report";
import {
  ParentOverviewPanels,
  useParentOverview,
} from "@/components/parent/parent-overview-panels";
import {
  ParentShell,
  parentSections,
  type ParentSection,
} from "@/components/parent/parent-shell";
import type { User } from "@/types/auth";
import { Button } from "@/components/ui/button";


export function ParentDashboard({ studentId }: { studentId?: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [section, setSection] = useState<ParentSection>("overview");
  const [children, setChildren] = useState<User[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [childrenError, setChildrenError] = useState("");
  const [childrenRefresh, setChildrenRefresh] = useState(0);
  const { overview, error, refreshing, refresh } = useParentOverview(
    !!studentId,
    studentId,
  );

  useEffect(() => {
    let active = true;
    setLoadingChildren(true);
    setChildrenError("");
    authenticatedRequest<User[]>("/users/me/children")
      .then((result) => {
        if (!active) return;
        setChildren(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setChildrenError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải danh sách học sinh.",
          );
      })
      .finally(() => {
        if (active) setLoadingChildren(false);
      });
    return () => {
      active = false;
    };
  }, [childrenRefresh]);

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "learning-alerts") setSection("notifications");
      else
        setSection(
          parentSections.find((item) => item.id === hash)?.id ?? "overview",
        );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function navigate(next: ParentSection) {
    setSection(next);
    window.history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openStudent(id: string) {
    router.push(`/parent/dashboard/${encodeURIComponent(id)}`);
  }
  if (!user) return null;
  const unread =
    overview?.notifications.filter((item) => !item.readAt).length ?? 0;
  const alerts =
    overview?.learningAlerts ??
    overview?.notifications.filter((item) =>
      item.actionUrl?.endsWith("#learning-alerts"),
    ) ??
    [];
  const selectedStudent = children.find((item) => item.id === studentId);
  const title = !studentId
    ? `Xin chào, ${user.fullName}`
    : section === "overview"
      ? `Tổng quan học tập của ${selectedStudent?.fullName ?? "học sinh"}`
      : parentSections.find((item) => item.id === section)?.label;
  const descriptions: Record<ParentSection, string> = {
    overview: "Cùng con theo dõi việc học, kết nối với thầy cô mỗi ngày.",
    grades: "Theo dõi kết quả đã công bố theo môn học và học kỳ.",
    attendance: "Các lượt điểm danh gần đây của học sinh đang xem.",
    exams: "Chủ động sắp xếp thời gian để cùng con chuẩn bị cho bài kiểm tra.",
    notifications:
      "Thông tin từ nhà trường và những nội dung cần gia đình phối hợp.",
  };
  return (
    <ParentShell
      section={section}
      onNavigate={navigate}
      unreadCount={unread}
      childrenOnly={!studentId}
      studentName={selectedStudent?.fullName}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-[13px] leading-6 text-slate-500">
            {studentId
              ? descriptions[section]
              : "Chọn con để mở không gian học tập riêng, theo dõi điểm số và thông tin từ nhà trường."}
          </p>
        </div>
        <Button variant="plain"
          type="button"
          disabled={refreshing || loadingChildren}
          onClick={() => {
            refresh();
            setChildrenRefresh((value) => value + 1);
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700 disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
          />
          Làm mới
        </Button>
      </div>

      {studentId && !loadingChildren && !childrenError && !selectedStudent ? (
        <p
          role="alert"
          className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          Không tìm thấy học sinh hoặc liên kết không còn hiệu lực. Vui lòng
          quay lại chọn học sinh.
        </p>
      ) : null}
      {studentId && selectedStudent ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-100 bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <GraduationCap className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">
                {selectedStudent.fullName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedStudent.assignedClass
                  ? `${selectedStudent.assignedClass.code} · `
                  : ""}
                Mã HS: {selectedStudent.accountName}
              </p>
            </div>
          </div>
          <Button variant="plain"
            type="button"
            onClick={() => router.push("/parent/dashboard")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50"
          >
            Chọn học sinh khác
          </Button>
        </div>
      ) : null}
      {studentId && section === "overview" && selectedStudent ? (
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            {
              label: "Sổ điểm học sinh",
              value: "Xem điểm",
              detail: "Kết quả theo môn và học kỳ",
              icon: BarChart3,
              tone: "bg-brand-50 text-brand-600",
              target: "grades" as const,
            },
            {
              label: "Lịch kiểm tra",
              value: overview?.upcomingExams.length ?? "—",
              detail: "Bài kiểm tra sắp diễn ra",
              icon: CalendarDays,
              tone: "bg-violet-50 text-violet-600",
              target: "exams" as const,
            },
            {
              label: "Thông báo chưa đọc",
              value: overview ? unread : "—",
              detail: "Từ giáo viên và nhà trường",
              icon: Bell,
              tone: "bg-emerald-50 text-emerald-600",
              target: "notifications" as const,
            },
            {
              label: "Cần phối hợp",
              value: overview ? alerts.length : "—",
              detail: "Nội dung hỗ trợ học tập",
              icon: CircleAlert,
              tone: "bg-amber-50 text-amber-600",
              target: "notifications" as const,
            },
          ].map(({ label, value, detail, icon: Icon, tone, target }) => (
            <Button variant="plain"
              key={label}
              type="button"
              onClick={() => navigate(target)}
              className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`grid size-9 place-items-center rounded-xl ${tone}`}
                >
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </span>
                <ChevronRight className="size-4 text-slate-300 group-hover:text-brand-600" />
              </div>
              <p className="mt-3 text-2xl font-bold leading-none text-ink">
                {value}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-600">
                {label}
              </p>
              <p className="mt-1 hidden text-[11px] text-slate-400 sm:block">
                {detail}
              </p>
            </Button>
          ))}
        </div>
      ) : null}

      {!studentId ? (
        <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-[18px] text-brand-600" />
              <h3 className="text-sm font-bold text-ink">Học sinh của bạn</h3>
              {!loadingChildren && !childrenError ? (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {children.length}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400">
              Mỗi học sinh có một trang thông tin riêng
            </p>
          </div>
          {loadingChildren ? (
            <div
              className="grid gap-3 p-4 sm:grid-cols-2"
              aria-label="Đang tải học sinh"
            >
              {[0, 1].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-xl bg-slate-50"
                />
              ))}
            </div>
          ) : childrenError ? (
            <div role="alert" className="p-5 text-sm text-rose-600">
              {childrenError}
            </div>
          ) : children.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {children.map((student) => (
                <Button variant="plain"
                  key={student.id}
                  type="button"
                  onClick={() => openStudent(student.id)}
                  aria-label={`Xem thông tin ${student.fullName}`}
                  className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                    {student.avatarUrl ? (
                      <span
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${student.avatarUrl})` }}
                      />
                    ) : (
                      student.fullName
                        .trim()
                        .split(/\s+/)
                        .slice(-2)
                        .map((part) => part[0])
                        .join("")
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">
                      {student.fullName}
                    </span>
                    <span className="mt-1 block truncate text-xs text-slate-500">
                      {student.assignedClass
                        ? `${student.assignedClass.code} · ${student.assignedClass.name}`
                        : `Mã HS: ${student.accountName}`}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-600" />
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-8 text-center">
              <UsersRound className="mb-3 size-7 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                Chưa có học sinh được liên kết
              </p>
              <p className="mt-1 max-w-md text-xs leading-5 text-slate-400">
                Liên hệ nhà trường để xác nhận liên kết tài khoản với hồ sơ học
                sinh.
              </p>
            </div>
          )}
        </section>
      ) : null}

      {studentId && loadingChildren ? (
        <p role="status" className="p-4 text-sm text-slate-500">
          Đang tải thông tin học sinh…
        </p>
      ) : null}
      {studentId && childrenError ? (
        <p role="alert" className="p-4 text-sm text-rose-600">
          {childrenError}
        </p>
      ) : null}
      {studentId && selectedStudent && section === "overview" && !error
        ? overview?.studentReports?.map((report) => (
            <div key={report.student.id} className="mb-5">
              <LearningSummary report={report} />
            </div>
          ))
        : null}
      {studentId && selectedStudent && !childrenError ? (
        section === "grades" ? (
          selectedStudent && !loadingChildren && !childrenError ? (
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                <BarChart3 className="size-4" />
                <span>
                  Sổ điểm của{" "}
                  <strong className="text-ink">
                    {selectedStudent.fullName}
                  </strong>
                </span>
              </div>
              <InternalGradeReport
                key={`${selectedStudent.id}:${childrenRefresh}`}
                studentId={selectedStudent.id}
              />
            </div>
          ) : null
        ) : (
          <ParentOverviewPanels
            key={studentId}
            overview={overview}
            error={error}
            section={section}
            onNavigate={navigate}
          />
        )
      ) : null}
    </ParentShell>
  );
}
