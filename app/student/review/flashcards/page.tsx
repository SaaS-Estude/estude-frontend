import type { Metadata } from "next";
import { RoleGate } from "@/components/auth/role-gate";
import { StudentFlashcardsPage } from "@/components/student/student-flashcards-page";

export const metadata: Metadata = {
  title: "Flashcards · AI Study Coach",
  description: "Ôn tập bằng flashcard và lịch lặp lại ngắt quãng.",
};

export default function StudentFlashcardsRoute() {
  return (
    <RoleGate allowedRole="STUDENT">
      <StudentFlashcardsPage />
    </RoleGate>
  );
}
