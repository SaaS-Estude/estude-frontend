import { authenticatedRequest } from './auth-api';
import type { ClassTopic, ClassTopicInput, ContentStatus, ContentWindow, Lesson, LessonInput, LessonResource, LearningMaterial } from '@/types/assessment';
import { courseResourceContentType } from './course-resource-file';

const request = <T>(path: string, method: string, payload?: unknown) => authenticatedRequest<T>(path, { method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
export const contentService = {
  topics: (classId: string) => authenticatedRequest<ClassTopic[]>(`/teacher/assigned-classes/${encodeURIComponent(classId)}/topics`),
  createTopic: (classId: string, payload: ClassTopicInput) => request<ClassTopic>(`/teacher/assigned-classes/${encodeURIComponent(classId)}/topics`, 'POST', payload),
  updateTopic: (id: string, payload: Partial<ClassTopicInput>) => request<ClassTopic>(`/teacher/class-topics/${id}`, 'PATCH', payload),
  topicStatus: (id: string, status: ContentStatus, window: ContentWindow = {}) => request<ClassTopic>(`/teacher/class-topics/${id}/lifecycle`, 'PATCH', { status, ...window }),
  preview: (id: string) => authenticatedRequest<ClassTopic>(`/teacher/class-topics/${id}/preview`),
  createLesson: (topicId: string, payload: LessonInput) => request<Lesson>(`/teacher/class-topics/${topicId}/lessons`, 'POST', payload),
  updateLesson: (id: string, payload: Partial<LessonInput>) => request<Lesson>(`/teacher/lessons/${id}`, 'PATCH', payload),
  lessonStatus: (id: string, status: ContentStatus, window: ContentWindow = {}) => request<Lesson>(`/teacher/lessons/${id}/lifecycle`, 'PATCH', { status, ...window }),
  resourceStatus: (id: string, status: ContentStatus, window: ContentWindow = {}) => request<LessonResource>(`/teacher/lesson-resources/${id}/lifecycle`, 'PATCH', { status, ...window }),
  showResourceToStudents: (id: string) => request<LessonResource>(`/teacher/lesson-resources/${id}/show-to-students`, 'POST'),
  updateResource: (id: string, payload: { title?: string; description?: string; requiredForCompletion?: boolean } & ContentWindow) => request<LessonResource>(`/teacher/lesson-resources/${id}`, 'PATCH', payload),
  addLink: (lessonId: string, title: string, linkUrl: string, description = '', requiredForCompletion = true) => request<LessonResource>(`/teacher/lessons/${lessonId}/resources`, 'POST', { type: 'LINK', title, linkUrl, description, requiredForCompletion }),
  addMaterial: (lessonId: string, materialId: string, title: string, requiredForCompletion = true) => request<LessonResource>(`/teacher/lessons/${lessonId}/resources`, 'POST', { type: 'FILE', title, materialId, requiredForCompletion }),
  reorderTopics: (classId: string, subjectId: string, ids: string[]) => request(`/teacher/assigned-classes/${classId}/subjects/${subjectId}/topics/reorder`, 'POST', { ids }),
  reorderLessons: (topicId: string, ids: string[]) => request(`/teacher/class-topics/${topicId}/lessons/reorder`, 'POST', { ids }),
  reorderResources: (lessonId: string, ids: string[]) => request(`/teacher/lessons/${lessonId}/resources/reorder`, 'POST', { ids }),
  deleteTopic: (id: string) => request(`/teacher/class-topics/${id}`, 'DELETE'),
  deleteLesson: (id: string) => request(`/teacher/lessons/${id}`, 'DELETE'),
  deleteResource: (id: string) => request(`/teacher/lesson-resources/${id}`, 'DELETE'),
  resourceAccess: (id: string, student = false) => authenticatedRequest<{ url: string; kind: 'FILE' | 'LINK'; expiresIn: number }>(`/${student ? 'student' : 'teacher'}/lesson-resources/${id}/access`),
  upload: (lessonId: string, file: File, onProgress?: UploadProgress) => uploadFile(`/teacher/lessons/${lessonId}/materials/upload-url`, file, onProgress),
  uploadTopic: (topicId: string, file: File, onProgress?: UploadProgress) => uploadFile(`/teacher/class-topics/${topicId}/materials/upload-url`, file, onProgress),
};

type UploadProgress = (phase: 'authorizing' | 'uploading' | 'confirming', percent: number) => void;

async function uploadFile(path: string, file: File, onProgress?: UploadProgress) {
    const contentType = courseResourceContentType(file);
    onProgress?.('authorizing', 0);
    const session = await request<{ material: LearningMaterial; resource: LessonResource; uploadUrl: string; method: 'PUT' }>(path, 'POST', { fileName: file.name, contentType, fileSize: file.size });
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', session.uploadUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.('uploading', Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Không thể tải tài liệu lên S3'));
      xhr.onerror = () => reject(new Error('Không thể tải tài liệu lên S3'));
      xhr.send(file);
    });
    onProgress?.('confirming', 100);
    await request(`/teacher/materials/${session.material.id}/confirm`, 'POST');
    return session.resource;
}
