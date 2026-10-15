import http from "node:http";
import httpProxy from "http-proxy";

const target = "http://127.0.0.1:3000";
const rolePorts = [
  { port: 3001, role: "TEACHER" },
  { port: 3002, role: "STUDENT" },
  { port: 3003, role: "PARENT" },
];

const proxy = httpProxy.createProxyServer({
  target,
  ws: true,
  xfwd: true,
  changeOrigin: false,
});

proxy.on("error", (error, _request, output) => {
  if (output && "writeHead" in output && !output.headersSent) {
    output.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    output.end("Frontend đang khởi động, vui lòng tải lại sau vài giây.");
  } else if (output && "destroy" in output) {
    output.destroy(error);
  }
});

const servers = rolePorts.map(({ port, role }) => {
  const server = http.createServer((request, response) => {
    proxy.web(request, response);
  });

  server.on("upgrade", (request, socket, head) => {
    proxy.ws(request, socket, head);
  });

  server.listen(port, "0.0.0.0", () => {
    process.stdout.write(`[${role}] http://localhost:${port}\n`);
  });

  return server;
});

function shutdown() {
  for (const server of servers) server.close();
  proxy.close();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
