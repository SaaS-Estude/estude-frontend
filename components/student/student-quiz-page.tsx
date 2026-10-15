"use client";

import { ArrowLeft, Bookmark, BookmarkCheck, CalendarClock, CheckCircle2, CircleHelp, Download, Eye, LoaderCircle, RotateCcw, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { Button } from "@/components/ui/button";
import { studyCoachService } from "@/lib/study-coach-api";
import type { StudyCoachQuizAnswer, StudyCoachQuizAttempt, StudyCoachQuizExport, StudyCoachQuizHistoryItem, StudyCoachQuizQuestion, StudyCoachQuizResult, StudyCoachQuizState, StudyCoachQuizSummary } from "@/types/study-coach";

const MARKED_KEY = "estude:study-coach:quiz-marked:v1";
interface PendingAnswer { questionId: string; selectedOptionIndexes: number[]; textAnswer?: string; clientEventId: string }

const questionTypeLabels: Record<StudyCoachQuizQuestion["type"], string> = {
  SINGLE_CHOICE: "Lựa chọn một đáp án",
  MULTIPLE_CHOICE: "Lựa chọn nhiều đáp án",
  TRUE_FALSE: "Đúng hoặc sai",
  FILL_BLANK: "Điền vào chỗ trống",
};

export function StudentQuizPage() {
  const router = useRouter();
  const params = useParams<{ materialId?: string }>();
  const [legacyDocumentId] = useState(() => typeof window === "undefined" ? undefined : new URLSearchParams(window.location.search).get("documentId") || undefined);
  const documentId = typeof params.materialId === "string" ? params.materialId : legacyDocumentId;
  const answerSubmittingRef = useRef(false);
  const quizSubmittingRef = useRef(false);
  const [quizzes, setQuizzes] = useState<StudyCoachQuizSummary[]>([]);
  const [history, setHistory] = useState<StudyCoachQuizHistoryItem[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<StudyCoachQuizSummary | null>(null);
  const [state, setState] = useState<StudyCoachQuizState | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selection, setSelection] = useState<number[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [draftSelections, setDraftSelections] = useState<Record<string, number[]>>({});
  const [draftTextAnswers, setDraftTextAnswers] = useState<Record<string, string>>({});
  const [pendingAnswer, setPendingAnswer] = useState<PendingAnswer | null>(null);
  const [pendingSubmitId, setPendingSubmitId] = useState<string | null>(null);
  const [markedQuestionIds, setMarkedQuestionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const applyState = useCallback((next: StudyCoachQuizState) => {
    setState(next); setSelection([]); setTextAnswer(""); setDraftSelections({}); setDraftTextAnswers({}); setPendingAnswer(null); setPendingSubmitId(null);
    if (next.status === "IN_PROGRESS") {
      setQuestionIndex(next.currentQuestionIndex);
      setMarkedQuestionIds(readMarkedQuestions(next.attemptId));
    } else {
      clearMarkedQuestions(next.attemptId);
      setMarkedQuestionIds([]);
    }
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(""); setQuizzes([]); setHistory([]); setSelectedQuiz(null); setState(null); setSelection([]); setTextAnswer(""); setDraftSelections({}); setDraftTextAnswers({}); setMarkedQuestionIds([]); setQuestionIndex(0);
    try {
      const [list, completed] = await Promise.all([
        studyCoachService.getQuizzes(documentId),
        studyCoachService.getQuizHistory(documentId),
      ]);
      setQuizzes(list.items); setHistory(completed.items);
    } catch (cause) { setError(messageOf(cause, "Không thể tải Quiz Study Coach.")); }
    finally { setLoading(false); }
  }, [documentId]);
  useEffect(() => { void load(); }, [load]);

  async function startQuiz(quiz: StudyCoachQuizSummary) {
    if (quizSubmittingRef.current || !quiz.availableQuestionCount) return;
    quizSubmittingRef.current = true; setSubmitting(true); setError("");
    try {
      const started = await studyCoachService.startQuiz(quiz.id, createClientEventId("quiz-start"));
      setSelectedQuiz(quiz); applyState(started);
    } catch (cause) { setError(messageOf(cause, "Không thể bắt đầu quiz.")); }
    finally { quizSubmittingRef.current = false; setSubmitting(false); }
  }

  const active = state?.status === "IN_PROGRESS" ? state : null;
  const current = active?.questions[questionIndex] ?? null;
  const answer = current ? active?.answers.find((item) => item.questionId === current.questionId) : undefined;
  function toggleOption(question: StudyCoachQuizQuestion, optionIndex: number) {
    if (answer || submitting) return;
    if (question.type !== "MULTIPLE_CHOICE") {
      const selectedOptionIndexes = [optionIndex];
      setSelection(selectedOptionIndexes);
      setError("");
      void submitAnswer({ questionId: question.questionId, selectedOptionIndexes, clientEventId: createClientEventId("quiz-answer") });
      return;
    }
    setSelection((selected) => {
      const next = selected.includes(optionIndex) ? selected.filter((index) => index !== optionIndex) : [...selected, optionIndex];
      setDraftSelections((drafts) => ({ ...drafts, [question.questionId]: next }));
      return next;
    });
    setError("");
  }
  async function submitAnswer(existing?: PendingAnswer) {
    if (!active || !current || answerSubmittingRef.current) return;
    const request = existing ?? { questionId: current.questionId, selectedOptionIndexes: selection, textAnswer: current.type === "FILL_BLANK" ? textAnswer.trim() : undefined, clientEventId: createClientEventId("quiz-answer") };
    if (!request.selectedOptionIndexes.length && !request.textAnswer) { setError(current.type === "FILL_BLANK" ? "Hãy nhập câu trả lời hoặc dùng Câu tiếp để bỏ qua." : "Hãy chọn đáp án hoặc dùng Câu tiếp để bỏ qua."); return; }
    answerSubmittingRef.current = true; setSubmitting(true); setError(""); setPendingAnswer(request);
    try {
      const result = await studyCoachService.submitQuizAnswer(active.attemptId, request.questionId, request.selectedOptionIndexes, request.clientEventId, request.textAnswer);
      const nextAnswer: StudyCoachQuizAnswer = result;
      setState({ ...active, answeredCount: result.progress.answeredCount, unansweredCount: result.progress.totalQuestions - result.progress.answeredCount, questions: active.questions.map((question) => question.questionId === result.questionId ? { ...question, answerState: "ANSWERED" } : question), answers: [...active.answers.filter((item) => item.questionId !== result.questionId), nextAnswer] });
      setDraftSelections((drafts) => { const next = { ...drafts }; delete next[result.questionId]; return next; });
      setDraftTextAnswers((drafts) => { const next = { ...drafts }; delete next[result.questionId]; return next; });
      if (questionIndex < active.questions.length - 1) {
        const nextIndex = questionIndex + 1;
        setQuestionIndex(nextIndex);
        setSelection(draftSelections[active.questions[nextIndex].questionId] ?? []);
        setTextAnswer(draftTextAnswers[active.questions[nextIndex].questionId] ?? "");
      } else {
        setSelection([]);
        setTextAnswer("");
      }
      setPendingAnswer(null);
    } catch (cause) { setError(messageOf(cause, "Không thể gửi câu trả lời.")); }
    finally { answerSubmittingRef.current = false; setSubmitting(false); }
  }
  function updateTextAnswer(value: string) {
    if (!current || answer || submitting) return;
    setTextAnswer(value);
    setDraftTextAnswers((drafts) => ({ ...drafts, [current.questionId]: value }));
    setError("");
  }
  async function exportQuiz(quiz: StudyCoachQuizSummary) {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) { setError("Trình duyệt đang chặn cửa sổ xuất PDF. Hãy cho phép cửa sổ bật lên rồi thử lại."); return; }
    setExporting(true); setError("");
    try {
      printWindow.document.write("<p style='font-family:Arial,sans-serif;padding:24px'>Đang chuẩn bị câu hỏi...</p>");
      const data = await studyCoachService.getQuizExport(quiz.id);
      printWindow.document.open();
      printWindow.document.write(quizPrintHtml(data, quiz.document.name));
      printWindow.document.close();
      printWindow.focus();
    } catch (cause) {
      printWindow.close();
      setError(messageOf(cause, "Không thể chuẩn bị file PDF."));
    } finally { setExporting(false); }
  }
  async function finalize(existingEventId?: string) {
    if (!active || quizSubmittingRef.current) return;
    quizSubmittingRef.current = true; setSubmitting(true); setError("");
    const clientEventId = existingEventId ?? createClientEventId("quiz-submit"); setPendingSubmitId(clientEventId);
    try { const result = await studyCoachService.submitQuiz(active.attemptId, clientEventId); applyState(result); }
    catch (cause) { setError(messageOf(cause, "Không thể nộp quiz.")); }
    finally { quizSubmittingRef.current = false; setSubmitting(false); }
  }

  async function openHistory(attemptId: string) {
    if (quizSubmittingRef.current) return;
    quizSubmittingRef.current = true; setSubmitting(true); setError("");
    try { applyState(await studyCoachService.getQuizResult(attemptId)); }
    catch (cause) { setError(messageOf(cause, "Không thể mở kết quả bài luyện.")); }
    finally { quizSubmittingRef.current = false; setSubmitting(false); }
  }
  function goToQuestion(index: number) {
    if (!active) return;
    const nextIndex = Math.max(0, Math.min(index, active.questions.length - 1));
    const questionId = active.questions[nextIndex].questionId;
    setSelection(draftSelections[questionId] ?? []); setTextAnswer(draftTextAnswers[questionId] ?? ""); setError(""); setQuestionIndex(nextIndex);
  }
  function toggleMarkedQuestion() {
    if (!active || !current) return;
    setMarkedQuestionIds((marked) => {
      const next = marked.includes(current.questionId)
        ? marked.filter((questionId) => questionId !== current.questionId)
        : [...marked, current.questionId];
      saveMarkedQuestions(active.attemptId, next);
      return next;
    });
  }
  function restart() {
    if (state) clearMarkedQuestions(state.attemptId);
    setMarkedQuestionIds([]); setDraftSelections({}); setDraftTextAnswers({}); setState(null); setSelectedQuiz((currentQuiz) => currentQuiz ? { ...currentQuiz, activeAttemptId: null } : null); setSelection([]); setTextAnswer(""); setError(""); setPendingSubmitId(null);
  }
  const backHref = documentId ? `/student/study-coach/materials/${encodeURIComponent(documentId)}` : "/student/study-coach";

  return <StudentShell>
    <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"><button type="button" onClick={() => router.push(backHref)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><ArrowLeft className="size-4" /> {documentId ? "Quay lại tài liệu" : "Quay lại Study Coach"}</button><p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-brand-600">Luyện tập theo tài liệu</p><h1 className="mt-1 text-2xl font-black text-slate-950">Bài luyện kiến thức</h1><p className="mt-1 text-sm text-slate-500">{selectedQuiz?.document.name ?? quizzes[0]?.document.name ?? "Chọn bài luyện phù hợp để bắt đầu."}</p></header>
    {loading ? <LoadingPanel /> : null}
    {!loading && !state && !selectedQuiz ? <QuizHub quizzes={quizzes} history={history} error={error} submitting={submitting} onSelect={setSelectedQuiz} onOpenHistory={(attemptId) => void openHistory(attemptId)} onRetry={() => void load()} /> : null}
    {!loading && !state && selectedQuiz ? <QuizStart quiz={selectedQuiz} submitting={submitting} exporting={exporting} error={error} onBack={() => { setSelectedQuiz(null); setError(""); }} onStart={() => void startQuiz(selectedQuiz)} onExport={() => void exportQuiz(selectedQuiz)} /> : null}
    {active && current ? <div data-testid="quiz-question"><QuestionPanel attempt={active} question={current} index={questionIndex} selection={selection} textAnswer={textAnswer} answer={answer} markedQuestionIds={markedQuestionIds} submitting={submitting} error={error} pendingAnswer={pendingAnswer} pendingSubmitId={pendingSubmitId} onToggle={toggleOption} onTextAnswer={updateTextAnswer} onToggleMarked={toggleMarkedQuestion} onGoTo={goToQuestion} onSubmitAnswer={() => void submitAnswer()} onRetryAnswer={() => pendingAnswer && void submitAnswer(pendingAnswer)} onNext={() => goToQuestion(questionIndex + 1)} onPrevious={() => goToQuestion(questionIndex - 1)} onFinalize={() => void finalize()} onRetryFinalize={() => pendingSubmitId && void finalize(pendingSubmitId)} /></div> : null}
    {state?.status === "SUBMITTED" ? <div data-testid="quiz-result"><ResultPanel result={state} onBack={() => void load()} onRestart={restart} /></div> : null}
  </StudentShell>;
}

function QuizHub({ quizzes, history, error, submitting, onSelect, onOpenHistory, onRetry }: { quizzes: StudyCoachQuizSummary[]; history: StudyCoachQuizHistoryItem[]; error: string; submitting: boolean; onSelect: (quiz: StudyCoachQuizSummary) => void; onOpenHistory: (attemptId: string) => void; onRetry: () => void }) {
  return <div className="mt-5 space-y-5" data-testid="quiz-hub">
    {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5" role="alert"><p className="font-semibold text-rose-700">{error}</p><Button variant="outline" className="mt-3" onClick={onRetry}>Thử lại</Button></div> : null}
    <section className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-card sm:p-6">
      <p className="text-xs font-black uppercase tracking-wider text-brand-600">Làm bài mới</p>
      <h2 className="mt-1 text-xl font-black text-slate-950">Kiểm tra kiến thức của bạn</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Mỗi lượt làm bài sử dụng câu hỏi thuộc đúng tài liệu này và được lưu riêng trong lịch sử.</p>
      <div className="mt-5 grid gap-3">
        {quizzes.length ? quizzes.map((quiz) => <button key={quiz.id} type="button" onClick={() => onSelect(quiz)} className="block w-full rounded-2xl border border-blue-100 bg-white p-5 text-left transition hover:border-brand-400 focus:outline-none focus:ring-4 focus:ring-blue-100"><p className="text-xs font-black uppercase tracking-wider text-brand-600">{quiz.subject.name || "Bài luyện"}</p><h3 className="mt-1 text-lg font-black text-slate-950">{quiz.title}</h3><p className="mt-2 text-sm text-slate-500">{quiz.availableQuestionCount} câu hỏi</p>{quiz.activeAttemptId ? <span className="mt-3 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Tiếp tục bài đang làm</span> : <span className="mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Sẵn sàng bắt đầu</span>}</button>) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">Tài liệu này chưa có câu hỏi luyện tập.</p>}
      </div>
    </section>
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><CalendarClock className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Lịch sử làm bài</p><h2 className="mt-0.5 text-xl font-black text-slate-950">Các lượt đã hoàn thành</h2></div></div>
      {history.length ? <div className="mt-5 grid gap-3">{history.map((item) => <article key={item.attemptId} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black text-slate-950">{item.title}</h3><p className="mt-1 text-sm text-slate-500">{formatDateTime(item.submittedAt)} · {item.correctCount}/{item.totalQuestions} câu đúng</p><p className="mt-2 text-2xl font-black text-brand-700">{item.percentage}%</p></div><Button variant="outline" disabled={submitting} onClick={() => onOpenHistory(item.attemptId)}>{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Eye className="size-4" />} Xem kết quả</Button></article>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Bạn chưa hoàn thành lượt làm bài nào với tài liệu này.</p>}
    </section>
  </div>;
}
function QuizStart({ quiz, submitting, exporting, error, onBack, onStart, onExport }: { quiz: StudyCoachQuizSummary; submitting: boolean; exporting: boolean; error: string; onBack: () => void; onStart: () => void; onExport: () => void }) {
  const actual = Math.min(quiz.availableQuestionCount, 30);
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"><button type="button" onClick={onBack} className="text-sm font-bold text-slate-500">← Quay lại danh sách bài luyện</button><h2 className="mt-5 text-2xl font-black text-slate-950">{quiz.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{quiz.description || quiz.document.name}</p><p className="mt-3 text-sm font-semibold text-slate-600">Bài luyện này gồm {actual} câu hỏi. Bạn có thể đánh dấu câu cần xem lại trước khi nộp.</p>{error ? <ErrorBox message={error} /> : null}<div className="mt-5 flex flex-wrap gap-3"><Button className="h-12" disabled={!actual || submitting || exporting} onClick={onStart}>{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <CircleHelp className="size-4" />} {quiz.activeAttemptId ? "Tiếp tục bài đang làm" : "Bắt đầu làm bài"}</Button><Button variant="outline" className="h-12" disabled={!actual || submitting || exporting} onClick={onExport}>{exporting ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} {exporting ? "Đang chuẩn bị PDF" : "Xuất câu hỏi PDF"}</Button></div><p className="mt-3 text-xs text-slate-500">Khi cửa sổ in mở ra, chọn “Lưu thành PDF” để tải file về máy.</p></section>;
}
function QuestionPanel({ attempt, question, index, selection, textAnswer, answer, markedQuestionIds, submitting, error, pendingAnswer, pendingSubmitId, onToggle, onTextAnswer, onToggleMarked, onGoTo, onSubmitAnswer, onRetryAnswer, onNext, onPrevious, onFinalize, onRetryFinalize }: { attempt: StudyCoachQuizAttempt; question: StudyCoachQuizQuestion; index: number; selection: number[]; textAnswer: string; answer?: StudyCoachQuizAnswer; markedQuestionIds: string[]; submitting: boolean; error: string; pendingAnswer: PendingAnswer | null; pendingSubmitId: string | null; onToggle: (question: StudyCoachQuizQuestion, optionIndex: number) => void; onTextAnswer: (value: string) => void; onToggleMarked: () => void; onGoTo: (index: number) => void; onSubmitAnswer: () => void; onRetryAnswer: () => void; onNext: () => void; onPrevious: () => void; onFinalize: () => void; onRetryFinalize: () => void }) {
  const last = index === attempt.questions.length - 1;
  const marked = markedQuestionIds.includes(question.questionId);
  return <>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
        <span>Câu {index + 1}/{attempt.totalQuestions}</span>
        <span>{attempt.answeredCount} đã trả lời · {markedQuestionIds.length} đã đánh dấu</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${((index + 1) / attempt.totalQuestions) * 100}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Danh sách câu hỏi">
        {attempt.questions.map((item, itemIndex) => {
          const itemMarked = markedQuestionIds.includes(item.questionId);
          const answered = attempt.answers.some((saved) => saved.questionId === item.questionId);
          return <button key={item.questionId} type="button" disabled={submitting} onClick={() => onGoTo(itemIndex)} aria-current={itemIndex === index ? "step" : undefined} aria-label={`Câu ${itemIndex + 1}${itemMarked ? ", đã đánh dấu" : ""}${answered ? ", đã trả lời" : ""}`} className={`relative grid size-10 place-items-center rounded-xl border text-sm font-black focus:outline-none focus:ring-4 focus:ring-blue-100 ${itemIndex === index ? "border-brand-600 bg-brand-600 text-white" : answered ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}>
            {itemIndex + 1}
            {itemMarked ? <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-amber-500" aria-hidden="true" /> : null}
          </button>;
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">Chọn số câu để quay lại câu đã đánh dấu hoặc câu còn bỏ trống.</p>
    </section>

    <article className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-brand-600">{questionTypeLabels[question.type]}</p>
        <Button variant="outline" disabled={submitting} aria-pressed={marked} onClick={onToggleMarked}>
          {marked ? <BookmarkCheck className="size-4 text-amber-600" /> : <Bookmark className="size-4" />}
          {marked ? "Đã đánh dấu" : "Đánh dấu câu này"}
        </Button>
      </div>
      <h2 className="mt-4 text-xl font-black leading-8 text-slate-950">{question.content}</h2>
      {question.type === "FILL_BLANK" ? <div className="mt-6"><label htmlFor={`fill-blank-${question.questionId}`} className="text-sm font-black text-slate-700">Câu trả lời của bạn</label><input id={`fill-blank-${question.questionId}`} type="text" value={answer?.textAnswer ?? textAnswer} disabled={Boolean(answer) || submitting} maxLength={500} autoComplete="off" onChange={(event) => onTextAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && textAnswer.trim()) onSubmitAnswer(); }} placeholder="Nhập từ hoặc cụm từ còn thiếu" className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50" /><p className="mt-2 text-xs text-slate-500">Có thể nhập tiếng Việt có dấu hoặc không dấu; hệ thống cũng bỏ qua khác biệt chữ hoa, chữ thường và khoảng trắng thừa.</p></div> : <div className="mt-6 grid gap-3">
        {question.options.map((option, optionIndex) => {
          const checked = answer ? answer.selectedOptionIndexes.includes(optionIndex) : selection.includes(optionIndex);
          return <button key={option.id} type="button" disabled={Boolean(answer) || submitting} aria-pressed={checked} onClick={() => onToggle(question, optionIndex)} className={`min-h-14 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${checked ? "border-brand-500 bg-blue-50 ring-1 ring-brand-200" : "border-slate-200 hover:bg-slate-50"}`}><span className="mr-3 font-black text-brand-700">{option.label}</span>{option.text}</button>;
        })}
      </div>}
      {error ? <ErrorBox message={error} /> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="outline" disabled={index === 0 || submitting} onClick={onPrevious}>Câu trước</Button>
        {!answer && (question.type === "MULTIPLE_CHOICE" || question.type === "FILL_BLANK") ? <Button disabled={submitting || (question.type === "FILL_BLANK" ? !textAnswer.trim() : !selection.length)} onClick={onSubmitAnswer}>{submitting && pendingAnswer ? <LoaderCircle className="size-4 animate-spin" /> : null}{last ? "Xác nhận câu trả lời" : "Xác nhận và sang câu tiếp"}</Button> : null}
        {!last ? <Button variant="secondary" disabled={submitting} onClick={onNext}>{answer ? "Câu tiếp" : "Bỏ qua / Câu tiếp"}</Button> : null}
        {last || attempt.answeredCount === attempt.totalQuestions ? <Button disabled={submitting} onClick={onFinalize}>Nộp bài</Button> : null}
      </div>
      {error && pendingAnswer ? <Button variant="outline" className="mt-3" onClick={onRetryAnswer}><RotateCcw className="size-4" /> Gửi lại câu trả lời</Button> : null}
      {error && pendingSubmitId ? <Button variant="outline" className="mt-3" onClick={onRetryFinalize}><RotateCcw className="size-4" /> Thử nộp lại</Button> : null}
    </article>
  </>;
}
function ResultPanel({ result, onBack, onRestart }: { result: StudyCoachQuizResult; onBack: () => void; onRestart: () => void }) {
  return <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-card sm:p-8"><div className="text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-600" /><h2 className="mt-3 text-2xl font-black text-slate-950">Hoàn thành bài luyện</h2><p className="mt-3 text-4xl font-black text-brand-700">{result.correctCount}/{result.totalQuestions}</p><p className="mt-1 text-lg font-bold text-slate-600">{result.percentage}%</p></div><div className="mt-6 grid grid-cols-3 gap-3 text-center"><Metric label="Đúng" value={result.correctCount} /><Metric label="Sai" value={result.incorrectCount} /><Metric label="Bỏ trống" value={result.unansweredCount} /></div><div className="mt-6 space-y-2">{result.questions.map((question) => <ResultQuestion key={question.questionId} question={question} />)}</div><div className="mt-6 flex flex-wrap gap-3"><Button variant="outline" onClick={onBack}><ArrowLeft className="size-4" /> Trang bài luyện</Button><Button onClick={onRestart}><RotateCcw className="size-4" /> Làm lượt mới</Button></div></section>;
}
function ResultQuestion({ question }: { question: StudyCoachQuizResult["questions"][number] }) {
  const unanswered = question.selectedOptionIndexes.length === 0 && !question.textAnswer;
  const label = unanswered ? "Chưa trả lời" : question.isCorrect ? "Trả lời đúng" : "Trả lời sai";
  const tone = unanswered ? "text-slate-500" : question.isCorrect ? "text-emerald-700" : "text-rose-700";
  return <article className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">{unanswered ? <CircleHelp className="mt-0.5 size-5 shrink-0 text-slate-400" /> : question.isCorrect ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />}<div><p className={`text-xs font-black ${tone}`}>Câu {question.order} · {label}</p><p className="mt-1 text-sm font-semibold text-slate-800">{question.content}</p>{question.type === "FILL_BLANK" && question.textAnswer ? <p className="mt-2 text-sm text-slate-600">Bạn trả lời: <strong>{question.textAnswer}</strong></p> : null}{question.type === "FILL_BLANK" && question.correctAnswers.length ? <p className="mt-1 text-sm text-emerald-700">Đáp án được chấp nhận: <strong>{question.correctAnswers.join(" / ")}</strong></p> : null}</div></article>;
}
function LoadingPanel() { return <div className="mt-5 grid min-h-72 place-items-center rounded-2xl border border-slate-200 bg-white"><LoaderCircle className="size-8 animate-spin text-brand-600" /></div>; }
function ErrorBox({ message }: { message: string }) { return <p role="alert" className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-semibold text-rose-700">{message}</p>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black text-slate-950">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div>; }
function markedStorageKey(attemptId: string) { return `${MARKED_KEY}:${attemptId}`; }
function readMarkedQuestions(attemptId: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(markedStorageKey(attemptId)) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
function saveMarkedQuestions(attemptId: string, questionIds: string[]) {
  try { localStorage.setItem(markedStorageKey(attemptId), JSON.stringify(questionIds)); } catch { /* Marking still works for the current screen. */ }
}
function clearMarkedQuestions(attemptId: string) {
  try { localStorage.removeItem(markedStorageKey(attemptId)); } catch { /* Nothing else to clear. */ }
}
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function quizPrintHtml(data: StudyCoachQuizExport, documentName: string) {
  const questions = data.questions.map((question) => {
    const options = question.type === "FILL_BLANK"
      ? '<div class="answer-line"></div>'
      : `<ol type="A">${question.options.map((option) => `<li>${escapeHtml(option.text)}</li>`).join("")}</ol>`;
    return `<section class="question"><strong>Câu ${question.order}.</strong> ${escapeHtml(question.content)}${options}</section>`;
  }).join("");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHtml(data.title)}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,"Segoe UI",sans-serif;color:#0f172a;font-size:13px;line-height:1.55}h1{font-size:22px;margin:0 0 6px}.meta{color:#475569;margin-bottom:24px}.student{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin:20px 0}.field{border-bottom:1px solid #64748b;padding-bottom:5px}.question{break-inside:avoid;margin:0 0 18px}.question ol{margin:8px 0 0 22px;padding:0}.question li{padding:2px 0}.answer-line{height:28px;border-bottom:1px solid #64748b;margin-top:8px}@media print{button{display:none}}</style></head><body><h1>${escapeHtml(data.title)}</h1><div class="meta">Tài liệu: ${escapeHtml(documentName)} · ${data.questions.length} câu hỏi</div><div class="student"><div class="field">Họ và tên:</div><div class="field">Ngày làm:</div></div>${questions}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`;
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function createClientEventId(scope: string) { return `${scope}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`; }
function messageOf(cause: unknown, fallback: string) { return cause instanceof Error ? cause.message : fallback; }
