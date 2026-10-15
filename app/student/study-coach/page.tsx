import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudyCoachHomePage } from "@/components/student/study-coach-home-page";

export const metadata: Metadata = { title: "AI Study Coach", description: "Vòng lặp học tập thích nghi dành cho sinh viên." };

export default function StudyCoachRoute() {
  return <RoleGate allowedRole="STUDENT"><StudyCoachHomePage /></RoleGate>;
}
