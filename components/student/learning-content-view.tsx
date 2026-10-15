"use client";
/* eslint-disable @next/next/no-img-element -- Short-lived private S3 URLs are rendered directly after authorization. */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { contentService } from '@/lib/content-api';
import { progressService } from '@/lib/progress-api';
import { academicDataService } from '@/lib/assessment-api';
import type { ClassTopic, LessonResource, StudentCourseTopic, StudentCourseMaterial } from '@/types/assessment';
import type { StudentCourseProgress, ProgressStatus } from '@/types/progress';
import { StudentAssignmentList } from '@/components/assignments/student-assignment';
import { BookOpen, FileAudio, FileImage, FileText, Film, Link2 } from 'lucide-react';

const statusText: Record<ProgressStatus, string> = {
  NOT_STARTED: 'Chưa bắt đầu', IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Đã hoàn thành', EXCUSED: 'Được miễn',
};
const resourceLabel: Record<LessonResource['type'], string> = {
  FILE: 'Tài liệu', PDF: 'Tài liệu PDF', DOCUMENT: 'Tài liệu Word, PowerPoint hoặc Excel',
  IMAGE: 'Hình ảnh', VIDEO: 'Video bài học', AUDIO: 'Âm thanh', LINK: 'Liên kết học tập',
};
const resourceAction = (type: LessonResource['type']) => type === 'VIDEO' ? 'Xem video' : type === 'AUDIO' ? 'Nghe bài' : type === 'IMAGE' ? 'Xem ảnh' : type === 'LINK' ? 'Mở liên kết' : 'Xem tài liệu';
const resourceIcon = (type: LessonResource['type']) => type === 'VIDEO' ? Film : type === 'AUDIO' ? FileAudio : type === 'IMAGE' ? FileImage : type === 'LINK' ? Link2 : FileText;

export function LearningContentView({ topics, teacherPreview = false, progress, onProgressChange }: {
  topics: Array<StudentCourseTopic | ClassTopic>; teacherPreview?: boolean;
  progress?: StudentCourseProgress | null; onProgressChange?: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [assignmentLessonId, setAssignmentLessonId] = useState('');
  const [activeMedia, setActiveMedia] = useState<{ id: string; url: string; kind: 'IMAGE' | 'VIDEO' | 'AUDIO' } | null>(null);
  async function open(resource?: LessonResource, material?: StudentCourseMaterial) {
    const id = resource?.id ?? material?.id ?? '';
    setBusy(id); setError('');
    try {
      const file = material ?? resource?.material;
      const access = resource && !resource.legacy
        ? await contentService.resourceAccess(resource.id, !teacherPreview)
        : file ? teacherPreview ? await academicDataService.getMaterialPreviewUrl(file.id)
          : await academicDataService.getStudentMaterialPreviewUrl(file.id) : null;
      if (access && resource && ['IMAGE', 'VIDEO', 'AUDIO'].includes(resource.type) && 'kind' in access && access.kind === 'FILE')
        setActiveMedia({ id, url: access.url, kind: resource.type as 'IMAGE' | 'VIDEO' | 'AUDIO' });
      else if (access) window.open(access.url, '_blank', 'noopener,noreferrer');
      if (resource && !resource.legacy && !teacherPreview) onProgressChange?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể mở tài liệu'); }
    finally { setBusy(''); }
  }
  async function markEmptyLesson(lessonId: string) {
    setBusy(lessonId); setError('');
    try { await progressService.completeEmptyLesson(lessonId); onProgressChange?.(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể hoàn thành bài học'); }
    finally { setBusy(''); }
  }
  const visible = topics.filter((topic) => teacherPreview || !topic.status || topic.status === 'PUBLISHED');
  return <div className="space-y-3">
    {error ? <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {!visible.length ? <p className="p-6 text-center text-sm text-slate-500">Giáo viên chưa chia sẻ bài học hoặc tài liệu cho môn này.</p> : null}
    {visible.map((topic, index) => {
      const topicProgress = progress?.topics.find((item) => item.id === topic.id);
      return <details key={topic.id} className="group rounded-xl border border-slate-200 bg-white open:border-blue-200" open={teacherPreview || visible.length === 1 ? true : undefined}>
        <summary className="cursor-pointer px-4 py-3 font-bold text-slate-900 hover:bg-slate-50"><span className="inline-flex items-center gap-2"><BookOpen className="size-4 text-brand-600" />Chủ đề {index + 1}: {topic.name}</span>
          {teacherPreview ? <span className="ml-2 text-xs text-slate-500">{topic.status ?? 'PUBLISHED'}</span>
            : topicProgress ? <span className="ml-2 text-xs font-normal text-brand-700">{topicProgress.completedLessons}/{topicProgress.requiredLessons} bài · {topicProgress.percent}%</span> : null}</summary>
        {topic.description ? <p className="px-4 pb-3 text-sm text-slate-500">{topic.description}</p> : null}
        <div className="space-y-2 px-4 pb-4">{topic.lessons !== undefined
          ? topic.lessons.filter((lesson) => teacherPreview || lesson.status === 'PUBLISHED').map((lesson, i) => {
            const lessonProgress = topicProgress?.lessons.find((item) => item.id === lesson.id);
            const visibleResources = lesson.resources.filter((resource) => teacherPreview || resource.status === 'PUBLISHED');
            return <details key={lesson.id} className="rounded-lg border border-slate-200 bg-white open:border-blue-100" open={teacherPreview || topic.lessons?.filter((item) => item.status === 'PUBLISHED').length === 1 ? true : undefined}>
              <summary className="cursor-pointer px-3 py-3 text-sm font-bold hover:bg-slate-50">Bài {i + 1}: {lesson.title}
                {teacherPreview ? <span className="ml-2 text-xs font-normal text-slate-500">{lesson.status}{lesson.requiredForCompletion === false ? ' · Tùy chọn' : ''}</span>
                  : lessonProgress ? <span className="ml-2 text-xs font-normal text-brand-700">{statusText[lessonProgress.status]} · {lessonProgress.percent}%</span> : null}</summary>
              <div className="space-y-3 px-3 pb-3">
                {lesson.description ? <p className="whitespace-pre-wrap text-sm text-slate-500">{lesson.description}</p> : null}
                {lesson.content ? <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{lesson.content}</div> : null}
                {lessonProgress?.protectedByPriorRevision ? <p className="text-xs text-amber-700">Đã hoàn thành theo yêu cầu phiên bản {lessonProgress.completedRevision}; yêu cầu mới chưa mở lại kết quả cũ.</p> : null}
                {visibleResources.length ? <h4 className="pt-1 text-sm font-bold text-slate-800">Tài liệu học tập <span className="ml-1 text-xs font-normal text-slate-500">({visibleResources.length})</span></h4> : null}
                {visibleResources.map((resource) => {
                  const activity = lessonProgress?.activities.find((item) => item.type === 'RESOURCE' && item.id === resource.id);
                  const Icon = resourceIcon(resource.type);
                  return <div key={resource.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-600"><Icon className="size-5" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-900">{resource.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{resourceLabel[resource.type]}{resource.requiredForCompletion === false ? ' · Đọc thêm' : ' · Cần xem'}
                        {activity?.status === 'COMPLETED' ? ' · Đã mở' : ''}</p>
                      {resource.description ? <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{resource.description}</p> : null}</div>
                    </div><Button variant="outline" size="sm" className="shrink-0 self-start sm:self-center" disabled={busy === resource.id || resource.material?.status === 'PENDING'} onClick={() => void open(resource)}>{resourceAction(resource.type)}</Button></div>
                    {activeMedia?.id === resource.id && activeMedia.kind === 'VIDEO' ? <video className="mt-3 max-h-[70vh] w-full rounded-lg" controls preload="metadata" src={activeMedia.url}>Trình duyệt không hỗ trợ video.</video> : null}
                    {activeMedia?.id === resource.id && activeMedia.kind === 'AUDIO' ? <audio className="mt-3 w-full" controls preload="metadata" src={activeMedia.url}>Trình duyệt không hỗ trợ audio.</audio> : null}
                    {activeMedia?.id === resource.id && activeMedia.kind === 'IMAGE' ? <img className="mt-3 max-h-[70vh] max-w-full rounded-lg object-contain" src={activeMedia.url} alt={resource.title} /> : null}
                  </div>;
                })}
                {!visibleResources.length ? <p className="text-xs text-slate-500">Bài này chưa có tài liệu đính kèm.</p> : null}
                {!teacherPreview && lessonProgress ? <div className="space-y-1 text-xs text-slate-600">
                  {lessonProgress.activities.filter((activity) => activity.type !== 'RESOURCE').map((activity) =>
                    <p key={`${activity.type}:${activity.id}`}>{activity.type === 'ASSIGNMENT' ? 'Bài tập' : 'Bài kiểm tra'}: {activity.title} · {statusText[activity.status]}{activity.late ? ' · Nộp trễ' : ''}{activity.required ? '' : ' · Tùy chọn'}</p>)}
                </div> : null}
                {!teacherPreview && lessonProgress?.requiredActivities === 0 && lessonProgress.status !== 'COMPLETED'
                  ? <Button variant="outline" size="sm" disabled={busy === lesson.id} onClick={() => void markEmptyLesson(lesson.id)}>Đánh dấu đã học bài này</Button> : null}
              </div>
              {!teacherPreview ? <div className="px-3 pb-3"><Button variant="outline" size="sm" onClick={() => setAssignmentLessonId(assignmentLessonId === lesson.id ? '' : lesson.id)}>Xem bài tập của bài học</Button>
                {assignmentLessonId === lesson.id ? <div className="mt-3"><StudentAssignmentList lessonId={lesson.id} /></div> : null}</div> : null}
            </details>;
          })
          : topic.materials.map((material) => <div key={material.id} className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"><span className="break-words text-sm font-semibold">{material.originalName}</span><Button variant="outline" size="sm" disabled={busy === material.id} onClick={() => void open(undefined, material)}>Xem tài liệu</Button></div>)}</div>
      </details>;
    })}
  </div>;
}
