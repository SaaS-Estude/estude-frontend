"use client";

import Link from "next/link";
import { BarChart3, Sparkles, UsersRound } from "lucide-react";
import { usePermissions } from "@/context/permissions-context";

export function ExamDetailTabs({ examId, active }: { examId: string; active: "overview" | "analysis" | "support" }) {
  const { can } = usePermissions();
  return (
    <nav aria-label="Nội dung bài kiểm tra" className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-card">
      {[
        { key: "overview", href: `/teacher/exams/${examId}`, label: "Tổng quan & bài nộp", icon: BarChart3 },
        ...(can("exams.submissions") ? [
          { key: "analysis", href: `/teacher/exams/${examId}/analysis`, label: "Phân tích AI", icon: Sparkles },
          { key: "support", href: `/teacher/exams/${examId}/subject-support`, label: "Theo dõi học tập theo môn", icon: UsersRound },
        ] : []),
      ].map(({ key, href, label, icon: Icon }) => <Link key={key} href={href} aria-current={active === key ? "page" : undefined} className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-[13px] font-bold transition ${active === key ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-brand-700"}`}><Icon className="size-4" />{label}</Link>)}
    </nav>
  );
}
