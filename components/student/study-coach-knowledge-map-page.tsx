"use client";

import { ArrowLeft, ArrowRight, BrainCircuit, ChevronDown, Layers, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import { conceptImportanceLabels, knowledgeMapError, relationLabels } from "@/lib/study-coach-view";
import type { StudyCoachCapabilities, StudyCoachKnowledgeMap } from "@/types/study-coach";

export function StudyCoachKnowledgeMapPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const router = useRouter();
  const [map, setMap] = useState<StudyCoachKnowledgeMap | null>(null);
  const [capabilities, setCapabilities] = useState<StudyCoachCapabilities | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const capabilities = await studyCoachService.getCapabilities();
      setCapabilities(capabilities);
      if (!capabilities.knowledgeMap.enabled) { setDisabled(true); setMap(null); return; }
      setDisabled(false);
      const next = await studyCoachService.getKnowledgeMap(materialId);
      setMap(next);
      setExpanded(new Set(next.topics.slice(0, 1).map((topic) => topic.id)));
    } catch (cause) {
      setMap(null); setError(knowledgeMapError(cause));
    } finally { setLoading(false); }
  }, [materialId]);
  useEffect(() => { void load(); }, [load]);

  const conceptNames = useMemo(() => new Map(map?.topics.flatMap((topic) => topic.concepts.map((concept) => [concept.id, concept.title] as const)) ?? []), [map]);
  function toggle(topicId: string) { setExpanded((current) => { const next = new Set(current); if (next.has(topicId)) next.delete(topicId); else next.add(topicId); return next; }); }

  return <StudentShell>
    <button type="button" onClick={() => router.push(`/student/study-coach/materials/${materialId}`)} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-100"><ArrowLeft className="size-4" /> Quay lại tài liệu</button>
    {loading ? <MapSkeleton /> : disabled ? <State title="Bản đồ kiến thức chưa khả dụng" message="Tính năng này đang tạm thời không khả dụng." /> : error ? <State title="Chưa tải được bản đồ kiến thức" message={error} onRetry={() => void load()} /> : map ? <div className="mt-4" data-testid="knowledge-map">
      <header className="rounded-3xl bg-gradient-to-br from-brand-700 to-blue-500 p-6 text-white sm:p-8"><p className="text-xs font-black uppercase tracking-wider text-blue-100">{map.materialTitle}</p><h1 className="mt-2 text-3xl font-black">{map.title}</h1>{map.summary ? <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">{map.summary}</p> : null}<p className="mt-4 text-xs font-bold text-blue-100">{map.topics.length} chủ đề kiến thức</p></header>
      {!map.topics.length ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-black text-slate-900">Tài liệu chưa có cấu trúc kiến thức để hiển thị.</h2></section> : <section className="mt-5 space-y-3" aria-label="Các chủ đề kiến thức">{[...map.topics].sort((a, b) => a.order - b.order).map((topic) => { const open = expanded.has(topic.id); return <article key={topic.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"><button type="button" aria-expanded={open} aria-controls={`topic-${topic.id}`} onClick={() => toggle(topic.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left focus:outline-none focus:ring-4 focus:ring-inset focus:ring-blue-100"><span><span className="block text-lg font-black text-slate-950">{topic.title}</span><span className="mt-1 block text-xs font-bold text-slate-500">{topic.concepts.length} khái niệm</span></span><ChevronDown className={`size-5 shrink-0 text-brand-600 transition ${open ? "rotate-180" : ""}`} /></button>{open ? <div id={`topic-${topic.id}`} className="border-t border-slate-100 p-5">{topic.summary ? <p className="mb-4 text-sm leading-6 text-slate-600">{topic.summary}</p> : null}<div className="grid gap-3 md:grid-cols-2">{topic.concepts.map((concept) => <div key={concept.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex items-start justify-between gap-3"><h3 className="font-black text-slate-900">{concept.title}</h3><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-brand-700">{conceptImportanceLabels[concept.importance]}</span></div>{concept.definition ? <p className="mt-2 text-sm leading-6 text-slate-600">{concept.definition}</p> : null}</div>)}</div></div> : null}</article>; })}</section>}
      {map.relations.length ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black text-slate-950">Quan hệ kiến thức</h2><ul className="mt-4 space-y-2">{map.relations.map((relation) => <li key={relation.id} className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700"><strong>{conceptNames.get(relation.fromConceptId) ?? "Khái niệm"}</strong><span className="mx-2 font-semibold text-brand-700">{relationLabels[relation.type]}</span><strong>{conceptNames.get(relation.toConceptId) ?? "Khái niệm"}</strong>.</li>)}</ul></section> : null}
      {capabilities?.flashcards.enabled || capabilities?.quiz.enabled ? <section className="mt-5 rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6" aria-label="Bước học tiếp theo"><p className="text-xs font-black uppercase tracking-wider text-brand-600">Bước tiếp theo</p><h2 className="mt-1 text-xl font-black text-slate-950">Củng cố nội dung vừa xem</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Ôn lại các khái niệm bằng thẻ ghi nhớ, sau đó làm bài luyện để kiểm tra mức độ hiểu của bạn trong tài liệu này.</p><div className="mt-5 flex flex-wrap gap-3">{capabilities.flashcards.enabled ? <Button onClick={() => router.push(`/student/study-coach/materials/${encodeURIComponent(materialId)}/flashcards`)}><Layers className="size-4" /> Ôn thẻ ghi nhớ <ArrowRight className="size-4" /></Button> : null}{capabilities.quiz.enabled ? <Button variant="outline" onClick={() => router.push(`/student/study-coach/materials/${encodeURIComponent(materialId)}/quiz`)}><BrainCircuit className="size-4" /> Làm bài luyện</Button> : null}</div></section> : null}
    </div> : null}
  </StudentShell>;
}

function MapSkeleton() { return <div className="mt-4 space-y-3" aria-label="Đang tải bản đồ kiến thức"><div className="h-40 animate-pulse rounded-3xl bg-blue-100" />{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>; }
function State({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) { return <section className="mt-4 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center" role={onRetry ? "alert" : "status"}><div><h1 className="text-xl font-black text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-600">{message}</p>{onRetry ? <Button className="mt-4" onClick={onRetry}><RotateCcw className="size-4" /> Thử lại</Button> : null}</div></section>; }
