"use client";

import { ArrowRight, BookOpenCheck, BrainCircuit, Layers, Lightbulb, LoaderCircle, Map as MapIcon, RotateCcw, Sparkles, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { StudentExamReviewPanel } from "@/components/student/student-review-page";
import { StudyCoachMaterialLibrary } from "@/components/student/study-coach-material-library";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import { actionHref, actionLabels, masteryLabels, masteryTones, studentError } from "@/lib/study-coach-view";
import type { ConceptMasteryState, ConceptMasteryView, LearningInsight, StudyCoachCapabilities, StudyCoachMaterial } from "@/types/study-coach";

const states: ConceptMasteryState[] = ["STRONG", "PROFICIENT", "DEVELOPING", "NEEDS_SUPPORT", "NEW"];
type StudyCoachMenu = "self-study" | "exam-review";

export function StudyCoachHomePage() {
  const router = useRouter();
  const [capabilities, setCapabilities] = useState<StudyCoachCapabilities | null>(null);
  const [mastery, setMastery] = useState<ConceptMasteryView[]>([]);
  const [materials, setMaterials] = useState<StudyCoachMaterial[]>([]);
  const [insight, setInsight] = useState<LearningInsight | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState<StudyCoachMenu>("self-study");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const available = await studyCoachService.getCapabilities();
      setCapabilities(available);
      const [masteryData, materialData, insightData, queue] = await Promise.all([
        available.mastery.enabled ? studyCoachService.getMastery() : Promise.resolve({ items: [], total: 0, activity: { flashcardReviewCount: 0, quizAnswerCount: 0, flashcardSessionCount: 0, quizCompletionCount: 0, totalCompletedSessions: 0, totalActivityCount: 0 } }),
        available.materials.enabled ? studyCoachService.getMaterials(1, 100) : Promise.resolve({ items: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
        available.insights.enabled ? studyCoachService.getInsights({ scope: "STUDENT" }) : Promise.resolve({ items: [], total: 0 }),
        available.flashcards.enabled ? studyCoachService.getDueQueue() : Promise.resolve({ dueCount: 0, newCount: 0 }),
      ]);
      setMastery(masteryData.items);
      setMaterials(materialData.items.filter((material) => material.readyForStudy));
      setInsight(insightData.items[0] ?? null);
      setDueCount(queue.dueCount + queue.newCount);
    } catch (cause) {
      setError(studentError(cause, "Không thể tải Study Coach."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const syncMenuWithHash = () =>
      setActiveMenu(
        window.location.hash === "#exam-review" ? "exam-review" : "self-study",
      );
    syncMenuWithHash();
    window.addEventListener("hashchange", syncMenuWithHash);
    return () => window.removeEventListener("hashchange", syncMenuWithHash);
  }, []);
  const masteryByDocument = useMemo(() => new Map(
    materials.map((material) => [
      material.id,
      mastery.filter((item) => item.documentId === material.id),
    ]),
  ), [mastery, materials]);
  const nextAction = insight?.nextActions[0] ?? null;
  const actionableNext = nextAction && capabilities && (
    (nextAction.actionType === "REVIEW" && capabilities.flashcards.enabled) ||
    (nextAction.actionType === "LEARN" && capabilities.knowledgeMap.enabled) ||
    ((nextAction.actionType === "PRACTICE" || nextAction.actionType === "CHALLENGE") && capabilities.quiz.enabled)
  ) ? nextAction : null;
  const selectMenu = (menu: StudyCoachMenu) => {
    setActiveMenu(menu);
    const url = new URL(window.location.href);
    url.hash = menu === "exam-review" ? "exam-review" : "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  const chooseMaterial = () => {
    selectMenu("self-study");
    window.requestAnimationFrame(() =>
      document.getElementById("study-coach-materials")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      }),
    );
  };

  return <StudentShell><div data-testid="study-coach-home">
    <nav
      className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-card sm:inline-grid sm:grid-cols-2"
      aria-label="Chọn nội dung Study Coach"
    >
      <button
        type="button"
        onClick={() => selectMenu("self-study")}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition ${activeMenu === "self-study" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
        aria-current={activeMenu === "self-study" ? "page" : undefined}
      >
        <Layers className="size-4" /> Tự học
      </button>
      <button
        type="button"
        onClick={() => selectMenu("exam-review")}
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black transition ${activeMenu === "exam-review" ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
        aria-current={activeMenu === "exam-review" ? "page" : undefined}
      >
        <BookOpenCheck className="size-4" /> Ôn tập bài kiểm tra
      </button>
    </nav>

    {activeMenu === "exam-review" ? (
      <section id="exam-review" className="mt-5">
        <StudentExamReviewPanel embedded />
      </section>
    ) : (
      <>
    <header className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-blue-500 p-6 text-white shadow-card sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">AI Study Coach</p>
      <h1 className="mt-2 text-3xl font-black">Học tiếp từ đúng nơi bạn cần</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50">Hoạt động học của bạn được tổng hợp thành tiến độ, gợi ý ôn tập và lời giải thích dễ hiểu.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {capabilities?.flashcards.enabled ? <Button onClick={() => actionableNext ? router.push(actionHref(actionableNext.actionType, actionableNext.documentId)) : chooseMaterial()}><ArrowRight className="size-4" /> {actionableNext ? "Tiếp tục học" : "Chọn tài liệu để học"}</Button> : null}
        {capabilities?.insights.enabled ? <Button variant="outline" className="border-white/50 bg-white/10 text-white hover:bg-white/20" onClick={() => router.push("/student/study-coach/insights")}><Sparkles className="size-4" /> Xem phân tích</Button> : null}
      </div>
    </header>

    {loading ? <section className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white" aria-live="polite"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-brand-600" /><p className="mt-3 text-sm font-bold text-slate-500">Đang đồng bộ tiến trình học...</p></div></section> : error ? <section className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><h2 className="font-black text-rose-800">Chưa tải được Study Coach</h2><p className="mt-2 text-sm text-rose-700">{error}</p><Button variant="outline" className="mt-4" onClick={() => void load()}><RotateCcw className="size-4" /> Thử lại</Button></section> : capabilities ? <>
      {capabilities.materials.enabled ? <StudyCoachMaterialLibrary capabilities={capabilities} /> : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {capabilities.mastery.enabled ? <section id="mastery-by-document" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Tiến trình hiện tại</p><h2 className="mt-1 text-xl font-black">Năng lực theo từng tài liệu</h2><p className="mt-2 text-sm text-slate-500">Mỗi tài liệu có kết quả riêng, không trộn lẫn kiến thức giữa các tài liệu.</p></div><Target className="size-6 text-brand-600" /></div>{materials.length ? <div className="mt-5 grid gap-3" data-testid="mastery-by-document">{materials.map((material) => <DocumentMasteryCard key={material.id} material={material} items={masteryByDocument.get(material.id) ?? []} onOpen={() => router.push(`/student/study-coach/materials/${encodeURIComponent(material.id)}/mastery`)} />)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Khi một tài liệu được xử lý xong, năng lực học tập của tài liệu đó sẽ xuất hiện tại đây.</p>}</section> : null}
        {capabilities.insights.enabled ? <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-700"><Lightbulb className="size-5" /></span><h2 className="text-lg font-black">Hành động tiếp theo</h2></div>{actionableNext ? <div className="mt-4" data-testid="insight-next-action"><p className="font-black text-slate-900">{actionLabels[actionableNext.actionType]} · {actionableNext.conceptName}</p><p className="mt-2 text-sm leading-6 text-slate-500">{actionableNext.reason}</p><Button className="mt-4" onClick={() => router.push(actionHref(actionableNext.actionType, actionableNext.documentId))}>Bắt đầu <ArrowRight className="size-4" /></Button></div> : <p className="mt-4 text-sm leading-6 text-slate-500">Chưa có đề xuất khả dụng. Hãy tiếp tục một hoạt động đang được bật.</p>}</div> : null}
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.flashcards.enabled ? <Shortcut icon={Layers} label="Ôn thẻ ghi nhớ" detail={`${dueCount} thẻ đang chờ · chọn tài liệu để ôn`} onClick={chooseMaterial} /> : null}
        {capabilities.quiz.enabled ? <Shortcut icon={BrainCircuit} label="Làm bài luyện" detail="Chọn tài liệu để nội dung không bị trộn lẫn" onClick={chooseMaterial} /> : null}
        {capabilities.mastery.enabled ? <Shortcut icon={MapIcon} label="Xem năng lực" detail="Tách riêng theo tài liệu" onClick={() => document.getElementById("mastery-by-document")?.scrollIntoView({ behavior: "smooth", block: "start" })} /> : null}
        {capabilities.insights.enabled ? <Shortcut icon={Sparkles} label="Phân tích AI" detail="Gợi ý từ kết quả học" onClick={() => router.push("/student/study-coach/insights")} /> : null}
      </section>
    </> : null}
      </>
    )}
  </div></StudentShell>;
}

function DocumentMasteryCard({ material, items, onOpen }: { material: StudyCoachMaterial; items: ConceptMasteryView[]; onOpen: () => void }) {
  const totalEvidence = items.reduce((sum, item) => sum + item.correctEvidence + item.incorrectEvidence, 0);
  const correctEvidence = items.reduce((sum, item) => sum + item.correctEvidence, 0);
  const accuracy = totalEvidence ? Math.round((correctEvidence / totalEvidence) * 100) : null;
  return <article className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><h3 className="truncate font-black text-slate-950">{material.title}</h3><p className="mt-1 text-xs text-slate-500">{items.length} khái niệm · {accuracy === null ? "Chưa làm bài luyện" : `Độ chính xác ${accuracy}%`}</p></div><Button variant="outline" onClick={onOpen}>Xem chi tiết <ArrowRight className="size-4" /></Button></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">{states.map((state) => <div key={state} className={`rounded-xl border px-3 py-2 ${masteryTones[state]}`}><p className="text-lg font-black">{items.filter((item) => item.state === state).length}</p><p className="text-[11px] font-bold">{masteryLabels[state]}</p></div>)}</div></article>;
}

function Shortcut({ label, detail, icon: Icon, onClick }: { label: string; detail: string; icon: typeof Layers; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-card transition hover:border-brand-300 focus:outline-none focus:ring-4 focus:ring-blue-100"><Icon className="size-5 text-brand-600" /><span className="mt-3 block font-black text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-500">{detail}</span></button>;
}
