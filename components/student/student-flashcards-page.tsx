"use client";

import {
  ArrowLeft,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import type { FlashcardQueue, StudyCoachFlashcard } from "@/types/study-coach";

const SESSION_KEY = "estude:study-coach:flashcards:v1";
const RATINGS = [
  { value: 1 as const, label: "Học lại", detail: "Không nhớ", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  { value: 2 as const, label: "Khó", detail: "Rất khó", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { value: 3 as const, label: "Tốt", detail: "Nhớ được", tone: "border-blue-200 bg-blue-50 text-brand-700" },
  { value: 4 as const, label: "Dễ", detail: "Rất dễ", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

interface StoredSession {
  documentId?: string;
  mode?: "DUE" | "ALL";
  sessionEventId?: string;
  cardIds: string[];
  initialTotal: number;
  reviewed: number;
}

interface PendingReview {
  rating: 1 | 2 | 3 | 4;
  clientEventId: string;
}

export function StudentFlashcardsPage() {
  const router = useRouter();
  const params = useParams<{ materialId?: string }>();
  const [legacyDocumentId] = useState(() => typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("documentId") || undefined);
  const documentId = typeof params.materialId === "string" ? params.materialId : legacyDocumentId;
  const sessionKey = `${SESSION_KEY}:${documentId ?? "all"}`;
  const answerRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [cards, setCards] = useState<StudyCoachFlashcard[]>([]);
  const [queue, setQueue] = useState<FlashcardQueue | null>(null);
  const [initialTotal, setInitialTotal] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(null);
  const [sessionEventId, setSessionEventId] = useState("");

  const saveSession = useCallback((session: StoredSession | null) => {
    try {
      if (session) localStorage.setItem(sessionKey, JSON.stringify(session));
      else localStorage.removeItem(sessionKey);
    } catch {
      // Deterministic server queue remains the fallback when browser storage is unavailable.
    }
  }, [sessionKey]);

  const loadQueue = useCallback(
    async (forceNew = false, mode: "DUE" | "ALL" = "DUE") => {
      setLoading(true);
      setError("");
      setCards([]);
      setQueue(null);
      setRevealed(false);
      setPendingReview(null);
      try {
        const result = await studyCoachService.getDueQueue(documentId, mode);
        setQueue(result);
        let stored: StoredSession | null = null;
        if (!forceNew) {
          try {
            stored = JSON.parse(localStorage.getItem(sessionKey) ?? "null") as StoredSession | null;
          } catch {
            stored = null;
          }
        }
        if (
          stored &&
          stored.documentId === documentId &&
          (stored.mode ?? "DUE") === mode &&
          stored.cardIds.length
        ) {
          const resumedSessionEventId = stored.sessionEventId ?? createSessionEventId();
          const byId = new Map(result.cards.map((card) => [card.id, card]));
          const resumed = stored.cardIds.flatMap((id) => {
            const card = byId.get(id);
            return card ? [card] : [];
          });
          const inferredReviewed = Math.max(
            stored.reviewed,
            stored.initialTotal - resumed.length,
          );
          setCards(resumed);
          setInitialTotal(stored.initialTotal);
          setReviewed(inferredReviewed);
          setSessionEventId(resumedSessionEventId);
          saveSession({ ...stored, sessionEventId: resumedSessionEventId, mode, cardIds: resumed.map((card) => card.id), reviewed: inferredReviewed });
        } else {
          const nextSessionEventId = createSessionEventId();
          setCards(result.cards);
          setInitialTotal(result.cards.length);
          setReviewed(0);
          setSessionEventId(nextSessionEventId);
          saveSession({
            documentId,
            mode,
            sessionEventId: nextSessionEventId,
            cardIds: result.cards.map((card) => card.id),
            initialTotal: result.cards.length,
            reviewed: 0,
          });
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể tải flashcard.");
      } finally {
        setLoading(false);
      }
    },
    [documentId, saveSession, sessionKey],
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const current = cards[0] ?? null;
  const progress = initialTotal ? Math.min(100, Math.round((reviewed / initialTotal) * 100)) : 0;
  const source = current?.sourceReferences[0];
  const complete = !loading && !error && initialTotal > 0 && cards.length === 0;
  const backHref = documentId
    ? `/student/study-coach/materials/${encodeURIComponent(documentId)}`
    : "/student/study-coach";

  const reveal = () => {
    setRevealed(true);
    requestAnimationFrame(() => answerRef.current?.focus());
  };

  async function submitRating(rating: 1 | 2 | 3 | 4, existingEventId?: string) {
    if (!current || submittingRef.current) return;
    const clientEventId = existingEventId ?? createClientEventId();
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    setPendingReview({ rating, clientEventId });
    try {
      await studyCoachService.reviewFlashcard(current.id, rating, clientEventId);
      const nextCards = cards.slice(1);
      const nextReviewed = reviewed + 1;
      if (!nextCards.length && documentId) {
        const completionEventId = sessionEventId || createSessionEventId();
        if (!sessionEventId) setSessionEventId(completionEventId);
        await studyCoachService.completeFlashcardSession({
          documentId,
          reviewedCardCount: initialTotal,
          mode: queue?.mode ?? "DUE",
          clientEventId: completionEventId,
        });
      }
      setCards(nextCards);
      setReviewed(nextReviewed);
      setRevealed(false);
      setPendingReview(null);
      saveSession(
        nextCards.length
          ? {
              documentId,
              mode: queue?.mode ?? "DUE",
              sessionEventId,
              cardIds: nextCards.map((card) => card.id),
              initialTotal,
              reviewed: nextReviewed,
            }
          : null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể ghi nhận kết quả ôn tập.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <StudentShell>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-brand-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            <ArrowLeft className="size-4" /> {documentId ? "Quay lại tài liệu" : "Quay lại Study Coach"}
          </button>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-brand-600">
            Ôn tập theo tài liệu
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Thẻ ghi nhớ</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tự nhớ câu trả lời trước, sau đó lật thẻ và đánh giá mức độ ghi nhớ.
          </p>
        </div>
        <p className="text-sm font-bold text-slate-500">
          {current?.document.name ?? (documentId ? "Nội dung của tài liệu bạn đã chọn" : "Chọn một bộ thẻ để bắt đầu")}
        </p>
      </header>

      {loading ? (
        <div className="mt-5 grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white" aria-live="polite">
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-brand-600" />
            <p className="mt-3 text-sm font-bold text-slate-500">Đang chuẩn bị phiên học...</p>
          </div>
        </div>
      ) : error && !current ? (
        <StatePanel
          icon={RotateCcw}
          title="Không thể tải flashcard"
          detail={error}
          action="Thử lại"
          onAction={() => void loadQueue()}
        />
      ) : complete ? (
        <StatePanel
          icon={CheckCircle2}
          title="Hoàn thành phiên học"
          detail={`Bạn đã ôn ${reviewed}/${initialTotal} thẻ. Lịch ôn tiếp theo đã được lưu.`}
          action="Ôn lại tất cả thẻ"
          onAction={() => void loadQueue(true, "ALL")}
        />
      ) : !current ? (
        <StatePanel
          icon={BookOpenCheck}
          title="Chưa có flashcard cần học"
          detail={
            queue?.totalAvailable === 0
              ? "Tài liệu này chưa có thẻ ghi nhớ để ôn tập."
              : queue?.newCount
              ? "Không thể tạo phiên từ các thẻ hiện có. Vui lòng thử lại."
              : "Bạn đã ôn hết các thẻ đến hạn và hiện không còn thẻ mới."
          }
          action={queue?.totalCards ? "Ôn lại tất cả thẻ" : documentId ? "Quay lại tài liệu" : "Tải tài liệu"}
          onAction={() => queue?.totalCards
            ? void loadQueue(true, "ALL")
            : router.push(backHref)}
        />
      ) : (
        <>
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
            <div className="flex items-center justify-between gap-4 text-xs font-bold text-slate-500">
              <span>{reviewed}/{initialTotal} đã ôn</span>
              <span>{cards.length} thẻ còn lại</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`Tiến độ ${progress}%`}>
              <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          </section>

          <article data-testid="flashcard-card" className="mx-auto mt-5 max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brand-700">
                {current.concept.title || "Khái niệm"}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {current.queueKind === "DUE"
                  ? "Đến hạn"
                  : current.queueKind === "NEW"
                    ? "Thẻ mới"
                    : "Ôn chủ động"}
              </span>
              <span className="text-xs text-slate-400">{current.document.name}</span>
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Câu hỏi</p>
            <h2 className="mt-3 text-xl font-black leading-8 text-slate-950 sm:text-2xl">
              {current.front}
            </h2>

            {!revealed ? (
              <div className="mt-10 text-center">
                <p className="mb-4 text-sm text-slate-500">Hãy tự trả lời trước khi lật thẻ.</p>
                <Button data-testid="flashcard-reveal" className="h-12 px-6" onClick={reveal}>
                  <BrainCircuit className="size-4" /> Hiện đáp án
                </Button>
              </div>
            ) : (
              <div ref={answerRef} tabIndex={-1} className="mt-8 border-t border-slate-100 pt-8 outline-none">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Đáp án</p>
                <p className="mt-3 whitespace-pre-wrap text-base font-semibold leading-7 text-slate-800">
                  {current.back}
                </p>
                {source ? (
                  <details className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    <summary className="cursor-pointer font-bold focus:outline-none focus:ring-4 focus:ring-blue-100">
                      Nguồn{source.pageNumber ? ` · trang ${source.pageNumber}` : ""}
                    </summary>
                    <p className="mt-2 leading-6">{source.excerpt}</p>
                  </details>
                ) : null}

                <fieldset className="mt-8" disabled={submitting || Boolean(pendingReview && error)}>
                  <legend className="text-sm font-black text-slate-900">Bạn nhớ thẻ này thế nào?</legend>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {RATINGS.map((rating) => (
                      <button
                        key={rating.value}
                        type="button"
                        onClick={() => void submitRating(rating.value)}
                        className={`min-h-16 rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${rating.tone}`}
                        aria-label={`${rating.value}: ${rating.label}, ${rating.detail}`}
                        data-testid={`flashcard-rating-${rating.value}`}
                      >
                        <span className="block text-sm font-black">{rating.value} · {rating.label}</span>
                        <span className="mt-0.5 block text-xs opacity-80">{rating.detail}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {submitting ? (
                  <p className="mt-4 flex items-center gap-2 text-sm font-bold text-brand-700" aria-live="polite">
                    <LoaderCircle className="size-4 animate-spin" /> Đang lưu lịch ôn...
                  </p>
                ) : null}
                {error && pendingReview ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4" role="alert">
                    <p className="text-sm font-semibold text-rose-700">{error}</p>
                    <Button
                      variant="outline"
                      className="mt-3"
                      onClick={() => void submitRating(pendingReview.rating, pendingReview.clientEventId)}
                    >
                      <RotateCcw className="size-4" /> Thử gửi lại
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </article>

          <div className="mx-auto mt-4 flex max-w-4xl items-center justify-center gap-2 text-xs text-slate-400">
            <Clock3 className="size-4" /> Lịch ôn tiếp theo được tự động sắp xếp theo mức ghi nhớ bạn chọn.
          </div>
        </>
      )}
    </StudentShell>
  );
}

function StatePanel({
  icon: Icon,
  title,
  detail,
  action,
  onAction,
}: {
  icon: typeof BookOpenCheck;
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="mt-5 grid min-h-80 place-items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-brand-700">
          <Icon className="size-6" />
        </span>
        <h2 className="mt-4 text-xl font-black text-slate-950">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{detail}</p>
        <Button className="mt-5" onClick={onAction}>{action}</Button>
      </div>
    </section>
  );
}

function createClientEventId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `flashcard-review-${random}`;
}

function createSessionEventId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `flashcard-session-${random}`;
}
