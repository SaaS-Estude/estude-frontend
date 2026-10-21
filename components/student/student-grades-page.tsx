"use client";

import { StudentShell } from '@/components/student/student-shell';
import { GradeReports } from '@/components/assessment/grade-reports';

export function StudentGradesPage() {
  return <StudentShell><GradeReports /></StudentShell>;
}
