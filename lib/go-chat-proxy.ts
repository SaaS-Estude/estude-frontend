import { upgradeWebSocket } from "@vercel/functions";
import { WebSocket } from "ws";
import { GoProxyError, goProxyFailure, goProxyTarget } from "@/lib/go-api-proxy";

import { portalProxyHeaders } from "./portal-proxy-headers";

const maxPayload = 64 * 1024;
const maxBuffered = 2 * maxPayload;

function closeCode(code: number) {
  return code === 1000 || (code >= 1001 && code <= 1014 && ![1004, 1005, 1006].includes(code)) ||
    (code >= 3000 && code <= 4999) ? code : 1001;
}

// Vercel only transports frames. Go validates the token in the first frame,
// then rechecks the school, portal role, session and class permissions.
export async function forwardGoChat(request: Request): Promise<Response> {
  if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return goProxyFailure(426, "Kênh chat yêu cầu kết nối WebSocket.");
  }
  let target: ReturnType<typeof goProxyTarget>;
  try {
    target = goProxyTarget(request);
  } catch (error) {
    return error instanceof GoProxyError
      ? goProxyFailure(error.status, error.message)
      : goProxyFailure(400, "Yêu cầu không hợp lệ.");
  }
  const { host, upstream } = target;
  const origin = request.headers.get("origin");
  if (
    origin !== `https://${host}` &&
    !(process.env.NODE_ENV !== "production" && origin === `http://${host}`)
  ) return goProxyFailure(403, "Origin không hợp lệ cho cổng trường.");
  if (upstream.pathname !== "/api/v1/class-chat/ws" || upstream.search) {
    return goProxyFailure(400, "Đường dẫn chat không hợp lệ.");
  }
  let routing: Record<string, string>;
  try { routing = portalProxyHeaders(request, upstream, host); }
  catch { return goProxyFailure(503, "Chưa cấu hình PORTAL_PROXY_SECRET cho proxy API."); }
  const secure = upstream.protocol === "https:";
  const servername = upstream.hostname;
  upstream.protocol = secure ? "wss:" : "ws:";
  const backend = new WebSocket(upstream, {
    headers: { ...routing, origin: origin! },
    ...(secure ? { servername } : {}),
    handshakeTimeout: 8000,
    maxPayload,
    perMessageDeflate: false,
    followRedirects: false,
  });
  const abort = () => backend.terminate();
  request.signal.addEventListener("abort", abort, { once: true });
  let status = 502;
  const opened = await new Promise<boolean>((resolve) => {
    backend.once("open", () => resolve(true));
    backend.on("error", () => resolve(false));
    backend.once("close", () => resolve(false));
    backend.once("unexpected-response", (_outgoing, response) => {
      if ([401, 403, 404, 429, 503].includes(response.statusCode ?? 0)) status = response.statusCode!;
      response.resume();
      backend.terminate();
      resolve(false);
    });
    if (request.signal.aborted) abort();
  });
  request.signal.removeEventListener("abort", abort);
  if (!opened) return goProxyFailure(status, "Không kết nối được kênh chat của trường.");
  try {
    return await upgradeWebSocket((client) => new Promise<void>((resolve) => {
      let finished = false;
      const finish = (code = 1001) => {
        if (finished) return;
        finished = true;
        clearTimeout(lifetime);
        for (const socket of [client, backend]) {
          if (socket.readyState === WebSocket.OPEN) socket.close(closeCode(code));
        }
        resolve();
      };
      const lifetime = setTimeout(() => finish(1001), 170_000);
      const relay = (source: WebSocket, destination: WebSocket) => {
        source.on("message", (data, binary) => {
          if (destination.readyState !== WebSocket.OPEN) return finish(1011);
          if (destination.bufferedAmount > maxBuffered) return finish(1013);
          destination.send(data, { binary }, (error) => { if (error) finish(1011); });
        });
        source.on("error", () => finish(1011));
        source.once("close", (code) => finish(code));
      };
      relay(client, backend);
      relay(backend, client);
      if (backend.readyState !== WebSocket.OPEN) finish(1011);
    }), { maxPayload });
  } catch {
    return goProxyFailure(503, "Môi trường triển khai chưa hỗ trợ WebSocket. Kiểm tra Fluid Compute trên Vercel.");
  } finally {
    // Also close a connection if the platform rejected the upgrade.
    backend.terminate();
  }
}
