import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { LearningSupportOverviewPage } from "@/components/assessment/learning-support-overview-page";

export const metadata: Metadata = {
  title: "Theo dõi học tập",
  description: "Tổng quan nguy cơ học tập theo lớp và môn của giáo viên.",
};

export default function TeacherLearningSupportPage() {
  return (
    <RoleGate allowedRole="TEACHER">
      <LearningSupportOverviewPage />
    </RoleGate>
  );
}
