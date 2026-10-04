
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = __dirname;
const clients = new Set();

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  try {
    let pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true, online: clients.size }));
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(publicDir, safePath);
    const data = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mime[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocketServer({ server });

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) client.send(message);
  }
}

function sendOnlineCount() {
  broadcast({ type: "presence", count: clients.size });
}

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "presence", count: clients.size }));
  sendOnlineCount();

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "chat" && typeof msg.text === "string") {
        const text = msg.text.trim().slice(0, 1000);
        if (!text) return;
        broadcast({
          type: "chat",
          id: crypto.randomUUID(),
          text,
          at: Date.now()
        });
      }
    } catch {}
  });

  ws.on("close", () => {
    clients.delete(ws);
    sendOnlineCount();
  });

  ws.on("error", () => {
    clients.delete(ws);
    sendOnlineCount();
  });
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`504 site: http://localhost:${PORT}`);
});
