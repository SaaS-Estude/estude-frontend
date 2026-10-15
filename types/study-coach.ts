export type StudyCoachMaterialLifecycle =
  | "UPLOAD_PENDING"
  | "READY_TO_PROCESS"
  | "PROCESSING"
  | "CANCELLED"
  | "READY"
  | "FAILED"
  | "UNAVAILABLE";
export type StudyCoachUploadStatus = "PENDING" | "READY";
export type StudyCoachProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface StudyCoachMaterial {
  id: string;
  title: string;
  mimeType: string;
  size: number;
  uploadStatus: StudyCoachUploadStatus;
  processingStatus: StudyCoachProcessingStatus;
  lifecycle: StudyCoachMaterialLifecycle;
  version: number;
  pageCount: number | null;
  readyForStudy: boolean;
  generation: {
    jobId: string;
    status: StudyCoachProcessingStatus;
    version: number;
    updatedAt: string;
  } | null;
  failureCode: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyCoachMaterialPage {
  items: StudyCoachMaterial[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface StudyCoachUploadMaterial {
  id: string;
  title: string;
  mimeType: string;
  size: number;
  uploadStatus: StudyCoachUploadStatus;
  processingStatus: StudyCoachProcessingStatus | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudyCoachUploadSession {
  material: StudyCoachUploadMaterial;
  uploadUrl: string;
  method: "PUT";
  expiresIn: number;
}

export interface StudyCoachGenerationJob {
  jobId: string;
  status: StudyCoachProcessingStatus;
  documentId: string;
  contentVersion: number;
  generationVersion: number;
  errorCode: string | null;
  retryable: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface StudyCoachCapabilityState { enabled: boolean }
export interface StudyCoachCapabilities {
  processing: StudyCoachCapabilityState;
  materials: StudyCoachCapabilityState;
  knowledgeMap: StudyCoachCapabilityState;
  flashcards: StudyCoachCapabilityState;
  quiz: StudyCoachCapabilityState;
  mastery: StudyCoachCapabilityState;
  adaptiveLearning: StudyCoachCapabilityState;
  insights: StudyCoachCapabilityState;
}

export type KnowledgeConceptRelationType =
  | "PREREQUISITE"
  | "PART_OF"
  | "RELATED_TO"
  | "CAUSES"
  | "CONTRASTS";

export interface StudyCoachKnowledgeConcept {
  id: string;
  stableKey: string;
  title: string;
  definition: string;
  importance: "CORE" | "SUPPORTING";
}

export interface StudyCoachKnowledgeTopic {
  id: string;
  stableKey: string;
  parentTopicId: string | null;
  title: string;
  summary: string;
  order: number;
  concepts: StudyCoachKnowledgeConcept[];
}

export interface StudyCoachKnowledgeMap {
  materialId: string;
  materialTitle: string;
  mapId: string;
  title: string;
  summary: string;
  version: number;
  status: StudyCoachProcessingStatus;
  topics: StudyCoachKnowledgeTopic[];
  relations: Array<{
    id: string;
    fromConceptId: string;
    toConceptId: string;
    type: KnowledgeConceptRelationType;
  }>;
  updatedAt: string;
}

export type FlashcardDifficulty = "EASY" | "MEDIUM" | "HARD";
export type FlashcardQueueKind = "DUE" | "NEW" | "PRACTICE";

export interface FlashcardSourceReference {
  pageNumber: number | null;
  section: string | null;
  excerpt: string;
}

export interface FlashcardReviewSchedule {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
  lastRating: number | null;
  lastReviewedAt: string | null;
  nextReviewAt: string;
}

export interface StudyCoachFlashcard {
  id: string;
  document: { id: string; name: string };
  concept: { id: string; title: string };
  front: string;
  back: string;
  difficulty: FlashcardDifficulty;
  sourceReferences: FlashcardSourceReference[];
  generationVersion: number;
  queueKind?: FlashcardQueueKind;
  review: FlashcardReviewSchedule | null;
}

export interface FlashcardQueue {
  cards: StudyCoachFlashcard[];
  actualSize: number;
  dueCount: number;
  newCount: number;
  scheduledCount: number;
  totalAvailable: number;
  totalCards: number;
  mode: "DUE" | "ALL";
  asOf: string;
}

export interface FlashcardReviewResult {
  flashcardId: string;
  conceptId: string;
  eventId: string;
  idempotentReplay: boolean;
  reviewedAt: string;
  schedule: FlashcardReviewSchedule;
  remaining: { due: number; new: number; total: number };
}

export type StudyCoachQuizQuestionType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK";

export interface StudyCoachQuizSummary {
  id: string;
  title: string;
  description: string;
  subject: { id: string; name: string };
  document: { id: string; name: string };
  availableQuestionCount: number;
  activeAttemptId: string | null;
}

export interface StudyCoachQuizHistoryItem {
  attemptId: string;
  examId: string;
  title: string;
  document: { id: string; name: string };
  submittedAt: string;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentage: number;
  durationSeconds: number;
}

export interface StudyCoachQuizQuestion {
  questionId: string;
  order: number;
  type: StudyCoachQuizQuestionType;
  content: string;
  options: Array<{ id: string; label: string; text: string }>;
  score: 1;
  maxScore: 1;
  conceptIds: string[];
  sourceReferences: unknown[];
  difficulty: string;
  answerState: "ANSWERED" | "UNANSWERED";
}

export interface StudyCoachQuizAnswer {
  questionId: string;
  selectedOptionIndexes: number[];
  textAnswer: string | null;
  answeredAt: string;
  responseTimeMs: number;
}

export interface StudyCoachQuizAttempt {
  attemptId: string;
  examId: string;
  status: "IN_PROGRESS";
  title: string;
  documentId: string;
  startedAt: string;
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  currentQuestionIndex: number;
  questions: StudyCoachQuizQuestion[];
  answers: StudyCoachQuizAnswer[];
}

export interface StudyCoachQuizAnswerResult extends StudyCoachQuizAnswer {
  attemptId: string;
  examId: string;
  idempotentReplay: boolean;
  progress: { answeredCount: number; totalQuestions: number };
}

export interface StudyCoachQuizExport {
  examId: string;
  title: string;
  documentId: string;
  exportedAt: string;
  questions: Array<Omit<StudyCoachQuizQuestion, "answerState">>;
}

export interface StudyCoachQuizResult {
  attemptId: string;
  examId: string;
  status: "SUBMITTED";
  title: string;
  submittedAt: string;
  durationSeconds: number;
  idempotentReplay: boolean;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  percentage: number;
  score: number;
  maxScore: number;
  questions: Array<{
    questionId: string;
    order: number;
    isCorrect: boolean;
    selectedOptionIndexes: number[];
    textAnswer: string | null;
    correctAnswers: string[];
    score: number;
    maxScore: 1;
    type: StudyCoachQuizQuestionType;
    content: string;
    options: Array<{ id: string; label: string; text: string }>;
    conceptIds: string[];
  }>;
}

export type StudyCoachQuizState = StudyCoachQuizAttempt | StudyCoachQuizResult;

export type ConceptMasteryState =
  | "NEW"
  | "NEEDS_SUPPORT"
  | "DEVELOPING"
  | "PROFICIENT"
  | "STRONG";
export type AdaptiveDifficulty = "EASY" | "MEDIUM" | "HARD";

export interface ConceptMasteryView {
  conceptId: string;
  conceptName: string;
  topicId: string;
  documentId: string;
  masteryScore: number;
  evidenceCount: number;
  correctEvidence: number;
  incorrectEvidence: number;
  state: ConceptMasteryState;
  targetDifficulty: AdaptiveDifficulty;
  updatedAt: string;
}

export interface StudyCoachLearningActivity {
  flashcardReviewCount: number;
  quizAnswerCount: number;
  flashcardSessionCount: number;
  quizCompletionCount: number;
  totalCompletedSessions: number;
  totalActivityCount: number;
}

export interface ConceptMasteryResult {
  items: ConceptMasteryView[];
  total: number;
  activity: StudyCoachLearningActivity;
  policy: { minimumEvidenceRequired: number };
}

export interface InsightConceptView extends ConceptMasteryView {
  reason?: string;
}

export type InsightScope = "DOCUMENT" | "STUDENT";
export type InsightSource = "AI" | "FALLBACK" | "INSUFFICIENT_DATA";
export type InsightActionType = "LEARN" | "PRACTICE" | "REVIEW" | "CHALLENGE";

export interface LearningInsight {
  id: string;
  scope: InsightScope;
  documentId: string | null;
  language: "vi" | "en";
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  source: InsightSource;
  isFresh: boolean;
  generatedAt: string;
  errorCode: string | null;
  providerFailureRetryable: boolean;
  canRegenerateSameInput: false;
  summary: string;
  strengths: Array<InsightConceptView & { reason: string }>;
  weakAreas: Array<InsightConceptView & { reason: string }>;
  progress: Array<InsightConceptView & { direction: "IMPROVING" | "STABLE" | "DECLINING"; reason: string }>;
  nextActions: Array<InsightConceptView & { actionType: InsightActionType; reason: string; priority: number }>;
  mastery: ConceptMasteryView[];
  quiz: {
    attemptCount: number;
    completedAttempts: number;
    questionCount: number;
    score: number;
    answeredCount: number;
    correctCount: number;
    incorrectCount: number;
    accuracy: number | null;
    meanResponseTimeMs: number | null;
  };
  flashcards: { reviewCount: number; againCount: number; hardCount: number; goodCount: number; easyCount: number };
  window: { omittedConceptCount: number; invalidQuizSignals: number } & Record<string, unknown>;
}
