import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentQuizPage } from "@/components/student/student-quiz-page";

export const metadata: Metadata = {
  title: "Bài luyện · Study Coach",
  description: "Làm bài luyện theo tài liệu đã chọn.",
};

export default function StudyCoachMaterialQuizRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentQuizPage />
    </RoleGate>
  );
}
