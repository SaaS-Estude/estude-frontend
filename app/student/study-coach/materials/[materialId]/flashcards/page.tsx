import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentFlashcardsPage } from "@/components/student/student-flashcards-page";

export const metadata: Metadata = {
  title: "Thẻ ghi nhớ · Study Coach",
  description: "Ôn tập thẻ ghi nhớ theo tài liệu đã chọn.",
};

export default function StudyCoachMaterialFlashcardsRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentFlashcardsPage />
    </RoleGate>
  );
}
