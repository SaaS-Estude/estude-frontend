"use client";

import { StudentShell } from '@/components/student/student-shell';
import { InternalGradeReport } from '@/components/assessment/internal-grade-report';

export function StudentGradesPage() {
  return <StudentShell><InternalGradeReport /></StudentShell>;
}
