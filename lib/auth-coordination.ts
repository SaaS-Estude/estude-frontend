// Web Locks serialize cookie rotation across tabs on the same origin. Cookies
// are read by the browser when fetch runs inside the lock, never captured here.
// No access/refresh token is written to localStorage or broadcast to other tabs.
export async function withAuthLock<T>(scope: string, action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`estude:auth:${scope}`, action);
  }
  if (typeof window !== "undefined") {
    throw new Error("Trình duyệt cần hỗ trợ Web Locks và kết nối HTTPS để đăng nhập.");
  }
  return action();
}

export function watchAuthLogout(scope: string, onLogout: () => void): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(`estude:auth:${scope}`);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (event.data === "logout") onLogout();
  };
  return () => channel.close();
}

export function publishAuthLogout(scope: string): void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(`estude:auth:${scope}`);
  channel.postMessage("logout");
  channel.close();
}
