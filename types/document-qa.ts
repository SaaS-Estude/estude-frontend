export type DocumentQaKind = "own" | "course";

export interface DocumentQaCitation {
  marker: number;
  documentName: string;
  page: number;
  chunkIndex: number;
  excerpt: string;
}

export interface DocumentQaMessage {
  id: string;
  /** Questions that follow each other on one topic share a conversation. */
  conversationId: string;
  question: string;
  /** NOT_FOUND means the document does not contain the answer. */
  status: "ANSWERED" | "NOT_FOUND";
  answer: string;
  citations: DocumentQaCitation[];
  createdAt: string;
}

export interface DocumentQaLimits {
  limit: number;
  used: number;
  remaining: number;
  /** When the oldest counted question stops counting; null if none is counted. */
  resetsAt: string | null;
}

export interface DocumentQaHistory {
  document: { id: string; name: string; kind: string };
  messages: DocumentQaMessage[];
  limits: DocumentQaLimits;
}

export interface DocumentQaResult {
  message: DocumentQaMessage;
  limits: DocumentQaLimits;
}
