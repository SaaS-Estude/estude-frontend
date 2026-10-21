import type { User } from "@/types/auth";

export type ChatAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: Pick<User, "id" | "fullName" | "accountName" | "avatarUrl" | "role">;
  attachments: ChatAttachment[];
};

export const CHAT_PAGE_SIZE = 40;
const MAX_ROOMS = 8;
const MAX_AGE_MS = 2 * 60_000;
type Snapshot = { messages: ChatMessage[]; hasOlder: boolean; savedAt: number };
// Memory only: keys include the school, account and class. No chat data is
// persisted in browser storage, and logout clears all snapshots.
const recent = new Map<string, Snapshot>();

export function readRecentChat(key: string): Snapshot | undefined {
  const snapshot = recent.get(key);
  if (snapshot && Date.now() - snapshot.savedAt <= MAX_AGE_MS) return snapshot;
  recent.delete(key);
}

export function rememberRecentChat(key: string, messages: ChatMessage[], hasOlder: boolean) {
  recent.delete(key);
  recent.set(key, { messages: messages.slice(-CHAT_PAGE_SIZE), hasOlder: hasOlder || messages.length > CHAT_PAGE_SIZE, savedAt: Date.now() });
  while (recent.size > MAX_ROOMS) recent.delete(recent.keys().next().value!);
}

export function clearRecentChat(key?: string) {
  if (key) recent.delete(key);
  else recent.clear();
}
