"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Eye, FileText, LoaderCircle, MoreHorizontal, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useActionNotification } from '@/components/ui/action-notification';
import { contentService } from '@/lib/content-api';
import { academicDataService } from '@/lib/assessment-api';
import { getVietnameseSubjectName } from '@/lib/subject-localization';
import type { ClassTopic, ContentStatus, ContentWindow, Lesson, LessonResource, LearningMaterial, TeacherAssignedClass } from '@/types/assessment';
import { LearningContentView } from '@/components/student/learning-content-view';
import { TeacherAssignmentPanel } from '@/components/assignments/teacher-assignment-panel';
import { TeacherProgressPanel } from '@/components/teacher/teacher-progress-panel';
import { selectedTeacherSubjectId } from '@/lib/teacher-course-selection';
import { COURSE_RESOURCE_ACCEPT, courseResourceContentType } from '@/lib/course-resource-file';

const labels: Record<ContentStatus, string> = { DRAFT: 'Chưa cho học sinh xem', PUBLISHED: 'Đã bật cho học sinh', ARCHIVED: 'Đã ẩn khỏi môn học' };
const field = 'h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-500';
type Editor = { kind: 'topic' | 'lesson' | 'resource'; id?: string };
const blank = { title: '', description: '', content: '', availableFrom: '', availableUntil: '', requiredForCompletion: true };
const localDate = (value?: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
const windowInput = (form: typeof blank): ContentWindow => ({ availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : null, availableUntil: form.availableUntil ? new Date(form.availableUntil).toISOString() : null });

export function CourseContentPanel({ schoolClass }: { schoolClass: TeacherAssignedClass }) {
  const { notify } = useActionNotification();
  const [topics, setTopics] = useState<ClassTopic[]>([]);
  const [subjectId, setSubjectId] = useState(schoolClass.subjects[0]?.id ?? '');
  const [topicId, setTopicId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [form, setForm] = useState(blank);
  const [preview, setPreview] = useState<ClassTopic | null>(null);
  const [remove, setRemove] = useState<{ kind: 'topic' | 'lesson' | 'resource'; id: string; title: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTarget, setAddTarget] = useState<'topic' | 'lesson'>('lesson');
  const [addMethod, setAddMethod] = useState<'file' | 'library' | 'link'>('file');
  const [libraryError, setLibraryError] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [library, setLibrary] = useState<LearningMaterial[]>([]);
  const [materialId, setMaterialId] = useState('');
  const [uploadInfo, setUploadInfo] = useState<{ name: string; type: string; size: number; phase: string; percent: number } | null>(null);
  const [shareAfterUpload, setShareAfterUpload] = useState(true);
  const topic = topics.find((t) => t.id === topicId && t.subjectId === subjectId);
  const lesson = topic?.lessons?.find((l) => l.id === lessonId) ?? (topic?.lessons?.length === 1 ? topic.lessons[0] : undefined);
  const scoped = topics.filter((t) => t.subjectId === subjectId);

  const load = useCallback(async (clearError = true) => {
    setLoading(true);
    try { setTopics(await contentService.topics(schoolClass.id)); if (clearError) setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tải nội dung'); }
    finally { setLoading(false); }
  }, [schoolClass.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setSubjectId(selectedTeacherSubjectId(schoolClass.subjects, window.location.search));
    setTopicId(''); setLessonId('');
  }, [schoolClass.id, schoolClass.subjects]);

  async function run(work: () => Promise<unknown>, message = 'Đã cập nhật nội dung') {
    setBusy(true); setError('');
    try { await work(); await load(); notify(message, { key: 'course-content' }); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể cập nhật nội dung'); return false; }
    finally { setBusy(false); }
  }
  function edit(kind: Editor['kind'], item?: ClassTopic | Lesson | LessonResource) {
    setEditor({ kind, id: item?.id });
    setForm({ ...blank, title: item ? 'name' in item ? item.name : item.title : '', description: item && 'description' in item ? item.description ?? '' : '', content: item && 'content' in item ? item.content : '', availableFrom: localDate(item?.availableFrom), availableUntil: localDate(item?.availableUntil), requiredForCompletion: item && 'requiredForCompletion' in item ? item.requiredForCompletion !== false : true });
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editor) return;
    const window = windowInput(form);
    const success = await run(() => editor.kind === 'topic'
      ? editor.id ? contentService.updateTopic(editor.id, { name: form.title, description: form.description, ...window }) : contentService.createTopic(schoolClass.id, { subjectId, name: form.title, description: form.description, ...window })
      : editor.kind === 'lesson'
        ? editor.id ? contentService.updateLesson(editor.id, { title: form.title, description: form.description, content: form.content, requiredForCompletion: form.requiredForCompletion, ...window }) : contentService.createLesson(topicId, { title: form.title, description: form.description, content: form.content, requiredForCompletion: form.requiredForCompletion, ...window })
      : contentService.updateResource(editor.id!, { title: form.title, description: form.description, requiredForCompletion: form.requiredForCompletion, ...window }));
    if (success) setEditor(null);
  }
  function status(kind: Editor['kind'], id: string, value: ContentStatus) {
    return run(() => kind === 'topic' ? contentService.topicStatus(id, value) : kind === 'lesson' ? contentService.lessonStatus(id, value) : kind === 'resource' && value === 'PUBLISHED' ? contentService.showResourceToStudents(id) : contentService.resourceStatus(id, value),
      kind === 'resource' && value === 'PUBLISHED' ? 'Đã bật tài liệu cho học sinh theo thời gian hiển thị đã đặt' : 'Đã cập nhật nội dung');
  }
  async function openPreview() {
    if (!topic) return;
    setError(''); setBusy(true);
    try { setPreview(await contentService.preview(topic.id)); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể xem trước'); } finally { setBusy(false); }
  }
  function openAdd(target: 'topic' | 'lesson') {
    setAddTarget(target); setAddMethod('file'); setShareAfterUpload(true); setAddOpen(true); setLinkTitle(''); setLinkDescription(''); setLinkUrl(''); setMaterialId(''); setError(''); setLibraryError('');
  }
  async function loadLibrary() {
    setLibraryLoading(true); setLibraryError('');
    try { setLibrary(await academicDataService.getMaterialLibrary()); }
    catch (cause) { setLibraryError(cause instanceof Error ? cause.message : 'Không thể tải thư viện'); }
    finally { setLibraryLoading(false); }
  }
  async function upload(files: FileList | null) {
    if (!files?.length || (addTarget === 'lesson' ? !lesson : !topic)) return;
    try { for (const file of Array.from(files)) courseResourceContentType(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'File không hợp lệ'); return; }
    const success = await run(async () => {
      for (const file of Array.from(files)) {
        setUploadInfo({ name: file.name, type: file.type || 'Loại file chưa xác định', size: file.size, phase: 'Đang chuẩn bị tải lên', percent: 0 });
        const progress = (phase: 'authorizing' | 'uploading' | 'confirming', percent: number) => setUploadInfo({ name: file.name,
          type: file.type || 'Loại file chưa xác định', size: file.size,
          phase: phase === 'authorizing' ? 'Đang chuẩn bị tải lên' : phase === 'uploading' ? 'Đang tải lên' : 'Đang kiểm tra file', percent });
        const resource = addTarget === 'topic' ? await contentService.uploadTopic(topic!.id, file, progress) : await contentService.upload(lesson!.id, file, progress);
        if (addTarget === 'topic') setLessonId(resource.lessonId);
        if (shareAfterUpload) {
          setUploadInfo((current) => current ? { ...current, phase: 'Đang bật cho học sinh', percent: 100 } : null);
          try { await contentService.showResourceToStudents(resource.id); }
          catch (cause) { throw new Error(`Tài liệu đã tải xong và được giữ riêng tư, nhưng chưa bật cho học sinh: ${cause instanceof Error ? cause.message : 'vui lòng kiểm tra nội dung khác trong bài học'}`); }
        }
      }
      setUploadInfo(null);
    }, shareAfterUpload ? 'Đã tải tài liệu và bật cho học sinh theo thời gian hiển thị đã đặt' : 'Đã tải tài liệu, hiện chỉ giáo viên nhìn thấy');
    if (success) setAddOpen(false);
    else {
      setUploadInfo((current) => current ? { ...current, phase: 'Thất bại' } : null);
      await load(false); // Một số file trước file lỗi có thể đã được xác nhận thành công.
    }
  }
  function move<T extends { id: string }>(rows: T[], index: number, delta: number, kind: Editor['kind']) {
    const ids = rows.map((r) => r.id); const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => kind === 'topic' ? contentService.reorderTopics(schoolClass.id, subjectId, ids) : kind === 'lesson' ? contentService.reorderLessons(topicId, ids) : contentService.reorderResources(lesson?.id ?? lessonId, ids));
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div><p className="text-base font-extrabold text-slate-950">Bài học và tài liệu</p><p className="mt-1 text-xs text-slate-500">Chuẩn bị bài học, tải tài liệu và chọn khi nào học sinh được xem.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Môn học trong lớp<select aria-label="Môn học trong lớp" className={field} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); setLessonId(''); }}>{schoolClass.subjects.map((s) => <option key={s.id} value={s.id}>{getVietnameseSubjectName(s)}</option>)}</select></label>
      <Button permission="teaching.create" disabled={busy || !subjectId} onClick={() => edit('topic')}><Plus className="size-4" />Tạo chủ đề</Button></div>
    </div>
    {subjectId ? <div><Button variant="outline" size="sm" onClick={() => setShowProgress((value) => !value)}>{showProgress ? 'Ẩn tiến độ học sinh' : 'Xem tiến độ học sinh'}</Button>{showProgress ? <div className="mt-3"><TeacherProgressPanel classId={schoolClass.id} subjectId={subjectId} /></div> : null}</div> : null}
    {error ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
    {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Đang tải nội dung...</p> : null}
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
      <aside className="space-y-2">{!scoped.length && !loading ? <p className="p-4 text-sm text-slate-500">Chưa có chủ đề. Chủ đề mới chỉ mình bạn nhìn thấy.</p> : null}{scoped.map((t, i) => <section key={t.id} className={`rounded-xl border bg-white p-3 ${topicId === t.id ? 'border-brand-400' : 'border-slate-200'}`}><button className="w-full text-left" onClick={() => { setTopicId(t.id); setLessonId(''); }}><p className="text-sm font-bold">{i + 1}. {t.name}</p><StatusBadge status={t.status ?? 'PUBLISHED'} /><p className="mt-1 text-xs text-slate-500">{t.lessons?.length ?? 0} bài học</p></button><OrderButtons disabled={busy} index={i} length={scoped.length} onMove={(d) => move(scoped, i, d, 'topic')} /></section>)}</aside>
      <main className="space-y-4">{topic ? <>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Chủ đề</p><h3 className="font-bold text-slate-950">{topic.name}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{topic.description}</p>
          <div className="mt-3 flex flex-wrap gap-2"><ContentActions kind="topic" status={topic.status ?? 'PUBLISHED'} publishedAt={topic.publishedAt ?? (topic.status ? null : topic.createdAt)} busy={busy} onEdit={() => edit('topic', topic)} onPreview={() => void openPreview()} onStatus={(s) => void status('topic', topic.id, s)} onDelete={() => setRemove({ kind: 'topic', id: topic.id, title: topic.name })} /><Button permission="teaching.create" disabled={busy || topic.status === 'ARCHIVED'} onClick={() => edit('lesson')}><Plus className="size-4" />Tạo bài học</Button></div>
        </section>
        <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold text-slate-950"><FileText className="size-4 text-brand-600" />Tài liệu học tập</h3><p className="mt-1 text-xs text-slate-600">{(topic.lessons ?? []).reduce((count, row) => count + row.resources.length, 0)} tài liệu trong chủ đề. {lesson && !lesson.legacy ? 'Tài liệu mới sẽ vào bài học đang mở.' : 'Tải vào chủ đề hoặc chọn bài học trước khi tải.'}</p></div><Button permission="materials.create" disabled={busy || topic.status === 'ARCHIVED' || lesson?.status === 'ARCHIVED'} onClick={() => openAdd(lesson && !lesson.legacy ? 'lesson' : 'topic')}><Upload className="size-4" />Tải tài liệu</Button></div>
          {!lesson ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{(topic.lessons ?? []).flatMap((row) => row.resources.map((resource) => <button key={resource.id} type="button" className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-brand-400" onClick={() => setLessonId(row.id)}><BookOpen className="size-4 shrink-0 text-brand-600" /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{resource.title}</span><span className="text-xs text-slate-500">{row.title} · {resource.status === 'PUBLISHED' && ((topic.status ?? 'PUBLISHED') !== 'PUBLISHED' || row.status !== 'PUBLISHED') ? 'Chưa hiển thị' : labels[resource.status]}</span></span></button>))}</div> : null}
          {!(topic.lessons ?? []).some((row) => row.resources.length) ? <p className="mt-3 text-sm text-slate-500">Chưa có tài liệu. Có thể tải PDF, slide, Word, Excel, ảnh, video hoặc âm thanh.</p> : null}</section>
        {(topic.lessons?.length ?? 0) > 1 ? <section className="space-y-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Chọn bài học</p>{topic.lessons!.map((l, i, rows) => <div key={l.id} className={`rounded-xl border bg-white p-3 ${lesson?.id === l.id ? 'border-brand-400' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-3"><button className="flex-1 text-left" onClick={() => setLessonId(l.id)}><p className="font-bold">{i + 1}. {l.title}</p><StatusBadge status={l.status} parentVisible={(topic.status ?? 'PUBLISHED') === 'PUBLISHED'} /></button><OrderButtons disabled={busy || l.legacy} index={i} length={rows.length} onMove={(d) => move(rows, i, d, 'lesson')} /></div></div>)}</section> : !topic.lessons?.length ? <p className="p-4 text-sm text-slate-500">Chưa có bài học trong chủ đề.</p> : null}
        {lesson ? <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Bài học</p><h4 className="font-bold">{lesson.title}</h4><StatusBadge status={lesson.status} parentVisible={(topic.status ?? 'PUBLISHED') === 'PUBLISHED'} /><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{lesson.description}</p><div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{lesson.content}</div>
          <div className="mt-3 flex flex-wrap gap-2"><ContentActions kind="lesson" status={lesson.status} publishedAt={lesson.publishedAt} busy={busy} onEdit={() => edit('lesson', lesson)} onStatus={(s) => void status('lesson', lesson.id, s)} onDelete={() => setRemove({ kind: 'lesson', id: lesson.id, title: lesson.title })} /></div>
          <div className="mt-4 space-y-3">{lesson.resources.map((r, i, rows) => <article key={r.id} className="rounded-lg border border-slate-100 p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold">{r.title}</p><p className="text-xs text-slate-500">{r.type === 'LINK' ? 'Liên kết' : r.type === 'DOCUMENT' ? 'Tài liệu' : r.type}{r.material?.status === 'PENDING' ? ' · Đang tải lên' : ''}</p><StatusBadge status={r.status} parentVisible={(topic.status ?? 'PUBLISHED') === 'PUBLISHED' && lesson.status === 'PUBLISHED'} /></div><OrderButtons disabled={busy || r.legacy} index={i} length={rows.length} onMove={(d) => move(rows, i, d, 'resource')} /></div><div className="mt-2 flex flex-wrap gap-2"><ContentActions kind="resource" status={r.status} publishedAt={r.publishedAt} busy={busy} canShow={r.type === 'LINK' || r.material?.status === 'READY'} onEdit={() => edit('resource', r)} onStatus={(s) => void status('resource', r.id, s)} onDelete={() => setRemove({ kind: 'resource', id: r.id, title: r.title })} /><Button permission="materials.read" variant="ghost" size="sm" disabled={busy || r.material?.status === 'PENDING'} onClick={() => void run(async () => { const access = r.legacy && r.material ? await academicDataService.getMaterialPreviewUrl(r.material.id) : await contentService.resourceAccess(r.id); window.open(access.url, '_blank', 'noopener,noreferrer'); }, 'Đã mở tài liệu')}>Xem tài liệu</Button></div></article>)}{!lesson.resources.length ? <p className="text-sm text-slate-500">Chưa có tài liệu.</p> : null}</div>
          {lesson.legacy ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Đây là bài học mặc định chỉ hiển thị từ tài liệu cũ. Để tạo bài tập, hãy tải tài liệu mới lên chủ đề hoặc tạo một bài học riêng.</p> : <TeacherAssignmentPanel key={lesson.id} lessonId={lesson.id} />}
        </section> : null}
      </> : <p className="p-6 text-sm text-slate-500">Chọn chủ đề để xem bài học và tài liệu.</p>}</main>
    </div>
    <Modal open={editor !== null} title={`${editor?.id ? 'Chỉnh sửa' : 'Tạo'} ${editor?.kind === 'topic' ? 'chủ đề' : editor?.kind === 'lesson' ? 'bài học' : 'tài liệu'}`} onClose={() => !busy && setEditor(null)} footer={<Button type="submit" form="content-form" disabled={busy}>Lưu</Button>}>
      {editor?.kind !== 'topic' ? <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiredForCompletion} onChange={(e) => setForm({ ...form, requiredForCompletion: e.target.checked })} />Cần xem để hoàn thành {editor?.kind === 'lesson' ? 'chủ đề' : 'bài học'}</label> : null}
      <form id="content-form" onSubmit={(e) => void save(e)} className="grid gap-3">
        <label className="grid gap-1 text-sm">Tên<input aria-label="Tên nội dung" className={field} required minLength={editor?.kind === 'resource' ? 1 : 2} maxLength={editor?.kind === 'resource' ? 255 : 120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="grid gap-1 text-sm">Mô tả<textarea className={`${field} h-24 py-2`} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        {editor?.kind === 'lesson' ? <label className="grid gap-1 text-sm">Nội dung bài học<textarea className={`${field} h-40 py-2`} maxLength={100000} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></label> : null}
        <label className="grid gap-1 text-sm">Học sinh xem từ<input className={field} type="datetime-local" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} /></label>
        <label className="grid gap-1 text-sm">Ngừng hiển thị sau<input className={field} type="datetime-local" value={form.availableUntil} onChange={(e) => setForm({ ...form, availableUntil: e.target.value })} /></label>
        {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        <p className="text-xs text-slate-500">Nội dung mới được lưu dưới dạng bản nháp. Chọn “Tải lên” để đăng nội dung theo thời gian hiển thị đã đặt. Với tài liệu đã tải xong, bạn không phải chọn lại file; hệ thống sẽ mở cả bài học và chủ đề nếu an toàn.</p>
      </form>
    </Modal>
    <Modal open={addOpen} title="Tải tài liệu" onClose={() => !busy && setAddOpen(false)}>
      <div className="space-y-4">{error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
        <p className="text-sm text-slate-600">{addTarget === 'lesson' ? `Bài học: ${lesson?.title ?? ''}` : `Chủ đề: ${topic?.name ?? ''}`}</p>
        {addTarget === 'lesson' ? <div role="group" aria-label="Nguồn tài liệu" className="flex flex-wrap gap-2 border-b border-slate-100 pb-3">
          {([['file', 'Tải từ máy'], ['library', 'Từ thư viện'], ['link', 'Liên kết']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={addMethod === value} disabled={busy} className={`rounded-lg px-3 py-2 text-sm font-semibold ${addMethod === value ? 'bg-brand-600 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`} onClick={() => { setAddMethod(value); if (value === 'library' && !library.length && !libraryLoading) void loadLibrary(); }}>{label}</button>)}
        </div> : null}
        {addMethod === 'file' ? <><label className="block text-sm font-bold"><span className="flex items-center gap-2"><Upload className="size-4" />Chọn file từ máy (tối đa 50 MiB/file)</span>
          <input aria-label="Chọn tài liệu từ máy" type="file" accept={COURSE_RESOURCE_ACCEPT} multiple disabled={busy} className="mt-2 block w-full text-sm" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          <span className="mt-1 block text-xs font-normal text-slate-500">PDF, Word, PowerPoint, Excel, ảnh, video hoặc âm thanh.</span>
        </label><label className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-slate-800"><input type="checkbox" className="mt-1" checked={shareAfterUpload} disabled={busy} onChange={(event) => setShareAfterUpload(event.target.checked)} /><span><strong>Đăng tài liệu sau khi tải xong</strong><span className="mt-1 block text-xs text-slate-600">Học sinh được sử dụng tài liệu theo lịch đã đặt. Chỉ mở file vừa tải và chủ đề/bài học chứa file nếu không làm hiện nội dung khác. Bỏ chọn để giữ bản nháp.</span></span></label>{uploadInfo ? <div role="status" className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{uploadInfo.name} · {uploadInfo.type} · {(uploadInfo.size / 1024 / 1024).toFixed(2)} MiB · {uploadInfo.phase} {uploadInfo.percent}%<progress className="mt-2 w-full" max={100} value={uploadInfo.percent} /></div> : null}
        {addTarget === 'topic' ? <p className="text-xs text-slate-600">Tài liệu sẽ nằm trong bài “Nội dung” của chủ đề.</p> : null}</> : null}
        {addTarget === 'lesson' && addMethod === 'library' ? <div className="grid gap-2"><label className="text-sm font-bold" htmlFor="library-file">Tài liệu đã tải lên</label>{libraryLoading ? <p role="status" className="text-xs text-slate-600">Đang tìm tài liệu trong thư viện...</p> : null}{libraryError ? <p role="status" className="text-xs text-amber-700">Không tải được thư viện: {libraryError}. Bạn vẫn có thể tải file mới hoặc thêm liên kết. <Button variant="ghost" size="sm" onClick={() => void loadLibrary()}>Thử lại</Button></p> : null}<select id="library-file" className={field} value={materialId} onChange={(e) => setMaterialId(e.target.value)}><option value="">Chọn tài liệu</option>{library.map((m) => <option key={m.id} value={m.id}>{m.originalName}</option>)}</select><Button permission="materials.create" disabled={busy || !materialId} onClick={() => void run(async () => { await contentService.addMaterial(lesson?.id ?? lessonId, materialId, library.find((m) => m.id === materialId)!.originalName); setAddOpen(false); })}>Dùng tài liệu này</Button></div> : null}
        {addTarget === 'lesson' && addMethod === 'link' ? <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await contentService.addLink(lesson?.id ?? lessonId, linkTitle, linkUrl, linkDescription); setAddOpen(false); }); }}>
          <label className="text-sm font-bold">Đường dẫn học tập</label>
          <input className={field} aria-label="Tên liên kết" required placeholder="Tên trang hoặc tài liệu" maxLength={255} value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} />
          <input className={field} aria-label="URL tham khảo" required type="url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <textarea className={`${field} h-20 py-2`} aria-label="Mô tả liên kết" placeholder="Mô tả (không bắt buộc)" maxLength={1000} value={linkDescription} onChange={(e) => setLinkDescription(e.target.value)} />
          <Button permission="materials.create" type="submit" disabled={busy}>Thêm đường dẫn</Button>
        </form> : null}</div>
    </Modal>
    <Modal open={preview !== null} title="Xem thử nội dung" description="Chỉ giáo viên thấy bản xem thử này, kể cả nội dung đang ẩn. Thao tác này không thay đổi quyền xem của học sinh." width="max-w-4xl" onClose={() => setPreview(null)}>{preview ? <LearningContentView topics={[preview]} teacherPreview /> : null}</Modal>
    <ConfirmationDialog open={remove !== null} title="Xóa mục chưa dùng" confirmLabel="Xóa mục này" loading={busy} onClose={() => setRemove(null)} onConfirm={() => void run(async () => { if (!remove) return; if (remove.kind === 'topic') await contentService.deleteTopic(remove.id); else if (remove.kind === 'lesson') await contentService.deleteLesson(remove.id); else await contentService.deleteResource(remove.id); setRemove(null); })}><p>Xóa “{remove?.title}”? File gốc và lịch sử sử dụng vẫn được giữ lại.</p></ConfirmationDialog>
  </div>;
}

function StatusBadge({ status, parentVisible = true }: { status: ContentStatus; parentVisible?: boolean }) { const visible = status === 'PUBLISHED' && parentVisible; return <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold ${visible ? 'bg-emerald-50 text-emerald-700' : status === 'ARCHIVED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{status === 'PUBLISHED' && !parentVisible ? 'Chưa hiển thị: mục phía trên đang ẩn' : labels[status]}</span>; }
function ContentActions({ kind, status, publishedAt, busy, canShow = true, onEdit, onPreview, onStatus, onDelete }: { kind: Editor['kind']; status: ContentStatus; publishedAt?: string | null; busy: boolean; canShow?: boolean; onEdit: () => void; onPreview?: () => void; onStatus: (s: ContentStatus) => void; onDelete: () => void }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const closeOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector<HTMLElement>('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  const choose = (action: () => void) => { if (menuRef.current) menuRef.current.open = false; action(); };
  return <div className="inline-flex flex-wrap items-center gap-2">
    {status === 'DRAFT' ? <Button permission="teaching.update" size="sm" disabled={busy || !canShow} title={!canShow ? 'Hãy đợi tài liệu tải lên hoàn tất' : 'Đăng nội dung cho học sinh theo lịch đã đặt; không cần chọn lại file'} onClick={() => onStatus('PUBLISHED')}>Tải lên</Button> : null}
    {status === 'ARCHIVED' ? <Button permission="teaching.update" size="sm" disabled={busy} onClick={() => onStatus('DRAFT')}>Dùng lại</Button> : null}
    <details ref={menuRef} className="relative">
      <summary aria-label="Thao tác khác" className="flex size-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-blue-100 [&::-webkit-details-marker]:hidden"><MoreHorizontal className="size-4" /></summary>
      <div className="absolute left-0 top-full z-20 mt-1 grid w-52 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
        <Button permission="teaching.update" variant="ghost" size="sm" className="w-full justify-start" disabled={busy} onClick={() => choose(onEdit)}>Chỉnh sửa</Button>
        {onPreview ? <Button variant="ghost" size="sm" className="w-full justify-start" disabled={busy} onClick={() => choose(onPreview)}><Eye className="size-4" />Xem thử</Button> : null}
        {status === 'PUBLISHED' ? <Button permission="teaching.update" variant="ghost" size="sm" className="w-full justify-start" disabled={busy} onClick={() => choose(() => onStatus('DRAFT'))}>Tạm ẩn với học sinh</Button> : null}
        {status !== 'ARCHIVED' ? <Button permission="teaching.update" variant="ghost" size="sm" className="w-full justify-start" disabled={busy} onClick={() => choose(() => onStatus('ARCHIVED'))}>Lưu trữ (ẩn khỏi môn học)</Button> : null}
        {status === 'DRAFT' && !publishedAt ? <Button permission={kind === 'resource' ? 'materials.delete' : 'teaching.delete'} variant="danger" size="sm" className="w-full justify-start" disabled={busy} onClick={() => choose(onDelete)}>Xóa mục chưa dùng</Button> : null}
      </div>
    </details>
  </div>;
}
function OrderButtons({ disabled, index, length, onMove }: { disabled?: boolean; index: number; length: number; onMove: (delta: number) => void }) { return <div className="mt-2 flex gap-1"><Button permission="teaching.update" variant="ghost" size="sm" aria-label="Đưa lên" disabled={disabled || index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-3" /></Button><Button permission="teaching.update" variant="ghost" size="sm" aria-label="Đưa xuống" disabled={disabled || index === length - 1} onClick={() => onMove(1)}><ArrowDown className="size-3" /></Button></div>; }
