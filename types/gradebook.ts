import type { AssessmentPurpose, InternalResultGroup } from '@/lib/internal-results';
export type GradeMark = number | "PASS" | "FAIL" | null;
export interface GradeMarks {
  regular: GradeMark[];
  midterm: GradeMark;
  final: GradeMark;
}
export interface GradeOutcome {
  average: number | null;
  assessment: "PASS" | "FAIL" | null;
  complete: boolean;
}
export interface GradePolicy {
  regularColumns?: number;
  regularWeight?: number;
  midtermWeight?: number;
  finalWeight?: number;
  resultMode?: "INTERNAL" | "LEGACY" | "DUAL" | null;
  assessmentMode: "NUMERIC" | "COMMENT";
  annualPeriods: number;
  specialized: boolean;
}
export interface GradeScope {
  classId: string;
  subjectId: string;
  termId: string;
}
export interface Gradebook extends GradePolicy, GradeScope {
  resultMode?: "INTERNAL" | "LEGACY" | "DUAL" | null;
  id: string;
  revision: number;
}
export interface GradeRecord {
  marks: GradeMarks;
  comment: string;
  updatedAt: string;
}
export interface GradeItem {
  resultChannel?: "INTERNAL" | "OFFICIAL";
  revision?: number;
  assessmentPurpose?: AssessmentPurpose | null;
  id: string;
  title: string;
  sourceType: "ASSIGNMENT" | "EXAM" | "MANUAL" | "LEGACY";
  sourceId: string | null;
  maxScore: number;
  status: "PENDING_GRADEBOOK_CONFIGURATION" | "ACTIVE" | "ARCHIVED";
  officialSlot: string | null;
}
export interface StudentGrade {
  feedback?: string | null;
  publishedFeedback?: string | null;
  id: string;
  derived?: boolean;
  gradeItemId: string;
  studentId: string;
  evaluationStatus: "NOT_GRADED" | "GRADED" | "MISSING" | "EXCUSED";
  publicationStatus: "DRAFT" | "PUBLISHED";
  rawScore: number | null;
  assessmentValue: "PASS" | "FAIL" | null;
  publishedRawScore: number | null;
  publishedAssessmentValue: "PASS" | "FAIL" | null;
  publishedEvaluationStatus: "NOT_GRADED" | "GRADED" | "MISSING" | "EXCUSED" | null;
  publishedAt: string | null;
  sourceAttemptId: string | null;
  publishedSourceAttemptId: string | null;
}
export interface GradebookView {
  book: Gradebook | null;
  pendingGradeItemCount: number;
  items: GradeItem[];
  requiredRegular: number | null;
  term: { status: string };
  year?: { status: string };
  schoolClass?: { isActive: boolean };
  students: Array<{
    id: string;
    fullName: string;
    accountName: string;
    isActive?: boolean;
    hasDraft?: boolean;
    hasPublished?: boolean;
    record: GradeRecord | null;
    internalGroups?: InternalResultGroup[];
    itemGrades: StudentGrade[];
    outcome: GradeOutcome | null;
  }>;
}

export interface GradeImportPreview {
  revision: number;
  totalRows: number;
  changedRows: number;
  rows: Array<{
    row: number;
    studentId: string;
    fullName: string;
    accountName: string;
    marks: GradeMarks;
    comment: string;
  }>;
  errors: Array<{ row: number; message: string }>;
}
export interface LearningLevel {
  level: "TOT" | "KHA" | "DAT" | "CHUA_DAT" | "INCOMPLETE";
  adjusted: boolean;
}
export interface GradeReport {
  years: Array<{ id: string; name: string; status: string }>;
  terms: Array<{
    id: string;
    name: string;
    academicYearId: string;
    status: string;
  }>;
  classes: Array<{
    id: string;
    name: string;
    code: string;
    academicYearId: string;
  }>;
  results: Array<{
    classId: string;
    academicYearId: string;
    annualLevel: LearningLevel;
    semesterLevels: Array<LearningLevel & { termId: string }>;
    subjects: Array<{
      subjectId: string;
      subjectName: string;
      subjectCode: string;
      annual: GradeOutcome;
      semesters: Array<{
        termId: string;
        displayOrder: number;
        policy: GradePolicy | null;
        marks: GradeMarks | null;
        comment: string;
        updatedAt: string | null;
        outcome: GradeOutcome;
        items: Array<GradeItem & {
          evaluationStatus: "NOT_GRADED" | "GRADED" | "MISSING" | "EXCUSED";
          publicationStatus: "DRAFT" | "PUBLISHED";
          score: number | null;
          assessment: "PASS" | "FAIL" | null;
          sourceAttemptId: string | null;
          publishedAt: string | null;
        }>;
      }>;
    }>;
  }>;
}
