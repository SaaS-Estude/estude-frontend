"use client";
import { useState } from 'react';
import { CustomSelect, Input } from "@/components/ui/form-control";
import { gradebookService } from '@/lib/gradebook-api';
import { assessmentPurposeLabels, type AssessmentPurpose } from '@/lib/internal-results';
import type { GradebookView } from '@/types/gradebook';
import { usePermissions } from '@/context/permissions-context';

import { Button } from "@/components/ui/button";

export function LegacyPurposeReview({ view, onChanged }: { view: GradebookView; onChanged: () => void }) {
  const { can } = usePermissions();
  const [purpose, setPurpose] = useState<AssessmentPurpose>('REGULAR');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const items = view.items?.filter((item) => !item.assessmentPurpose || item.assessmentPurpose === 'LEGACY_REVIEW') ?? [];
  if (!items.length || !view.book) return null;
  const readOnly = !can('academic.update') || !['ACTIVE', 'COMPLETED'].includes(view.term.status) || view.year?.status === 'COMPLETED';
  async function review(item: typeof items[number]) {
    if (!view.book || readOnly || reason.trim().length < 3) return;
    setBusy(item.id); setError('');
    try { await gradebookService.reviewLegacyPurpose(view.book.id, item.id, { assessmentPurpose: purpose, revision: item.revision ?? 0, reason: reason.trim() }); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không xác nhận được hoạt động'); }
    finally { setBusy(''); }
  }
  return <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4"><h4 className="font-semibold">Xác nhận mục đích hoạt động cũ ({items.length})</h4><p className="text-xs text-slate-600">Chọn nhóm sau khi kiểm tra hoạt động gốc. Điểm đã công bố sẽ được thống kê theo nhóm được xác nhận; điểm chưa công bố vẫn giữ nguyên trạng thái.</p>{error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}<div className="flex flex-wrap gap-3"><CustomSelect label="Mục đích" value={purpose} disabled={readOnly || !!busy} options={Object.entries(assessmentPurposeLabels).filter(([id]) => id !== 'LEGACY_REVIEW').map(([value, label]) => ({ value, label }))} onValueChange={(value) => setPurpose(value as AssessmentPurpose)} /><label className="grid min-w-60 flex-1 gap-1 text-xs">Lý do xác nhận<Input className="rounded border p-2" maxLength={500} value={reason} disabled={readOnly || !!busy} onChange={(e) => setReason(e.target.value)} /></label></div>{items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t border-amber-200 pt-2 text-sm"><span>{item.title}</span><Button variant="plain" type="button" className="rounded bg-brand-600 px-3 py-2 text-white disabled:opacity-50" disabled={readOnly || !!busy || reason.trim().length < 3 || item.sourceType === 'LEGACY'} onClick={() => void review(item)}>{busy === item.id ? 'Đang xác nhận…' : 'Xác nhận mục đích'}</Button></div>)}{readOnly ? <p className="text-xs text-slate-600">Chỉ xác nhận khi học kỳ đang diễn ra hoặc đang chấm nốt.</p> : null}</section>;
}
