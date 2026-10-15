export const assessmentPurposeLabels = {
  REGULAR: "Đánh giá thường xuyên nội bộ",
  PRACTICE: "Luyện tập",
  MOCK_MIDTERM: "Thi thử giữa kỳ",
  MOCK_FINAL: "Thi thử cuối kỳ",
  LEGACY_REVIEW: "Dữ liệu cũ cần phân loại",
};
export type AssessmentPurpose = keyof typeof assessmentPurposeLabels;
export type InternalResultQuery = { academicYearId?: string; termId?: string; classId?: string; subjectId?: string; page?: number; pageSize?: number };
export interface InternalResultGroup {
  purpose: AssessmentPurpose; publishedCount: number; scoredCount: number; average: number | null; passCount: number; failCount: number;
}
export interface InternalResultReport {
  years: Array<{id: string; name: string; status: string; startsAt: string}>;
  terms: Array<{id: string; academicYearId: string; name: string; status: string; displayOrder: number; startsAt: string}>;
  classes: Array<{id: string; academicYearId: string; name: string; code: string}>;
  subjects: Array<{id: string; name: string}>;
  rows: Array<{classId: string; academicYearId: string; termId: string; subjectId: string; subjectName: string; assignedCount: number; completedCount: number; completionPercentage: number | null; excusedCount: number; groups: InternalResultGroup[]}>;
  items: Array<{id: string; classId: string; subjectId: string; termId: string; title: string; sourceType: string; assessmentPurpose: AssessmentPurpose; score: number | null; maxScore: number; normalizedScore: number | null; assessment: string | null; evaluationStatus: string; publicationStatus: string; completed: boolean; excused: boolean; feedback: string; publishedAt: string | null; archived: boolean}>;
  pagination: {page: number; pageSize: number; total: number}; unclassifiedCount: number;
}
export function internalResultText(item: InternalResultReport['items'][number]) {
  if (item.excused) return 'Được miễn';
  if (!item.publishedAt) return item.evaluationStatus === 'MISSING' ? 'Chưa hoàn thành' : 'Chưa công bố điểm';
  if (item.evaluationStatus === 'MISSING') return 'Chưa nộp';
  if (item.evaluationStatus !== 'GRADED') return 'Chưa chấm';
  if (item.score !== null) return `${item.score}/${item.maxScore}`;
  return item.assessment === 'PASS' ? 'Đạt' : item.assessment === 'FAIL' ? 'Chưa đạt' : 'Chưa có điểm';
}
