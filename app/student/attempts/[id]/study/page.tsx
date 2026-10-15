import type { Metadata } from "next";
import { StudentStudyAnalysisPage } from "@/components/assessment/study-analysis-page";
import { RoleGate } from "@/components/auth/role-gate";

export const metadata: Metadata = {
  title: "Phân tích và ôn tập",
  description: "Phân tích lỗ hổng kiến thức và luyện tập thích ứng sau bài kiểm tra.",
};

export default function StudentStudyAnalysisRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentStudyAnalysisPage />
    </RoleGate>
  );
}
