import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentQuizPage } from "@/components/student/student-quiz-page";

export const metadata: Metadata = { title: "Quiz · AI Study Coach" };

export default function StudentQuizRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentQuizPage />
    </RoleGate>
  );
}
