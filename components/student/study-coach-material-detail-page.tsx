"use client";

import { ArrowLeft, BookOpen, BrainCircuit, Layers, LoaderCircle, Map, RotateCcw, Sparkles, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import { formatFileSize, materialError, materialLifecycleLabels, materialLifecycleTones, publicFailureMessage } from "@/lib/study-coach-view";
import type { StudyCoachCapabilities, StudyCoachMaterial } from "@/types/study-coach";

export function StudyCoachMaterialDetailPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const router = useRouter();
  const capabilitiesRef = useRef<StudyCoachCapabilities | null>(null);
  const [material, setMaterial] = useState<StudyCoachMaterial | null>(null);
  const [capabilities, setCapabilities] = useState<StudyCoachCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const nextCapabilities = capabilitiesRef.current ?? await studyCoachService.getCapabilities();
      capabilitiesRef.current = nextCapabilities;
      if (!nextCapabilities.materials.enabled) {
        setCapabilities(nextCapabilities);
        setMaterial(null);
        setError("Tính năng tài liệu Study Coach đang không khả dụng.");
        return;
      }
      const nextMaterial = await studyCoachService.getMaterial(materialId);
      setMaterial(nextMaterial);
      setCapabilities(nextCapabilities);
    } catch (cause) {
      setError(materialError(cause, "Không thể tải chi tiết tài liệu."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [materialId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (material?.lifecycle !== "PROCESSING") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load, material?.lifecycle]);

  async function processAgain() {
    if (!material || processing) return;
    setProcessing(true);
    setError("");
    try {
      await studyCoachService.processMaterial(material.id);
      await load(true);
    } catch (cause) {
      const message = materialError(cause, "Không thể xử lý tài liệu lúc này.");
      await load(true);
      setError(message);
    } finally {
      setProcessing(false);
    }
  }

  async function cancelProcessing() {
    if (!material || cancelling || !window.confirm("Hủy xử lý tài liệu này? Bạn có thể bắt đầu xử lý lại sau.")) return;
    setCancelling(true);
    setError("");
    try {
      await studyCoachService.cancelMaterial(material.id);
      await load(true);
    } catch (cause) {
      const message = materialError(cause, "Không thể hủy xử lý tài liệu lúc này.");
      await load(true);
      setError(message);
    } finally {
      setCancelling(false);
    }
  }

  async function deleteMaterial() {
    if (
      !material ||
      deleting ||
      !window.confirm("Xóa tài liệu này? Tệp đã tải lên và dữ liệu xử lý liên quan sẽ bị xóa vĩnh viễn.")
    ) return;
    setDeleting(true);
    setError("");
    try {
      await studyCoachService.deleteMaterial(material.id);
      router.push("/student/study-coach");
    } catch (cause) {
      setError(materialError(cause, "Không thể xóa tài liệu lúc này."));
      setDeleting(false);
    }
  }

  const materialPath = material
    ? `/student/study-coach/materials/${encodeURIComponent(material.id)}`
    : "";
  const failure = publicFailureMessage(material?.failureCode ?? null);
  return <StudentShell>
    <button type="button" onClick={() => router.push("/student/study-coach")} className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-100"><ArrowLeft className="size-4" /> Quay lại Study Coach</button>
    {loading ? <DetailSkeleton /> : error && !material ? <StatePanel message={error} onRetry={() => void load()} /> : material && capabilities ? <div data-testid="material-detail">
      <header className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <p className="text-xs font-black uppercase tracking-wider text-brand-600">Tài liệu Study Coach</p>
        <h1 className="mt-2 break-words text-2xl font-black text-slate-950 sm:text-3xl">{material.title}</h1>
        <span className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-black ${materialLifecycleTones[material.lifecycle]}`} aria-live={material.lifecycle === "PROCESSING" ? "polite" : undefined}>{materialLifecycleLabels[material.lifecycle]}</span>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Meta label="Loại tài liệu" value="PDF" /><Meta label="Kích thước" value={formatFileSize(material.size)} /><Meta label="Số trang" value={material.pageCount === null ? "Đang cập nhật" : String(material.pageCount)} /><Meta label="Ngày tải lên" value={new Intl.DateTimeFormat("vi-VN").format(new Date(material.createdAt))} /></dl>
      </header>

      {error ? <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p> : null}
      {!material.readyForStudy ? <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5" aria-live="polite"><h2 className="font-black text-slate-900">Chưa thể bắt đầu học</h2><p className="mt-2 text-sm leading-6 text-slate-500">{materialLifecycleLabels[material.lifecycle]}</p>{failure ? <p className="mt-2 text-sm text-rose-700">{failure}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{(material.lifecycle === "READY_TO_PROCESS" || material.lifecycle === "FAILED" || material.lifecycle === "CANCELLED") && capabilities.processing.enabled ? <Button disabled={processing || deleting} onClick={() => void processAgain()}>{processing ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} {material.lifecycle === "READY_TO_PROCESS" ? "Bắt đầu xử lý" : "Xử lý lại"}</Button> : null}{material.lifecycle === "PROCESSING" ? <Button variant="danger" disabled={cancelling} onClick={() => void cancelProcessing()}>{cancelling ? <LoaderCircle className="size-4 animate-spin" /> : <XCircle className="size-4" />} {cancelling ? "Đang hủy..." : "Hủy xử lý"}</Button> : null}{material.lifecycle === "FAILED" || material.lifecycle === "CANCELLED" ? <Button variant="danger" disabled={processing || deleting} onClick={() => void deleteMaterial()}>{deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />} {deleting ? "Đang xóa..." : "Xóa tài liệu"}</Button> : null}</div>{!capabilities.processing.enabled ? <p className="mt-3 text-sm font-semibold text-amber-700">Tính năng xử lý tài liệu đang tạm thời không khả dụng.</p> : null}</section> : <>
        <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-5"><h2 className="text-lg font-black text-slate-950">Sẵn sàng học</h2><p className="mt-2 text-sm leading-6 text-slate-600">Bắt đầu với hệ thống kiến thức, sau đó ôn thẻ ghi nhớ và làm bài luyện của riêng tài liệu này.</p>{capabilities.knowledgeMap.enabled ? <Button className="mt-4" onClick={() => router.push(`${materialPath}/knowledge-map`)}><BookOpen className="size-4" /> Bắt đầu lộ trình</Button> : capabilities.flashcards.enabled ? <Button className="mt-4" onClick={() => router.push(`${materialPath}/flashcards`)}><Layers className="size-4" /> Ôn thẻ ghi nhớ</Button> : null}</section>
        <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Hành động học tập">
          {capabilities.knowledgeMap.enabled ? <Action label="Hệ thống kiến thức" icon={Map} onClick={() => router.push(`${materialPath}/knowledge-map`)} /> : null}
          {capabilities.flashcards.enabled ? <Action label="Ôn thẻ ghi nhớ" icon={Layers} onClick={() => router.push(`${materialPath}/flashcards`)} /> : null}
          {capabilities.quiz.enabled ? <Action label="Làm bài luyện" icon={BrainCircuit} onClick={() => router.push(`${materialPath}/quiz`)} /> : null}
          {capabilities.mastery.enabled ? <Action label="Xem tiến độ" icon={BookOpen} onClick={() => router.push(`${materialPath}/mastery`)} /> : null}
          {capabilities.insights.enabled ? <Action label="Xem phân tích học tập" icon={Sparkles} onClick={() => router.push(`${materialPath}/insights`)} /> : null}
        </section>
      </>}
    </div> : null}
  </StudentShell>;
}

function Meta({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 break-words font-bold text-slate-800">{value}</dd></div>; }
function Action({ label, icon: Icon, onClick }: { label: string; icon: typeof Map; onClick: () => void }) { return <button type="button" onClick={onClick} className="min-h-24 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card hover:border-brand-300 focus:outline-none focus:ring-4 focus:ring-blue-100"><Icon className="size-5 text-brand-600" /><span className="mt-3 block font-black text-slate-900">{label}</span></button>; }
function DetailSkeleton() { return <div className="mt-4 animate-pulse rounded-3xl border border-slate-200 bg-white p-8" aria-label="Đang tải chi tiết tài liệu"><div className="h-4 w-28 rounded bg-slate-100" /><div className="mt-4 h-8 w-2/3 rounded bg-slate-100" /><div className="mt-8 grid grid-cols-2 gap-4"><div className="h-16 rounded bg-slate-100" /><div className="h-16 rounded bg-slate-100" /></div></div>; }
function StatePanel({ message, onRetry }: { message: string; onRetry: () => void }) { return <section className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-6" role="alert"><h1 className="text-xl font-black text-rose-800">Không thể mở tài liệu</h1><p className="mt-2 text-sm text-rose-700">{message}</p><Button variant="outline" className="mt-4" onClick={onRetry}><RotateCcw className="size-4" /> Thử lại</Button></section>; }
