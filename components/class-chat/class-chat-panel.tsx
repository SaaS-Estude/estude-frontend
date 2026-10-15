"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { FileImage, FileText, LoaderCircle, Paperclip, Send, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/context/permissions-context";
import { ApiError, authenticatedRequest, getRealtimeAccessToken, subscribeAccessToken } from "@/lib/auth-api";
import type { User } from "@/types/auth";

type ChatAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type ChatMessage = {
  id: string;
  content: string;
  createdAt: string;
  sender: Pick<User, "id" | "fullName" | "accountName" | "avatarUrl" | "role">;
  attachments: ChatAttachment[];
};

type PendingAttachment = {
  id: string;
  file: File;
  status: "pending" | "uploading";
};

type UploadedAttachment = { fileName: string; contentType: string; size: number; s3Key: string };
type ChatAck = { ok: true; message?: ChatMessage } | { ok: false; code: string; message: string };
type PendingMessage = { id: string; content: string; files: PendingAttachment[]; uploaded: UploadedAttachment[]; attempted: boolean };

function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const unique = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) unique.set(item.id, item);
  return [...unique.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<ChatAck> {
  if (!socket.connected) return Promise.reject(new Error('Kênh chat đang mất kết nối'));
  return new Promise((resolve, reject) => {
    // Volatile avoids Socket.IO buffering a timed-out send for a later connection.
    socket.volatile.timeout(15_000).emit(event, payload, (error: Error | null, result: ChatAck) => {
      if (error || !result) reject(new Error('Chưa nhận được xác nhận từ máy chủ. Vui lòng thử lại.'));
      else resolve(result);
    });
  });
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

function socketUrl(): string {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");
  return apiUrl.replace(/\/api\/v1$/, "");
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(value));
}

function formatSize(size: number): string {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.details.join(" · ") || error.message : error instanceof Error ? error.message : fallback;
}

export function ClassChatPanel(props: { classId: string; className?: string }) {
  const { can } = usePermissions();
  if (!can("class_chat.read")) return null;
  return <ClassChatContent key={props.classId} {...props} />;
}

function ClassChatContent({ classId, className }: { classId: string; className?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<PendingAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const mountedRef = useRef(false);
  const readyRef = useRef(false);
  const sendingRef = useRef(false);
  const pendingRef = useRef<PendingMessage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const retryRef = useRef<() => void>(() => undefined);
  const scrollRef = useRef<{ height: number; top: number } | null>(null);
  const followRef = useRef(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [uncertain, setUncertain] = useState(false);

  const merge = useCallback((incoming: ChatMessage[]) => {
    messagesRef.current = mergeMessages(messagesRef.current, incoming);
    setMessages(messagesRef.current);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    const list = listRef.current;
    followRef.current = !list || list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    merge([message]);
  }, [merge]);

  useEffect(() => {
    let active = true;
    let revision = 0;
    let cursor: ChatMessage | undefined;
    let initialLoaded = false;
    let authRetried = false;
    let forceRefresh = false;
    let usedToken: string | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    mountedRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    const socket = io(`${socketUrl()}/class-chat`, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (callback) => {
        void getRealtimeAccessToken(forceRefresh).then((token) => {
          forceRefresh = false;
          if (active) { usedToken = token; callback({ token }); }
        }).catch((cause: unknown) => {
          if (!active) return;
          setError(errorMessage(cause, "Không thể làm mới phiên chat"));
          setLoading(false);
          socket.disconnect();
        });
      },
    });
    socketRef.current = socket;
    const unsubscribeToken = subscribeAccessToken((token) => {
      if (!active) return;
      forceRefresh = false;
      if (!token) {
        clearTimeout(reconnectTimer);
        socket.disconnect();
        readyRef.current = false;
        setConnected(false);
        setLoading(false);
        setError("Phiên đăng nhập đã kết thúc");
      } else if (socket.connected && token !== usedToken) {
        socket.disconnect().connect();
      }
    });

    async function synchronise() {
      const version = ++revision;
      readyRef.current = false;
      setConnected(false);
      setLoading(true);
      setError("");
      const valid = () => active && version === revision && socket.connected;
      try {
        const joined = await emitWithAck(socket, "class:join", { classId });
        if (!valid()) return;
        if (!joined.ok) {
          if (joined.code === "AUTH_REQUIRED") { forceRefresh = true; socket.disconnect().connect(); return; }
          throw new Error(joined.message);
        }
        const user = await authenticatedRequest<User>("/auth/me", { signal: controller.signal });
        if (!valid()) return;
        setCurrentUser(user);
        // Join first, then read history. Live events and history are merged by ID.
        let more = true;
        while (more && valid()) {
          const query = new URLSearchParams({ limit: cursor ? "100" : "40" });
          if (cursor) { query.set("after", cursor.createdAt); query.set("afterId", cursor.id); }
          const page = await authenticatedRequest<ChatMessage[]>(`/classes/${encodeURIComponent(classId)}/chat/messages?${query}`, { signal: controller.signal });
          if (!valid()) return;
          more = !!cursor && page.length === 100;
          if (!cursor) setHasOlder(page.length === 40);
          if (!initialLoaded) { initialLoaded = true; followRef.current = true; }
          merge(page);
          cursor = page.at(-1) ?? cursor;
        }
        if (valid()) { readyRef.current = true; setConnected(true); }
      } catch (cause) {
        if (valid()) setError(errorMessage(cause, "Không thể đồng bộ trò chuyện"));
      } finally {
        if (active && version === revision) setLoading(false);
      }
    }

    socket.on("connect", () => { authRetried = false; void synchronise(); });
    socket.on("disconnect", (reason: string) => {
      ++revision;
      readyRef.current = false;
      setConnected(false);
      setLoading(false);
      if (active && reason === "io server disconnect") {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (active) socket.connect(); }, 250);
      }
    });
    socket.on("connect_error", (cause: Error & { data?: { code?: string } }) => {
      if (!active) return;
      setLoading(false);
      setError(cause.message || "Không thể kết nối trò chuyện");
      if (cause.data?.code === "AUTH_REQUIRED" && !authRetried) {
        authRetried = true;
        forceRefresh = true;
        socket.connect();
      }
    });
    socket.on("chat:error", (event: { code?: string; message?: string; classId?: string }) => {
      if (event.classId && event.classId !== classId) return;
      ++revision;
      readyRef.current = false;
      setConnected(false);
      setLoading(false);
      setError(event.message ?? "Không thể sử dụng kênh chat");
      if (event.code === "AUTH_REQUIRED") {
        forceRefresh = true;
        // Allow a server-initiated disconnect to finish before reconnecting.
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (active) socket.disconnect().connect(); }, 300);
      }
    });
    socket.on("exception", (event: { message?: string }) => setError(event.message ?? "Không thể xử lý trò chuyện"));
    socket.on("class:message", addMessage);
    retryRef.current = () => { if (socket.connected) void synchronise(); else socket.connect(); };
    socket.connect();
    return () => {
      active = false;
      mountedRef.current = false;
      readyRef.current = false;
      ++revision;
      clearTimeout(reconnectTimer);
      unsubscribeToken();
      controller.abort();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addMessage, classId, merge]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list && scrollRef.current) {
      list.scrollTop = scrollRef.current.top + list.scrollHeight - scrollRef.current.height;
      scrollRef.current = null;
    } else if (followRef.current) bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function loadOlder() {
    const oldest = messagesRef.current[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const query = new URLSearchParams({ before: oldest.createdAt, beforeId: oldest.id, limit: "40" });
      const page = await authenticatedRequest<ChatMessage[]>(`/classes/${encodeURIComponent(classId)}/chat/messages?${query}`, { signal: abortRef.current?.signal });
      if (!mountedRef.current) return;
      const list = listRef.current;
      if (list) scrollRef.current = { height: list.scrollHeight, top: list.scrollTop };
      merge(page);
      setHasOlder(page.length === 40);
    } catch (cause) {
      if (mountedRef.current) setError(errorMessage(cause, "Không thể tải tin nhắn cũ"));
    } finally { if (mountedRef.current) setLoadingOlder(false); }
  }

  function pickFiles(selected: FileList | null) {
    if (!selected?.length || sendingRef.current || pendingRef.current?.attempted) return;
    const candidates = Array.from(selected);
    if (candidates.some((file) => file.size === 0 || file.name.length > 180)) { setError("Tệp phải có nội dung và tên không quá 180 ký tự"); return; }
    const oversized = candidates.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) { setError(`${oversized.name} vượt giới hạn 10MB`); return; }
    if (files.length + candidates.length > MAX_FILES) { setError(`Mỗi tin nhắn chỉ gửi tối đa ${MAX_FILES} tệp`); return; }
    setFiles((current) => [...current, ...candidates.map((file) => ({ id: randomId(), file, status: "pending" as const }))]);
  }

  async function openAttachment(attachment: ChatAttachment) {
    // Open synchronously during the click so browsers do not block the signed URL.
    const popup = window.open("", "_blank");
    if (!popup) { setError("Trình duyệt đã chặn cửa sổ mở tệp. Hãy cho phép cửa sổ bật lên và thử lại."); return; }
    popup.opener = null;
    try {
      const { url } = await authenticatedRequest<{ url: string }>(`/classes/chat/attachments/${encodeURIComponent(attachment.id)}/url?preview=${attachment.mimeType.startsWith("image/")}`, { signal: abortRef.current?.signal });
      if (!mountedRef.current) { popup.close(); return; }
      popup.location.replace(url);
    } catch (cause) {
      popup.close();
      if (mountedRef.current) setError(errorMessage(cause, "Không thể mở tệp đính kèm"));
    }
  }

  async function sendMessage() {
    if (sendingRef.current) return;
    const text = content.trim();
    if (!text && !files.length && !pendingRef.current) return;
    const socket = socketRef.current;
    if (!socket?.connected || !readyRef.current) { setError("Kênh chat chưa sẵn sàng. Vui lòng kết nối lại."); return; }
    sendingRef.current = true;
    setSending(true);
    setError("");
    const pending = pendingRef.current ?? {
      id: randomId(),
      content: text, files: [...files], uploaded: [], attempted: false,
    };
    pendingRef.current = pending;
    try {
      for (let index = pending.uploaded.length; index < pending.files.length; index++) {
        const item = pending.files[index];
        setFiles((current) => current.map((file) => file.id === item.id ? { ...file, status: "uploading" } : file));
        const contentType = item.file.type.trim().toLowerCase() || "application/octet-stream";
        const session = await authenticatedRequest<{ s3Key: string; uploadUrl: string }>(`/classes/${encodeURIComponent(classId)}/chat/attachments/upload-url`, {
          method: "POST", signal: abortRef.current?.signal,
          body: JSON.stringify({ fileName: item.file.name, contentType, size: item.file.size }),
        });
        const upload = await fetch(session.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: item.file, signal: abortRef.current?.signal });
        if (!upload.ok) throw new Error(`Không thể tải ${item.file.name} lên`);
        pending.uploaded.push({ fileName: item.file.name, contentType, size: item.file.size, s3Key: session.s3Key });
      }
      if (!mountedRef.current) return;
      if (!socket.connected || !readyRef.current) throw new Error("Kết nối bị gián đoạn. Vui lòng thử lại.");
      pending.attempted = true;
      const result = await emitWithAck(socket, "class:message", { classId, clientMessageId: pending.id, content: pending.content, attachments: pending.uploaded });
      if (!mountedRef.current) return;
      if (!result.ok) {
        if (result.code !== "INTERNAL_ERROR") pending.attempted = false;
        if (result.code === "AUTH_REQUIRED") socket.disconnect().connect();
        throw new Error(result.message);
      }
      if (!result.message) throw new Error("Chưa nhận được xác nhận tin nhắn. Vui lòng thử lại.");
      followRef.current = true;
      merge([result.message]);
      pendingRef.current = null;
      setUncertain(false);
      setContent("");
      setFiles([]);
    } catch (cause) {
      if (!mountedRef.current) return;
      setUncertain(pending.attempted);
      if (!pending.attempted) pendingRef.current = null;
      setError(pending.attempted ? "Chưa xác nhận được tin nhắn đã gửi. Bấm gửi lại để kiểm tra, tin nhắn sẽ không bị gửi trùng." : errorMessage(cause, "Không thể gửi tin nhắn"));
      setFiles((current) => current.map((item) => ({ ...item, status: "pending" })));
    } finally {
      sendingRef.current = false;
      if (mountedRef.current) setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><h2 className="font-black text-slate-900">Trao đổi lớp</h2><p className="mt-0.5 text-xs text-slate-500">{className ? `${className} · ` : ""}Giáo viên và học sinh trong lớp</p></div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{connected ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}{connected ? "Trực tuyến" : loading ? "Đang đồng bộ" : "Chưa kết nối"}</span>
      </header>
      {error ? <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {!connected && !loading ? <div className="px-4 pt-3"><Button variant="ghost" size="sm" onClick={() => retryRef.current()}>Kết nối lại</Button></div> : null}
      <div ref={listRef} className="h-[390px] space-y-3 overflow-y-auto bg-slate-50/60 p-4">
        {hasOlder ? <div className="text-center"><Button variant="ghost" size="sm" disabled={loadingOlder || loading || !connected} onClick={() => void loadOlder()}>{loadingOlder ? "Đang tải…" : "Xem tin nhắn cũ"}</Button></div> : null}
        {loading && !messages.length ? <div className="grid h-full place-items-center text-sm font-semibold text-slate-500"><span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Đang tải trò chuyện…</span></div> : null}
        {!loading && !messages.length ? <div className="grid h-full place-items-center text-center text-sm text-slate-500">Chưa có tin nhắn. Hãy bắt đầu trao đổi với lớp.</div> : null}
        {messages.map((message) => {
          const mine = message.sender.id === currentUser?.id;
          return <article key={message.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">{message.sender.fullName.trim().charAt(0).toUpperCase()}</span>
            <div className={`max-w-[82%] ${mine ? "items-end" : "items-start"}`}>
              <p className={`mb-1 text-xs font-bold text-slate-600 ${mine ? "text-right" : ""}`}>{message.sender.fullName}</p>
              <div className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm border border-slate-100 bg-white text-slate-800"}`}>
                {message.content ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : null}
                {message.attachments.length ? <div className={`${message.content ? "mt-2" : ""} space-y-1.5`}>{message.attachments.map((attachment) => <button key={attachment.id} type="button" onClick={() => void openAttachment(attachment)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold ${mine ? "bg-white/15 hover:bg-white/25" : "bg-slate-50 hover:bg-slate-100"}`}><span>{attachment.mimeType.startsWith("image/") ? <FileImage className="size-4" /> : <FileText className="size-4" />}</span><span className="min-w-0 flex-1 truncate">{attachment.originalName}</span><span className="shrink-0 opacity-75">{formatSize(attachment.size)}</span></button>)}</div> : null}
              </div>
              <p className={`mt-1 text-[11px] text-slate-400 ${mine ? "text-right" : ""}`}>{formatTime(message.createdAt)}</p>
            </div>
          </article>;
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-100 p-3">
        {files.length ? <div className="mb-2 flex flex-wrap gap-2">{files.map((item) => <span key={item.id} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-brand-700"><FileText className="size-3.5 shrink-0" /><span className="max-w-40 truncate">{item.file.name}</span>{item.status === "uploading" ? <LoaderCircle className="size-3.5 animate-spin" /> : <button type="button" disabled={sending || uncertain} onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))} aria-label={`Bỏ ${item.file.name}`}><X className="size-3.5" /></button>}</span>)}</div> : null}
        <div className="flex items-end gap-2">
          <label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-600"><Paperclip className="size-4" /><input type="file" disabled={sending || uncertain} multiple className="hidden" onChange={(event) => { pickFiles(event.target.files); event.currentTarget.value = ""; }} /></label>
          <textarea disabled={sending || uncertain} value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }} maxLength={2000} rows={2} placeholder="Nhập tin nhắn… (Enter để gửi, Shift + Enter xuống dòng)" className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-blue-100" />
          <Button className="h-10 shrink-0 !rounded-xl" aria-label="Gửi tin nhắn" disabled={!connected || sending || (!content.trim() && !files.length)} onClick={() => void sendMessage()}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}<span className="hidden sm:inline">{uncertain ? "Gửi lại" : "Gửi"}</span></Button>
        </div>
      </div>
    </section>
  );
}
