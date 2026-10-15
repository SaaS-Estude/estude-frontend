import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachInsightsPage } from "@/components/student/study-coach-insights-page";

export const metadata: Metadata = { title: "Phân tích học tập · AI Study Coach" };

export default function StudyCoachInsightsRoute() {
  return <RoleGate allowedRole="STUDENT"><StudyCoachInsightsPage /></RoleGate>;
}
