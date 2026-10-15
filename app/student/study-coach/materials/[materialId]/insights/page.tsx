import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachInsightsPage } from "@/components/student/study-coach-insights-page";

export const metadata: Metadata = {
  title: "Phân tích học tập · Study Coach",
  description: "Xem phân tích học tập theo tài liệu đã chọn.",
};

export default function StudyCoachMaterialInsightsRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudyCoachInsightsPage />
    </RoleGate>
  );
}
