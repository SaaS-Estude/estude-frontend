import type { AssessmentPurpose } from '@/lib/internal-results';
import type { ContentStatus } from "./assessment";

export type SubmissionType = "TEXT" | "FILE" | "TEXT_AND_FILE";
export type AssignmentState =
  | "NOT_SUBMITTED"
  | "NO_CURRENT_ACCESS"
  | "MISSING"
  | "EXCUSED"
  | "WAITING_FOR_GRADING"
  | "GRADED_DRAFT"
  | "RETURNED";
export interface Assignment {
  assessmentPurpose?: AssessmentPurpose | null;
  id: string;
  lessonId: string;
  termId: string;
  title: string;
  description: string;
  instructions: string;
  status: ContentStatus | "HISTORY";
  maxScore: number;
  requiredForCompletion?: boolean;
  completionRule?: 'SUBMITTED' | 'GRADED' | 'PASSED';
  passingScore?: number | null;
  submissionType: SubmissionType;
  availableFrom: string | null;
  dueAt: string | null;
  cutoffAt: string | null;
  allowLateSubmission: boolean;
  allowResubmit: boolean;
  maxAttempts: number | null;
  createdBy?: string;
  publishedAt: string | null;
  revision: number;
  audienceCount?: number;
  submissionCount?: number;
  gradedCount?: number;
}
export interface SubmissionFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: "PENDING" | "READY";
  sha256?: string;
}
export interface SubmissionAttempt {
  id: string;
  assignmentId: string;
  studentId: string;
  attemptNumber: number;
  submittedAt: string;
  isLate: boolean;
  submissionState: "SUBMITTED" | "SUBMITTED_LATE";
  status: "WAITING_FOR_GRADING" | "GRADED_DRAFT" | "RETURNED";
  textContent: string;
  files: SubmissionFile[];
  maxScore: number;
  score: number | null;
  feedback: string;
  returnedAt: string | null;
  returnedScore: number | null;
  returnedFeedback: string | null;
  revision?: number;
  assignmentSnapshot: {
    title?: string;
    instructions?: string;
    dueAt?: string | null;
    cutoffAt?: string | null;
  };
}
export interface AssignmentTerm {
  id: string;
  name: string;
  status: string;
}
export interface AssignmentRecipient {
  id: string;
  studentId: string;
  studentName: string;
  studentAccount: string;
  enrollmentId: string;
  assignedAt: string;
  excusedAt: string | null;
  excuseReason: string;
  revision: number;
  state: AssignmentState;
  latest: SubmissionAttempt | null;
  attempts: SubmissionAttempt[];
}
export interface TeacherAssignmentDetail {
  classId?: string;
  assignment: Assignment;
  term: AssignmentTerm;
  serverNow: string;
  summary: {
    assigned: number;
    expected: number;
    expectedSubmitted: number;
    submitted: number;
    onTime: number;
    late: number;
    notSubmitted: number;
    missing: number;
    excused: number;
    ungraded: number;
    graded: number;
    returned: number;
    attemptCount: number;
  };
  recipients: AssignmentRecipient[];
}
export interface StudentAssignmentDetail {
  assignment: Assignment;
  state: AssignmentState;
  serverNow: string;
  canSubmit: boolean;
  historyOnly: boolean;
  participationStatus?: 'ASSIGNED' | 'NO_CURRENT_ACCESS';
  window: "NOT_OPEN" | "ON_TIME" | "LATE" | "CLOSED";
  attempts: SubmissionAttempt[];
  recipient: {
    assignedAt: string;
    excusedAt: string | null;
    excuseReason: string;
  };
}
export interface AssignmentInput {
  assessmentPurpose?: AssessmentPurpose;
  title: string;
  termId: string;
  description: string;
  instructions: string;
  maxScore: number;
  requiredForCompletion?: boolean;
  completionRule?: 'SUBMITTED' | 'GRADED' | 'PASSED';
  passingScore?: number | null;
  submissionType: SubmissionType;
  availableFrom: string | null;
  dueAt: string | null;
  cutoffAt: string | null;
  allowLateSubmission: boolean;
  allowResubmit: boolean;
  maxAttempts: number | null;
}
export const assignmentStateLabels: Record<AssignmentState, string> = {
  NO_CURRENT_ACCESS: "Không còn quyền làm bài mới",
  NOT_SUBMITTED: "Chưa nộp",
  MISSING: "Thiếu bài",
  EXCUSED: "Được miễn",
  WAITING_FOR_GRADING: "Chờ chấm",
  GRADED_DRAFT: "Điểm nháp",
  RETURNED: "Đã trả kết quả",
};
