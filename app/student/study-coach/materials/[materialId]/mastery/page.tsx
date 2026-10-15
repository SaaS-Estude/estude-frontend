import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachMasteryPage } from "@/components/student/study-coach-mastery-page";

export const metadata: Metadata = { title: "Tiến độ tài liệu · AI Study Coach" };

export default function StudyCoachMaterialMasteryRoute() {
  return <RoleGate allowedRole="STUDENT"><StudyCoachMasteryPage /></RoleGate>;
}
