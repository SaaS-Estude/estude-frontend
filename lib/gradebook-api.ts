import type { InternalResultQuery, InternalResultReport } from './internal-results';
import { authenticatedBlobRequest, authenticatedRequest } from "./auth-api";
import type {
  Gradebook,
  GradebookView,
  GradeImportPreview,
  GradeMarks,
  GradePolicy,
  GradeReport,
  GradeScope,
} from "@/types/gradebook";

export const gradebookService = {
  get(scope: GradeScope & {courseOfferingId?:string}) {
    return authenticatedRequest<GradebookView>(
      `/gradebooks?${new URLSearchParams(Object.fromEntries(Object.entries(scope).filter(([,value])=>value !== undefined)) as Record<string,string>)}`,
    );
  },
  configure(input: GradeScope & GradePolicy & { revision: number; courseOfferingId?:string }) {
    return authenticatedRequest<Gradebook>("/gradebooks/configure", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  save(
    id: string,
    input: {
      studentId: string;
      marks: GradeMarks;
      comment: string;
      revision: number;
    },
  ) {
    return authenticatedRequest(`/gradebooks/${id}/records`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  downloadImportTemplate(id: string): Promise<Blob> {
    return authenticatedBlobRequest(`/gradebooks/${encodeURIComponent(id)}/import-template`);
  },
  previewImport(id: string, file: File): Promise<GradeImportPreview> {
    const formData = new FormData();
    formData.append("file", file);
    return authenticatedRequest<GradeImportPreview>(`/gradebooks/${encodeURIComponent(id)}/import-preview`, {
      method: "POST",
      body: formData,
    });
  },
  saveBulk(id: string, revision: number, records: Array<{ studentId: string; marks: GradeMarks; comment: string }>): Promise<{ count: number; revision: number }> {
    return authenticatedRequest<{ count: number; revision: number }>(`/gradebooks/${encodeURIComponent(id)}/records/bulk`, {
      method: "POST",
      body: JSON.stringify({ revision, records }),
    });
  },
  internalReport(studentId = "me", query: InternalResultQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]));
    return authenticatedRequest<InternalResultReport>(`/gradebooks/students/${encodeURIComponent(studentId)}/internal-results?${params}`);
  },
  report(studentId = "me") {
    return authenticatedRequest<GradeReport>(
      `/gradebooks/students/${encodeURIComponent(studentId)}`,
    );
  },
  createManualItem(id: string, input: { title: string; maxScore: number; assessmentPurpose?: import("./internal-results").AssessmentPurpose }) {
    return authenticatedRequest(`/gradebooks/${encodeURIComponent(id)}/items/manual`, {
      method: "POST", body: JSON.stringify(input),
    });
  },
  saveManualGrade(id: string, itemId: string, input: {
    studentId: string;
    evaluationStatus: "NOT_GRADED" | "GRADED" | "MISSING" | "EXCUSED";
    score: number | null;
    assessment?: "PASS" | "FAIL" | null;
    publish: boolean;
    feedback?: string;
    reason: string;
  }) {
    return authenticatedRequest(`/gradebooks/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/grades`, {
      method: "POST", body: JSON.stringify(input),
    });
  },
  reviewLegacyPurpose(id: string, itemId: string, input: { assessmentPurpose: import('./internal-results').AssessmentPurpose; revision: number; reason: string }) {
    return authenticatedRequest(`/gradebooks/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/purpose-review`, { method: 'POST', body: JSON.stringify(input) });
  },
  mapSlot(id: string, itemId: string, slotKey: string | null, reason: string) {
    return authenticatedRequest(`/gradebooks/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/slot`, {
      method: "POST", body: JSON.stringify({ slotKey, reason }),
    });
  },
};
