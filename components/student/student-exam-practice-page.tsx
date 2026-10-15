"use client";

import { useParams, useRouter } from "next/navigation";
import { ExamPracticeWorkspace } from "@/components/student/exam-practice-workspace";
import { StudentShell } from "@/components/student/student-shell";

export function StudentExamPracticePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();

  return (
    <StudentShell>
      <ExamPracticeWorkspace
        attemptId={attemptId}
        onBack={() =>
          router.push(`/student/attempts/${attemptId}/study?tab=practice`)
        }
      />
    </StudentShell>
  );
}
