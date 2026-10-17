export interface ChatSocket {
  readonly connected: boolean;
  readonly volatile: ChatSocket;
  timeout(ms: number): ChatSocket;
  on<T>(event: string, callback: (value: T) => void): ChatSocket;
  emit<T>(event: string, payload: unknown, ack?: (error: Error | null, result: T) => void): ChatSocket;
  removeAllListeners(): ChatSocket;
  connect(): ChatSocket;
  disconnect(): ChatSocket;
}

type Auth = (callback: (value: { token: string }) => void) => void;
type Listener = (value?: unknown) => void;
type Ack = (error: Error | null, result?: unknown) => void;

// Chat transport supports acknowledged commands, live delivery and reconnect.
// The Go wire protocol is JSON WebSocket; credentials only travel in the first frame.
export function createGoChatSocket(auth: Auth): ChatSocket {
  let ws: WebSocket | undefined;
  let stopped = true;
  let generation = 0;
  let connected = false;
  let wait = 15_000;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const listeners = new Map<string, Set<Listener>>();
  const pending = new Map<string, { ack: Ack; timer: ReturnType<typeof setTimeout> }>();
  const dispatch = (event: string, value?: unknown) => listeners.get(event)?.forEach((fn) => fn(value));
  const settle = () => {
    for (const { ack, timer } of pending.values()) { clearTimeout(timer); ack(new Error("Kết nối bị gián đoạn")); }
    pending.clear();
  };
  const socket = {
    get connected() { return connected; },
    get volatile() { return socket; },
    timeout(ms: number) { wait = ms; return socket; },
    on(event: string, callback: Listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return socket;
    },
    removeAllListeners() { listeners.clear(); return socket; },
    emit(event: string, payload: unknown, ack?: Ack) {
      if (!connected || ws?.readyState !== WebSocket.OPEN) { ack?.(new Error("Kênh chat đang mất kết nối")); return socket; }
      const id = crypto.randomUUID();
      if (ack) pending.set(id, { ack, timer: setTimeout(() => {
        pending.delete(id); ack(new Error("Chưa nhận được xác nhận từ máy chủ"));
      }, wait) });
      ws.send(JSON.stringify({ id, event, payload }));
      return socket;
    },
    connect() {
      if (connected || (ws && ws.readyState <= WebSocket.OPEN)) return socket;
      stopped = false;
      clearTimeout(retry);
      const version = ++generation;
      auth(({ token }) => {
        if (stopped || version !== generation) return;
        const endpoint = new URL(`${(process.env.NEXT_PUBLIC_API_URL ?? "/api/v1").replace(/\/$/, "")}/class-chat/ws`, window.location.href);
        endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
        const current = new WebSocket(endpoint);
        ws = current;
        current.onopen = () => { if (version === generation) current.send(JSON.stringify({ event: "auth", token })); };
        current.onmessage = ({ data }) => {
          if (version !== generation) return;
          let frame: { event: string; id?: string; payload?: unknown };
          try { frame = JSON.parse(String(data)); } catch { current.close(); return; }
          if (frame.event === "connect") {
            connected = true; attempts = 0;
            clearInterval(heartbeat);
            heartbeat = setInterval(() => socket.emit("ping", {}), 25_000);
            dispatch("connect");
          } else if (frame.event === "ack" && frame.id) {
            const request = pending.get(frame.id);
            if (request) { pending.delete(frame.id); clearTimeout(request.timer); request.ack(null, frame.payload); }
          } else if (frame.event === "connect_error") {
            const payload = frame.payload as { message?: string; code?: string };
            dispatch("connect_error", Object.assign(new Error(payload.message), { data: payload }));
          } else dispatch(frame.event, frame.payload);
        };
        current.onerror = () => { if (version === generation && !connected) dispatch("connect_error", new Error("Không thể kết nối trò chuyện")); };
        current.onclose = () => {
          if (version !== generation) return;
          connected = false; ws = undefined; clearInterval(heartbeat); settle(); dispatch("disconnect", "transport close");
          if (!stopped) retry = setTimeout(() => socket.connect(), Math.min(10_000, 500 * 2 ** attempts++));
        };
      });
      return socket;
    },
    disconnect() {
      stopped = true; ++generation; clearTimeout(retry); clearInterval(heartbeat);
      const wasConnected = connected; connected = false;
      ws?.close(); ws = undefined; settle();
      if (wasConnected) dispatch("disconnect", "io client disconnect");
      return socket;
    },
  };
  return socket as unknown as ChatSocket;
}
