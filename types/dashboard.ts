import type { UserRole } from "@/types/auth";

export type DashboardTone =
  | "brand"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "violet";

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
  helper: string;
  tone: DashboardTone;
}

export interface DashboardOverview {
  role: Extract<UserRole, "ADMIN" | "TEACHER">;
  generatedAt: string;
  academicContext: {
    academicYear: string | null;
    term: string | null;
  };
  metrics: DashboardMetric[];
  growth: Array<{
    label: string;
    students: number;
    teachers: number;
  }>;
  attention: Array<{
    key: string;
    title: string;
    description: string;
    count: number;
    href: string;
    severity: "info" | "warning" | "critical";
  }>;
  coverage: Array<{
    id: string;
    code: string;
    name: string;
    students: number;
    assignments: number;
  }>;
  recentActivity: Array<{
    id: string;
    title: string;
    description: string;
    occurredAt: string;
    href: string;
    category: "user" | "exam";
  }>;
  upcomingExams: Array<{
    id: string;
    title: string;
    subjectName: string;
    className: string;
    startsAt: string;
    endsAt: string;
  }>;
}
