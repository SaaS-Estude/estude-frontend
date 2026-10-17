import http from "node:http";
import httpProxy from "http-proxy";

// Local development only: keep tenant Host and cookies on the same origin.
const frontend = "http://127.0.0.1:3000";
const backend = "http://127.0.0.1:8090";
const port = 8091;
const portalHost =
  /^(admin|teacher|student|parent)\.[a-z][a-z0-9-]+\.localhost(?::\d{1,5})?$/i;
const proxy = httpProxy.createProxyServer({
  changeOrigin: false,
  ws: true,
  proxyTimeout: 150_000,
});

function prepare(request) {
  const host = request.headers.host;
  if (
    !host ||
    !portalHost.test(host) ||
    !request.url?.startsWith("/") ||
    request.url.startsWith("//")
  )
    return false;
  const pathname = request.url.split("?", 1)[0];
  if (pathname === "/api/platform/v1" || pathname.startsWith("/api/platform/v1/")) return false;
  // Never trust forwarded tenant identity supplied by a browser.
  delete request.headers["x-tenant-slug"];
  request.headers["x-forwarded-host"] = host;
  request.headers["x-forwarded-proto"] = "http";
  request.headers["x-forwarded-for"] = request.socket.remoteAddress;
  return true;
}

function target(request) {
  const pathname = request.url.split("?", 1)[0];
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/")
    ? backend
    : frontend;
}

proxy.on("error", (error, _request, output) => {
  if (output && "writeHead" in output) {
    if (!output.headersSent) {
      output.writeHead(502, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      output.end(
        "Không kết nối được Next.js (3000) hoặc Go API (8090). Kiểm tra terminal của dịch vụ.\n",
      );
    } else output.destroy(error);
  } else output?.destroy(error);
});

const server = http.createServer((request, response) => {
  if (!prepare(request)) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(
      "Dùng http://<portal>.<tenant>.localhost:8091\n",
    );
    return;
  }
  proxy.web(request, response, { target: target(request) });
});

server.on("upgrade", (request, socket, head) => {
  if (!prepare(request) || (target(request) !== frontend && request.url?.split("?", 1)[0] !== "/api/v1/class-chat/ws")) {
    socket.destroy();
    return;
  }
  proxy.ws(request, socket, head, { target: target(request) });
});

server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port 8091 đang được dùng. Dừng dev:saas/proxy cũ bằng Ctrl+C; nếu chạy Nginx Docker: cd ../estude-backend-go && docker compose --profile app --profile edge stop nginx"
      : error.message,
  );
  process.exitCode = 1;
  proxy.close();
});

server.listen(port, "127.0.0.1", () => {
  console.log(
    "SaaS local: http://admin.demo-school.localhost:8091 (teacher/student/parent dùng cùng port)",
  );
});

function shutdown() {
  server.close();
  proxy.close();
  server.closeAllConnections();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
