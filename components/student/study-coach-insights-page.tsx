"use client";

import { ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, BrainCircuit, CheckCircle2, CircleAlert, Layers, Lightbulb, LoaderCircle, RotateCcw, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-control";
import { studyCoachService } from "@/lib/study-coach-api";
import { actionHref, actionLabels, difficultyLabels, isInsightDisabled, masteryLabels, studentError } from "@/lib/study-coach-view";
import type { ConceptMasteryResult, InsightScope, LearningInsight, StudyCoachMaterial } from "@/types/study-coach";

export function StudyCoachInsightsPage() {
  const router = useRouter();
  const params = useParams<{ materialId?: string }>();
  const generatingRef = useRef(false);
  const routeDocumentId = typeof params.materialId === "string" ? params.materialId : "";
  const [legacyDocumentId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("documentId") ?? "");
  const fixedDocumentId = routeDocumentId || legacyDocumentId;
  const [scope, setScope] = useState<InsightScope>(fixedDocumentId ? "DOCUMENT" : "STUDENT");
  const [documentId, setDocumentId] = useState(fixedDocumentId);
  const [materials, setMaterials] = useState<StudyCoachMaterial[]>([]);
  const [progress, setProgress] = useState<ConceptMasteryResult | null>(null);
  const [insight, setInsight] = useState<LearningInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");
  const documents = useMemo(() => materials.filter((material) => material.readyForStudy), [materials]);
  const effectiveScope: InsightScope = fixedDocumentId ? "DOCUMENT" : scope;
  const effectiveDocumentId = fixedDocumentId || documentId;
  const selectedMaterial = documents.find((material) => material.id === effectiveDocumentId);
  const backDocumentId = fixedDocumentId || (effectiveScope === "DOCUMENT" ? effectiveDocumentId : "");
  const backHref = backDocumentId
    ? `/student/study-coach/materials/${encodeURIComponent(backDocumentId)}`
    : "/student/study-coach";

  const load = useCallback(async () => {
    setLoading(true); setError(""); setInsight(null); setProgress(null);
    try {
      const capabilities = await studyCoachService.getCapabilities();
      if (!capabilities.insights.enabled) { setDisabled(true); setInsight(null); return; }
      setDisabled(false);
      const materialResult = capabilities.materials.enabled
        ? await studyCoachService.getMaterials(1, 100)
        : { items: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } };
      setMaterials(materialResult.items);
      const selectedDocument = effectiveScope === "DOCUMENT" ? effectiveDocumentId || materialResult.items.find((item) => item.readyForStudy)?.id : undefined;
      if (effectiveScope === "DOCUMENT" && !selectedDocument) { setInsight(null); setProgress(null); return; }
      if (!fixedDocumentId && effectiveScope === "DOCUMENT" && !documentId && selectedDocument) setDocumentId(selectedDocument);
      const [result, currentProgress] = await Promise.all([
        studyCoachService.getInsights({ scope: effectiveScope, documentId: selectedDocument }),
        capabilities.mastery.enabled
          ? studyCoachService.getMastery(selectedDocument ? { documentId: selectedDocument } : {})
          : Promise.resolve(null),
      ]);
      setInsight(result.items[0] ?? null);
      setProgress(currentProgress);
    } catch (cause) { setError(studentError(cause, "Không thể tải phân tích học tập.")); }
    finally { setLoading(false); }
  }, [documentId, effectiveDocumentId, effectiveScope, fixedDocumentId]);
  useEffect(() => { void load(); }, [load]);

  async function generate() {
    if (generatingRef.current || disabled || (effectiveScope === "DOCUMENT" && !effectiveDocumentId)) return;
    generatingRef.current = true; setGenerating(true); setError("");
    try {
      const result = await studyCoachService.generateInsight({ scope: effectiveScope, documentId: effectiveScope === "DOCUMENT" ? effectiveDocumentId : undefined });
      setInsight(result);
    } catch (cause) {
      if (isInsightDisabled(cause)) setDisabled(true);
      else setError(studentError(cause, "Không thể tạo phân tích học tập."));
    } finally { generatingRef.current = false; setGenerating(false); }
  }

  return <StudentShell><div>
    <header className="rounded-3xl bg-gradient-to-br from-violet-700 to-brand-600 p-6 text-white shadow-card sm:p-8">
      <button type="button" onClick={() => router.push(backHref)} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-violet-50"><ArrowLeft className="size-4" /> {backDocumentId ? "Quay lại tài liệu" : "Study Coach"}</button>
      <p className="mt-4 text-xs font-black uppercase tracking-wider text-violet-100">Nhìn lại kết quả học</p><h1 className="mt-1 text-3xl font-black">Bạn đang học đến đâu?</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-violet-50">Study Coach dựa vào kết quả bài luyện và các lần ôn tập để giúp bạn nhận ra phần đã vững và phần nên học tiếp.</p>
    </header>
    <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
      {fixedDocumentId ? <div className="rounded-xl bg-violet-50 px-4 py-3 sm:col-span-2"><p className="text-xs font-bold text-violet-600">Phân tích của tài liệu đang học</p><p className="mt-1 truncate font-black text-slate-950">{selectedMaterial?.title ?? "Tài liệu đã chọn"}</p></div> : <><Select label="Phạm vi" value={scope} onChange={(event) => { setScope(event.target.value as InsightScope); setInsight(null); }}><option value="STUDENT">Tổng quan tất cả tài liệu</option><option value="DOCUMENT">Theo một tài liệu</option></Select>{scope === "DOCUMENT" ? <Select label="Tài liệu" value={documentId} onChange={(event) => { setDocumentId(event.target.value); setInsight(null); }}><option value="">Chọn tài liệu</option>{documents.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}</Select> : <div className="rounded-xl bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-500">Nội dung đang xem</p><p className="mt-1 font-black text-slate-950">Kết quả học từ tất cả tài liệu</p></div>}</>}
    </section>
    {loading ? <section className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white" aria-live="polite"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-violet-600" /><p className="mt-3 text-sm font-bold text-slate-500">Đang tải phân tích...</p></div></section>
      : error ? <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><p className="text-sm font-semibold text-rose-700">{error}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RotateCcw className="size-4" /> Tải lại</Button></section>
      : disabled ? <State title="Phân tích học tập đang tạm ngừng" detail="Bạn vẫn có thể ôn thẻ ghi nhớ, làm bài luyện và xem tiến độ của mình." />
      : effectiveScope === "DOCUMENT" && !effectiveDocumentId ? <State title="Hãy chọn một tài liệu" detail="Mỗi tài liệu có phân tích riêng để kết quả không bị trộn lẫn." />
      : !insight || insight.source === "INSUFFICIENT_DATA" ? <InsightReadiness progress={progress} insight={insight} documentId={effectiveScope === "DOCUMENT" ? effectiveDocumentId : undefined} generating={generating} onGenerate={generate} />
      : <InsightView insight={insight} onGenerate={generate} generating={generating} />}
  </div></StudentShell>;
}

function InsightReadiness({
  progress,
  insight,
  documentId,
  generating,
  onGenerate,
}: {
  progress: ConceptMasteryResult | null;
  insight: LearningInsight | null;
  documentId?: string;
  generating: boolean;
  onGenerate: () => Promise<void>;
}) {
  const router = useRouter();
  const concepts = progress?.items ?? insight?.mastery ?? [];
  const quizCount = progress?.activity.quizAnswerCount ?? insight?.quiz.answeredCount ?? 0;
  const reviewCount = progress?.activity.flashcardReviewCount ?? insight?.flashcards.reviewCount ?? 0;
  const minimumEvidence = progress?.policy.minimumEvidenceRequired ?? 3;
  const evaluatedCount = concepts.filter((concept) => concept.evidenceCount > 0).length;
  const classifiedCount = concepts.filter((concept) => concept.state !== "NEW").length;
  const hasCurrentEvidence = quizCount > 0 || reviewCount > 0 || evaluatedCount > 0;
  const materialPath = documentId ? `/student/study-coach/materials/${encodeURIComponent(documentId)}` : "";
  const quizHref = materialPath ? `${materialPath}/quiz` : "/student/review/quiz";
  const flashcardsHref = materialPath ? `${materialPath}/flashcards` : "/student/review/flashcards";

  return <div className="mt-5 space-y-4" data-testid="insight-readiness">
    <section className={`rounded-3xl border p-6 ${hasCurrentEvidence ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-start gap-4">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-white ${hasCurrentEvidence ? "text-emerald-700" : "text-amber-700"}`}><ShieldCheck className="size-6" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Đánh giá từ kết quả học</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">{hasCurrentEvidence ? "Đã có kết quả để đưa ra nhận định ban đầu" : "Chưa đủ kết quả để đánh giá khách quan"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{hasCurrentEvidence ? "Study Coach đã ghi nhận hoạt động mới. Bạn có thể xem nhận định ban đầu ngay; kết quả sẽ rõ ràng hơn khi nhiều khái niệm được luyện tập đủ số lần." : "Study Coach chưa kết luận điểm mạnh hoặc phần cần ôn khi bạn chưa có kết quả học tập. Hãy hoàn thành các bước bên dưới trước."}</p>
        </div>
      </div>
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Dữ liệu hiện có">
      <ReadinessMetric icon={BrainCircuit} label="Câu bài luyện đã trả lời" value={quizCount} detail={quizCount ? "Đã có dữ liệu đúng/sai" : "Cần để đánh giá kiến thức"} />
      <ReadinessMetric icon={Layers} label="Lần ôn thẻ ghi nhớ" value={reviewCount} detail={reviewCount ? "Đã ghi nhận mức độ ghi nhớ" : "Giúp bổ sung thói quen ôn tập"} />
      <ReadinessMetric icon={Target} label="Khái niệm đã đủ kết quả" value={`${classifiedCount}/${concepts.length}`} detail={`Mỗi khái niệm cần ít nhất ${minimumEvidence} lượt đánh giá`} />
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-950"><BookOpenCheck className="size-5 text-brand-600" /> Làm gì để nhận được phân tích đáng tin cậy?</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <GuideStep number={1} title="Làm bài luyện" detail="Trả lời câu hỏi để hệ thống ghi nhận kết quả đúng hoặc sai theo từng khái niệm." done={quizCount > 0} />
        <GuideStep number={2} title="Bổ sung đủ lượt" detail={`Luyện lại để mỗi khái niệm có ít nhất ${minimumEvidence} lượt đánh giá.`} done={classifiedCount > 0} />
        <GuideStep number={3} title="Ôn thẻ ghi nhớ" detail="Tự đánh giá mức độ nhớ để hệ thống sắp lịch ôn phù hợp." done={reviewCount > 0} />
      </div>
      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Kết quả bài luyện giúp nhận biết điểm mạnh và phần cần ôn. Mức tự đánh giá khi học thẻ ghi nhớ chỉ dùng để sắp lịch ôn, không được tính như một câu trả lời đúng hoặc sai.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button onClick={() => router.push(quizHref)}><BrainCircuit className="size-4" /> Làm bài luyện</Button>
        <Button variant="outline" onClick={() => router.push(flashcardsHref)}><Layers className="size-4" /> Ôn thẻ ghi nhớ</Button>
        {hasCurrentEvidence ? <Button data-testid="insight-generate" variant="secondary" disabled={generating} onClick={() => void onGenerate()}>{generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {generating ? "Đang tạo phân tích..." : "Tạo phân tích từ dữ liệu hiện có"}</Button> : null}
      </div>
    </section>
  </div>;
}

function ReadinessMetric({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: number | string; detail: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold text-slate-500">{label}</p><Icon className="size-5 text-brand-600" /></div><p className="mt-3 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></article>;
}

function GuideStep({ number, title, detail, done }: { number: number; title: string; detail: string; done: boolean }) {
  return <article className={`rounded-2xl border p-4 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${done ? "bg-emerald-600 text-white" : "bg-white text-brand-700"}`}>{done ? "✓" : number}</span><h3 className="font-black text-slate-950">{title}</h3></div><p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p></article>;
}

function InsightView({ insight, onGenerate, generating }: { insight: LearningInsight; onGenerate: () => Promise<void>; generating: boolean }) {
  const router = useRouter();
  if (insight.status === "PROCESSING") return <State title="Study Coach đang tạo phân tích" detail="Bạn có thể quay lại sau để xem kết quả." />;
  return <div className="mt-5 space-y-5">
    <section data-testid="insight-summary" className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-600 to-brand-600 p-6 text-white shadow-card sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15"><Sparkles className="size-6" /></span><div><p className="text-xs font-black uppercase tracking-wider text-violet-100">Nhận định chính</p><h2 className="mt-1 text-2xl font-black">{insight.scope === "DOCUMENT" ? "Kết quả học với tài liệu này" : "Bức tranh học tập của bạn"}</h2></div></div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${insight.isFresh ? "bg-emerald-300/20 text-emerald-50" : "bg-amber-300/20 text-amber-50"}`}>{insight.isFresh ? "Đã cập nhật" : "Có kết quả học mới"}</span>
      </div>
      <p className="mt-5 max-w-4xl text-base font-medium leading-7 text-violet-50 sm:text-lg">{studentVietnamese(insight.summary)}</p>
      {insight.source === "FALLBACK" ? <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-violet-50">Đây là nhận định tạm thời dựa trên kết quả học hiện có. Bạn có thể cập nhật lại sau.</p> : null}
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="Kết quả dùng để phân tích">
      <ReadinessMetric icon={BarChart3} label="Độ chính xác bài luyện" value={insight.quiz.accuracy === null ? "Chưa có" : `${Math.round(insight.quiz.accuracy * 100)}%`} detail={`${insight.quiz.answeredCount} câu đã trả lời`} />
      <ReadinessMetric icon={Layers} label="Thẻ ghi nhớ đã ôn" value={insight.flashcards.reviewCount} detail="Dùng để sắp lịch ôn phù hợp" />
      <ReadinessMetric icon={Target} label="Khái niệm đã đánh giá" value={insight.mastery.filter((item) => item.evidenceCount > 0).length} detail={`Trong ${insight.mastery.length} khái niệm của phạm vi này`} />
    </section>

    <section className="grid gap-5 lg:grid-cols-2" aria-label="Những nội dung đáng chú ý">
      <InsightGroup kind="strength" title="Bạn đang làm tốt" empty="Chưa có nội dung nào đủ kết quả để xác định là điểm mạnh." items={insight.strengths} testId="insight-strength" />
      <InsightGroup kind="focus" title="Nên ưu tiên ôn lại" empty="Hiện chưa có nội dung nào cần ưu tiên ôn lại." items={insight.weakAreas} testId="insight-weak-area" />
    </section>

    <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-100 text-brand-700"><TrendingUp className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Sự thay đổi gần đây</p><h2 className="mt-0.5 text-xl font-black text-slate-950">Tiến bộ của bạn</h2></div></div>
      {insight.progress.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{insight.progress.map((item) => <article key={item.conceptId} data-testid="insight-progress" className={`rounded-2xl border p-4 ${directionTones[item.direction]}`}><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-black">{directionLabels[item.direction]}</span><h3 className="mt-3 font-black text-slate-950">{item.conceptName}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{studentVietnamese(item.reason)}</p></article>)}</div> : <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-slate-600">Hãy hoàn thành thêm bài luyện để hệ thống có thể so sánh kết quả gần đây và nhận ra sự tiến bộ của bạn.</p>}
    </section>

    <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><Lightbulb className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-violet-600">Lộ trình đề xuất</p><h2 className="mt-0.5 text-xl font-black text-slate-950">Bạn nên làm gì tiếp theo?</h2></div></div>
      {insight.nextActions.length ? <div className="mt-5 grid gap-4">{insight.nextActions.map((item) => <article key={`${item.priority}-${item.conceptId}`} data-testid="insight-next-action" className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-blue-50 p-5 sm:flex-row sm:items-center"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet-700 text-lg font-black text-white">{item.priority}</span><div className="flex-1"><p className="text-xs font-black uppercase tracking-wider text-violet-700">{actionLabels[item.actionType]}</p><h3 className="mt-1 text-lg font-black text-slate-950">{item.conceptName}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{studentVietnamese(item.reason)}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">{masteryLabels[item.state]}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">Độ khó: {difficultyLabels[item.targetDifficulty]}</span></div></div><Button onClick={() => router.push(actionHref(item.actionType, insight.documentId ?? undefined))}>Bắt đầu <ArrowRight className="size-4" /></Button></article>)}</div> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Hãy hoàn thành thêm bài luyện để xác định bước học phù hợp nhất.</p>}
    </section>

    <Button data-testid="insight-generate" variant="outline" disabled={generating || insight.isFresh} onClick={() => void onGenerate()}>{generating ? "Đang cập nhật..." : insight.isFresh ? "Phân tích đã dùng kết quả mới nhất" : "Cập nhật theo kết quả học mới"}</Button>
  </div>;
}

function InsightGroup({ kind, title, empty, items, testId }: { kind: "strength" | "focus"; title: string; empty: string; items: LearningInsight["strengths"] | LearningInsight["weakAreas"]; testId: string }) {
  const strength = kind === "strength";
  return <section className={`rounded-3xl border p-5 shadow-card sm:p-6 ${strength ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}><div className="flex items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl bg-white ${strength ? "text-emerald-700" : "text-amber-700"}`}>{strength ? <CheckCircle2 className="size-5" /> : <CircleAlert className="size-5" />}</span><div><p className={`text-xs font-black uppercase tracking-wider ${strength ? "text-emerald-700" : "text-amber-700"}`}>{strength ? "Điểm nổi bật" : "Trọng tâm cải thiện"}</p><h2 className="mt-0.5 text-xl font-black text-slate-950">{title}</h2></div></div>{items.length ? <div className="mt-5 grid gap-3">{items.map((item) => <article key={item.conceptId} data-testid={testId} className="rounded-2xl border border-white/80 bg-white/80 p-4"><h3 className="font-black text-slate-950">{item.conceptName}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{studentVietnamese(item.reason)}</p></article>)}</div> : <p className="mt-4 rounded-2xl bg-white/70 p-4 text-sm leading-6 text-slate-600">{empty}</p>}</section>;
}

function State({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) { return <section className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center"><div><Sparkles className="mx-auto size-8 text-violet-400" /><h2 className="mt-4 text-lg font-black">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{detail}</p>{action ? <div className="mt-5">{action}</div> : null}</div></section>; }

const directionLabels = {
  IMPROVING: "Đang tiến bộ",
  STABLE: "Duy trì ổn định",
  DECLINING: "Cần chú ý thêm",
} as const;

const directionTones = {
  IMPROVING: "border-emerald-200 bg-emerald-50",
  STABLE: "border-blue-200 bg-blue-50",
  DECLINING: "border-amber-200 bg-amber-50",
} as const;

function studentVietnamese(value: string): string {
  return value
    .replace(/\bconcepts?\b/gi, "khái niệm")
    .replace(/\bquizzes?\b/gi, "bài luyện")
    .replace(/\bflashcards?\b/gi, "thẻ ghi nhớ")
    .replace(/\bmastery\b/gi, "mức độ nắm vững")
    .replace(/\binsights?\b/gi, "nhận định")
    .replace(/\bprogress\b/gi, "tiến bộ");
}
