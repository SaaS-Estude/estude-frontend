import type { User } from "@/types/auth";

export interface StudentOverview {
  student: User;
  summary: {
    classCount: number;
    subjectCount: number;
    completedExamCount: number;
    averagePercentage: number | null;
    warningCount: number;
  };
  enrollments: Array<{
    id: string;
    joinedAt: string;
    isActive: boolean;
    class: { id: string; code: string; name: string };
    academicYear: {
      id: string;
      name: string;
      status: string;
      startsAt: string;
      endsAt: string;
    } | null;
    subjects: Array<{
      id: string;
      code: string;
      name: string;
      isActive: boolean;
      teacher: { id: string; fullName: string; accountName: string };
    }>;
  }>;
  subjectResults: SubjectScoreResult[];
  semesterResults: Array<{
    id: string;
    name: string;
    status: string;
    startsAt: string;
    endsAt: string;
    academicYearId: string;
    academicYearName: string;
    examCount: number;
    averagePercentage: number | null;
  }>;
  termSubjectResults?: Array<{
    termId: string;
    subjectResults: SubjectScoreResult[];
  }>;
  examResults: StudentExamScore[];
}

export interface SubjectScoreResult {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  examCount: number;
  averagePercentage: number | null;
  classAveragePercentage: number | null;
}

export interface StudentExamScore {
  id: string;
  examId: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  status: "IN_PROGRESS" | "SUBMITTED";
  score: number | null;
  totalPoints: number;
  percentage: number | null;
  correctCount: number | null;
  startedAt: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  termId: string | null;
  termName: string | null;
  academicYearName: string | null;
}
