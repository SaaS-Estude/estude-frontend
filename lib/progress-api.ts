import { authenticatedRequest } from './auth-api';
import type { StudentCourseProgress, TeacherCourseProgress } from '@/types/progress';

export const progressService = {
  studentCourse: (classId: string, subjectId: string) =>
    authenticatedRequest<StudentCourseProgress>(`/student/courses/${encodeURIComponent(classId)}/${encodeURIComponent(subjectId)}/progress`),
  teacherCourse: (classId: string, subjectId: string) =>
    authenticatedRequest<TeacherCourseProgress>(`/teacher/assigned-classes/${encodeURIComponent(classId)}/subjects/${encodeURIComponent(subjectId)}/progress`),
  completeEmptyLesson: (lessonId: string) =>
    authenticatedRequest<{ lessonId: string; status: 'COMPLETED' }>(`/student/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST' }),
  lessonHistory: (lessonId: string) =>
    authenticatedRequest<{ lessonId: string; completions: Array<{ requirementRevision: number; completedAt: string }> }>(`/student/lessons/${encodeURIComponent(lessonId)}/progress/history`),
};
