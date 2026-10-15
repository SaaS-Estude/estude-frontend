"use client";

import { FileText, LoaderCircle, Plus, RotateCcw, Trash2, UploadCloud, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form-control";
import { useActionNotification } from "@/components/ui/action-notification";
import { academicDataService } from "@/lib/assessment-api";
import { studyCoachService } from "@/lib/study-coach-api";
import {
  formatFileSize,
  materialError,
  materialLifecycleLabels,
  materialLifecycleTones,
  publicFailureMessage,
} from "@/lib/study-coach-view";
import type { Subject } from "@/types/assessment";
import type { StudyCoachCapabilities, StudyCoachMaterial, StudyCoachMaterialPage } from "@/types/study-coach";

const PAGE_SIZE = 6;
const MAX_PDF_SIZE = 50 * 1024 * 1024;

export function StudyCoachMaterialLibrary({ capabilities }: { capabilities: StudyCoachCapabilities }) {
  const processingEnabled = capabilities.processing.enabled;
  const router = useRouter();
  const { notify } = useActionNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StudyCoachMaterialPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadPhase, setUploadPhase] = useState<"idle" | "authorizing" | "uploading" | "confirming" | "processing">("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (targetPage = page, quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const next = await studyCoachService.getMaterials(targetPage, PAGE_SIZE);
      setResult(next);
      if (next.meta.page !== targetPage) setPage(next.meta.page);
    } catch (cause) {
      setError(materialError(cause, "Không thể tải danh sách tài liệu."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(page); }, [load, page]);

  useEffect(() => {
    const hasProcessing = result?.items.some((item) => item.lifecycle === "PROCESSING") ?? false;
    if (!hasProcessing) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(page, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load, page, result?.items]);

  useEffect(() => {
    if (!uploadOpen || subjectsLoaded || subjectsLoading) return;
    setSubjectsLoading(true);
    academicDataService.getSubjects(false, undefined, 100)
      .then((items) => {
        setSubjects(items.filter((item) => item.isActive));
        if (items.length === 1) setSubjectId(items[0].id);
      })
      .catch((cause) => setUploadError(materialError(cause, "Không thể tải danh sách môn học.")))
      .finally(() => { setSubjectsLoading(false); setSubjectsLoaded(true); });
  }, [subjectsLoaded, subjectsLoading, uploadOpen]);

  function selectFile(next: File | null) {
    setFile(null);
    setFileError("");
    if (!next) return;
    if (next.type !== "application/pdf" || !next.name.toLowerCase().endsWith(".pdf")) {
      setFileError("Study Coach hiện chỉ hỗ trợ tệp PDF.");
      return;
    }
    if (next.size < 1 || next.size > MAX_PDF_SIZE) {
      setFileError("Tệp PDF phải có kích thước từ 1 byte đến 50 MB.");
      return;
    }
    setFile(next);
  }

  async function submitUpload() {
    if (!file || !subjectId || uploadPhase !== "idle") return;
    setUploadError("");
    setUploadPercent(0);
    try {
      setUploadPhase("authorizing");
      const session = await studyCoachService.createMaterialUpload({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        subjectId,
      });
      setUploadPhase("uploading");
      await studyCoachService.uploadAuthorizedFile(session, file, setUploadPercent);
      setUploadPhase("confirming");
      await studyCoachService.confirmMaterialUpload(session.material.id);
      setPage(1);
      await load(1, true);
      setUploadPhase("processing");
      await studyCoachService.processMaterial(session.material.id);
      await load(1, true);
      notify("Tài liệu đã được xếp hàng. AI đang xử lý trong nền.", { key: "study-coach-upload" });
      setFile(null);
      setSubjectId("");
      setUploadOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (cause) {
      const message = materialError(cause, "Không thể hoàn tất tải tài liệu.");
      setUploadError(message);
      notify(message, { key: "study-coach-upload-error", variant: "error" });
      await load(1, true);
    } finally {
      setUploadPhase("idle");
    }
  }

  async function processMaterial(materialId: string) {
    if (processingId) return;
    setProcessingId(materialId);
    setError("");
    try {
      await studyCoachService.processMaterial(materialId);
      await load(page, true);
      notify("Tài liệu đã được xếp hàng xử lý.", { key: `process-${materialId}` });
    } catch (cause) {
      const message = materialError(cause, "Không thể xử lý tài liệu lúc này.");
      notify(message, { key: `process-${materialId}`, variant: "error" });
      await load(page, true);
      setError(message);
    } finally {
      setProcessingId(null);
    }
  }

  async function cancelMaterial(materialId: string) {
    if (cancellingId || !window.confirm("Hủy xử lý tài liệu này? Bạn có thể bắt đầu xử lý lại sau.")) return;
    setCancellingId(materialId);
    setError("");
    try {
      await studyCoachService.cancelMaterial(materialId);
      await load(page, true);
      notify("Đã hủy xử lý tài liệu.", { key: `cancel-${materialId}` });
    } catch (cause) {
      const message = materialError(cause, "Không thể hủy xử lý tài liệu lúc này.");
      await load(page, true);
      setError(message);
      notify(message, { key: `cancel-${materialId}`, variant: "error" });
    } finally {
      setCancellingId(null);
    }
  }

  async function deleteMaterial(materialId: string) {
    if (
      deletingId ||
      !window.confirm("Xóa tài liệu này? Tệp đã tải lên và dữ liệu xử lý liên quan sẽ bị xóa vĩnh viễn.")
    ) return;
    setDeletingId(materialId);
    setError("");
    try {
      await studyCoachService.deleteMaterial(materialId);
      if ((result?.items.length ?? 0) === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        await load(page, true);
      }
      notify("Đã xóa tài liệu khỏi Study Coach.", { key: `delete-${materialId}` });
    } catch (cause) {
      const message = materialError(cause, "Không thể xóa tài liệu lúc này.");
      await load(page, true);
      setError(message);
      notify(message, { key: `delete-${materialId}`, variant: "error" });
    } finally {
      setDeletingId(null);
    }
  }

  const busy = uploadPhase !== "idle";
  return (
    <section id="study-coach-materials" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-card" data-testid="material-library" aria-busy={loading || busy}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-wider text-brand-600">Tài liệu học tập</p><h2 className="mt-1 text-xl font-black">Tài liệu của bạn</h2></div>
        <Button disabled={!processingEnabled} onClick={() => setUploadOpen((open) => !open)} aria-expanded={uploadOpen} aria-controls="study-coach-upload-form"><Plus className="size-4" /> Tải tài liệu</Button>
      </div>

      {!processingEnabled ? <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">Dịch vụ xử lý tài liệu chưa được cấu hình đầy đủ. Bạn vẫn có thể sử dụng nội dung đã xử lý trước đó.</p> : null}

      {uploadOpen ? (
        <div id="study-coach-upload-form" className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700" htmlFor="study-material-file">
              Tệp PDF (tối đa 50 MB)
              <input ref={fileInputRef} id="study-material-file" type="file" accept="application/pdf,.pdf" disabled={busy} aria-describedby="study-material-file-help study-material-file-error" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-bold file:text-brand-700" />
              <span id="study-material-file-help" className="mt-1 block text-xs font-normal text-slate-500">Hiện hỗ trợ tài liệu PDF.</span>
              {fileError ? <span id="study-material-file-error" role="alert" className="mt-1 block text-xs font-semibold text-rose-700">{fileError}</span> : null}
            </label>
            <Select label="Môn học" value={subjectId} disabled={busy || subjectsLoading} onChange={(event) => setSubjectId(event.target.value)}>
              <option value="">{subjectsLoading ? "Đang tải môn học..." : "Chọn môn học"}</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.vietnameseName || subject.name}</option>)}
            </Select>
          </div>
          {busy ? <div className="mt-4" aria-live="polite"><p className="text-sm font-bold text-brand-700">{uploadPhase === "authorizing" ? "Đang chuẩn bị tải lên..." : uploadPhase === "uploading" ? `Đang tải lên... ${uploadPercent}%` : uploadPhase === "confirming" ? "Đang xác nhận tệp..." : "AI đang phân tích tài liệu..."}</p>{uploadPhase === "uploading" ? <progress className="mt-2 h-2 w-full accent-blue-600" max={100} value={uploadPercent}>{uploadPercent}%</progress> : null}</div> : null}
          {uploadError ? <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">{uploadError}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2"><Button disabled={!file || !subjectId || busy || Boolean(fileError)} onClick={() => void submitUpload()}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Tải lên và xử lý</Button><Button variant="ghost" disabled={busy} onClick={() => setUploadOpen(false)}>Hủy</Button></div>
        </div>
      ) : null}

      {loading ? <MaterialSkeleton /> : null}
      {!loading && error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert"><p className="font-bold text-rose-800">{error}</p><Button variant="outline" className="mt-3" onClick={() => void load(page)}><RotateCcw className="size-4" /> Thử lại</Button></div> : null}
      {!loading && !error && result?.items.length === 0 ? <div className="mt-5 rounded-2xl bg-slate-50 p-6 text-center"><FileText className="mx-auto size-8 text-slate-400" /><p className="mt-3 font-black text-slate-800">Bạn chưa có tài liệu học nào.</p><p className="mt-1 text-sm text-slate-500">Tải tài liệu đầu tiên để bắt đầu.</p></div> : null}
      {!loading && !error && result?.items.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{result.items.map((material) => <MaterialCard key={material.id} material={material} capabilities={capabilities} processing={processingId === material.id} cancelling={cancellingId === material.id} deleting={deletingId === material.id} onOpen={() => router.push(`/student/study-coach/materials/${material.id}`)} onProcess={() => void processMaterial(material.id)} onCancel={() => void cancelMaterial(material.id)} onDelete={() => void deleteMaterial(material.id)} onFlashcards={() => router.push(`/student/study-coach/materials/${encodeURIComponent(material.id)}/flashcards`)} onMastery={() => router.push(`/student/study-coach/materials/${encodeURIComponent(material.id)}/mastery`)} />)}</div> : null}
      {!loading && !error && result && result.meta.totalPages > 1 ? <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Phân trang tài liệu"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</Button><span className="text-sm font-bold text-slate-600">Trang {result.meta.page}/{result.meta.totalPages} · {result.meta.total} tài liệu</span><Button variant="outline" disabled={page >= result.meta.totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</Button></nav> : null}
    </section>
  );
}

function MaterialCard({ material, capabilities, processing, cancelling, deleting, onOpen, onProcess, onCancel, onDelete, onFlashcards, onMastery }: { material: StudyCoachMaterial; capabilities: StudyCoachCapabilities; processing: boolean; cancelling: boolean; deleting: boolean; onOpen: () => void; onProcess: () => void; onCancel: () => void; onDelete: () => void; onFlashcards: () => void; onMastery: () => void }) {
  const failure = publicFailureMessage(material.failureCode);
  const canProcess = material.lifecycle === "READY_TO_PROCESS" || material.lifecycle === "FAILED" || material.lifecycle === "CANCELLED";
  const canDelete = material.lifecycle === "FAILED" || material.lifecycle === "CANCELLED";
  const busy = processing || cancelling || deleting;
  return <article className="flex min-h-64 flex-col rounded-2xl border border-slate-200 p-4" data-testid={`material-${material.lifecycle.toLowerCase()}`}>
    <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-black ${materialLifecycleTones[material.lifecycle]}`} aria-live={material.lifecycle === "PROCESSING" ? "polite" : undefined}>{materialLifecycleLabels[material.lifecycle]}</span>
    <h3 className="mt-3 line-clamp-2 font-black text-slate-950">{material.title}</h3>
    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-500"><div><dt className="font-bold">Loại tài liệu</dt><dd>PDF</dd></div><div><dt className="font-bold">Kích thước</dt><dd>{formatFileSize(material.size)}</dd></div><div><dt className="font-bold">Ngày tải lên</dt><dd>{new Intl.DateTimeFormat("vi-VN").format(new Date(material.createdAt))}</dd></div></dl>
    <p className="mt-1 text-xs font-bold text-slate-700">{material.readyForStudy ? "Đã sẵn sàng học" : "Chưa sẵn sàng học"}</p>
    {failure ? <p className="mt-2 text-xs text-rose-700">{failure}</p> : null}
    <div className="mt-auto flex flex-wrap gap-2 pt-4">
      <Button variant={material.readyForStudy ? "primary" : "outline"} disabled={deleting} onClick={onOpen}>Xem chi tiết</Button>
      {canProcess && capabilities.processing.enabled ? <Button variant="secondary" disabled={busy} onClick={onProcess}>{processing ? <LoaderCircle className="size-4 animate-spin" /> : null}{material.lifecycle === "FAILED" ? "Thử xử lý lại" : "Xử lý"}</Button> : null}
      {material.lifecycle === "PROCESSING" ? <Button variant="danger" disabled={busy} onClick={onCancel}>{cancelling ? <LoaderCircle className="size-4 animate-spin" /> : <XCircle className="size-4" />}{cancelling ? "Đang hủy..." : "Hủy xử lý"}</Button> : null}
      {canDelete ? <Button variant="danger" disabled={busy} onClick={onDelete}>{deleting ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}{deleting ? "Đang xóa..." : "Xóa"}</Button> : null}
      {material.readyForStudy && capabilities.flashcards.enabled ? <Button variant="ghost" disabled={deleting} onClick={onFlashcards}>Thẻ ghi nhớ</Button> : null}
      {material.readyForStudy && capabilities.mastery.enabled ? <Button variant="ghost" disabled={deleting} onClick={onMastery}>Tiến độ</Button> : null}
    </div>
  </article>;
}

function MaterialSkeleton() {
  return <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-live="polite" aria-label="Đang tải tài liệu">{[0, 1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-slate-100" />)}</div>;
}
