"use client";

import { useState } from 'react';
import { academicDataService, examService } from '@/lib/assessment-api';
import { usePermissions } from '@/context/permissions-context';
import type { ClassRosterMember, Exam } from '@/types/assessment';

const field = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm';
export function ExamRecoveryPanel({ exam, onMakeup, onChanged }: {
  exam: Exam; onMakeup: (studentIds: string[], reason: string) => void; onChanged: () => Promise<void>;
}) {
  const { can } = usePermissions();
  const [mode, setMode] = useState<'makeup' | 'question' | null>(null);
  const [students, setStudents] = useState<ClassRosterMember[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState(''), [questionId, setQuestionId] = useState('');
  const [decision, setDecision] = useState<'CORRECT_KEY' | 'FULL_CREDIT' | 'EXCLUDE'>('FULL_CREDIT');
  const [keys, setKeys] = useState<string[]>([]), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  if (!exam.published || exam.status !== 'ENDED' || exam.archivedAt || (!can('exams.create') && !can('exams.submissions'))) return null;
  const target = exam.questions.find((q) => q.questionId === questionId);
  const type = target?.type ?? target?.question?.type;
  const options = target?.options ?? target?.question?.options ?? [];
  async function open(next: 'makeup' | 'question') {
    setMode(mode === next ? null : next); setError(''); setMessage(''); setReason('');
    if (next === 'makeup' && !students.length) {
      setBusy(true);
      try { setStudents((await academicDataService.getTeacherAssignedClassRoster(exam.classId)).students); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được danh sách học sinh'); }
      finally { setBusy(false); }
    }
  }
  async function resolve(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const result = await examService.resolveQuestion(exam.id, { questionId, mode: decision,
        ...(decision === 'CORRECT_KEY' ? { correctOptionIds: keys } : {}), expectedUpdatedAt: exam.updatedAt, reason });
      setMessage(`Đã chấm lại ${result.regradedAttempts} lượt. Điểm đã trả chưa đổi; hãy kiểm tra rồi trả điểm lại.`);
      await onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xử lý được câu hỏi'); }
    finally { setBusy(false); }
  }
  return <section className="my-3 rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap gap-3">
      {can('exams.create') && !exam.makeupOfExamId ? <button type="button" aria-expanded={mode === 'makeup'} className="text-sm font-bold text-brand-700" onClick={() => void open('makeup')}>Tạo đề thi bù riêng</button> : null}
      {can('exams.submissions') ? <button type="button" aria-expanded={mode === 'question'} className="text-sm font-bold text-brand-700" onClick={() => void open('question')}>Xử lý câu hỏi lỗi</button> : null}
    </div>
    {mode === 'makeup' ? <form className="mt-3 space-y-3" onSubmit={(event) => {
      event.preventDefault(); onMakeup(selected, reason.trim());
    }}>
      <p className="text-sm text-slate-600">Chọn học sinh, sau đó soạn đề mới bằng câu hỏi khác bài gốc. Chỉ học sinh được chọn nhận đề; điểm cao nhất đã chấm xong được quy đổi về cột điểm bài gốc.</p>
      <fieldset disabled={busy} className="max-h-48 overflow-auto rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Học sinh thi bù</legend>
        {students.map((s) => <label key={s.id} className="flex items-center gap-2 py-1 text-sm"><input type="checkbox" checked={selected.includes(s.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, s.id] : selected.filter((id) => id !== s.id))} />{s.fullName} · {s.accountName}</label>)}
      </fieldset>
      <label className="block text-sm">Lý do thi bù<textarea required minLength={3} maxLength={1000} className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <button disabled={busy || !selected.length} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Soạn đề thi bù</button>
    </form> : null}
    {mode === 'question' ? <form className="mt-3 space-y-3" onSubmit={(event) => void resolve(event)}>
      <p className="text-sm text-slate-600">Áp dụng cho mọi bài đã nộp của đề này, kể cả học sinh không trả lời câu lỗi. Chỉ xử lý sau khi hết mọi lịch riêng và không còn lượt đang làm. Quyết định và lý do được lưu lại.</p>
      <label className="block text-sm">Câu hỏi<select required className={field} value={questionId} onChange={(e) => { setQuestionId(e.target.value); setKeys([]); setDecision('FULL_CREDIT'); }}>
        <option value="">Chọn câu hỏi lỗi</option>{exam.questions.map((q, i) => <option key={q.questionId} value={q.questionId}>Câu {i + 1}: {q.content ?? q.question?.content ?? q.questionId}</option>)}
      </select></label>
      <label className="block text-sm">Cách xử lý<select className={field} value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
        <option value="FULL_CREDIT">Cho tất cả học sinh điểm câu này</option><option value="EXCLUDE">Loại câu và quy đổi về thang điểm ban đầu</option>
        {type && ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(type) ? <option value="CORRECT_KEY">Sửa đáp án đúng và chấm lại</option> : null}
      </select></label>
      {decision === 'CORRECT_KEY' ? <fieldset className="space-y-1"><legend className="text-sm">Đáp án đúng mới</legend>{options.map((o) => <label key={o.id} className="flex gap-2 text-sm"><input type="checkbox" checked={keys.includes(o.id)} onChange={(e) => setKeys(e.target.checked ? [...keys, o.id] : keys.filter((id) => id !== o.id))} />{o.label}. {o.text}</label>)}</fieldset> : null}
      <label className="block text-sm">Lý do xử lý<textarea required minLength={3} maxLength={1000} className={field} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <button disabled={busy || !questionId || (decision === 'CORRECT_KEY' && !keys.length)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang chấm lại...' : 'Áp dụng và chấm lại'}</button>
    </form> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-700">{error} Hãy tải lại nếu đề hoặc học kỳ vừa thay đổi.</p> : null}
    {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : null}
    {message && can('exams.publish') ? <button type="button" disabled={busy} className="mt-3 rounded-lg border border-brand-200 px-4 py-2 text-sm font-bold text-brand-700 disabled:opacity-50" onClick={() => void (async () => {
      setBusy(true); setError('');
      try { await examService.publishExamResults(exam.id); await onChanged(); setMessage('Đã trả điểm mới cho học sinh.'); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Không trả được điểm'); }
      finally { setBusy(false); }
    })()}>Trả điểm sau khi chấm lại</button> : null}
  </section>;
}
