import http from "node:http";
import Redis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";
import { isHostAllowed, isOriginAllowed, parseList, parseTicket } from "./guards.js";

/**
 * The websocket relay: the backend publishes events on Redis, this process
 * forwards each one to the sockets allowed to see it. It never talks to the
 * backend or the database, so a burst of connections costs the API nothing.
 *
 * The contract lives in backend/src/realtime/realtime-events.ts:
 *  - realtime:everyone       every socket;
 *  - realtime:admins         sockets opened by an admin;
 *  - realtime:user:<userId>  that player's sockets;
 *  - realtime:control        orders for the relay (never forwarded);
 *  - realtime:ticket:<t>     a pending connection, written by the backend.
 */

const env = (name, fallback) => process.env[name] ?? fallback;
const integer = (name, fallback) => {
  const value = Number(env(name, String(fallback)));
  if (!Number.isInteger(value) || value < 1) {
    console.error(`${name} must be a positive integer`);
    process.exit(1);
  }
  return value;
};

const port = integer("PORT", 3006);
const redisUrl = env("REDIS_URL", "redis://localhost:6380");
const allowedHosts = parseList(env("ALLOWED_HOSTS", ""));
const allowedOrigins = parseList(
  env("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"),
);
const maxConnectionsPerUser = integer("MAX_CONNECTIONS_PER_USER", 10);
const heartbeatIntervalMs = integer("HEARTBEAT_INTERVAL_SECONDS", 30) * 1000;
/**
 * The ticket proved who the player was when the socket opened. Past this age the
 * socket is closed and the front asks the API for a new ticket, which checks
 * the account again: a change the backend did not announce (a deleted account,
 * an ADMINS edit) is caught within this delay.
 */
const maxSessionMs = integer("MAX_SESSION_MINUTES", 60) * 60_000;

const CHANNEL = {
  everyone: "realtime:everyone",
  admins: "realtime:admins",
  userPrefix: "realtime:user:",
  control: "realtime:control",
};
const TICKET_KEY_PREFIX = "realtime:ticket:";

/**
 * Close codes the fronts act on (4000-4999 is the application range): both
 * mean "reconnect with a fresh ticket", which is also what they do on any
 * other close.
 */
const CLOSE = {
  rightsChanged: 4000,
  sessionExpired: 4001,
};

// The password is passed as an option rather than inside the URL: a
// base64-generated password contains `/`, `+` and `=`, which make the URL invalid.
const redisOptions = { password: env("REDIS_PASSWORD", "") || undefined };
// A connection in subscriber mode cannot run commands: tickets get their own.
const subscriber = new Redis(redisUrl, redisOptions);
const commands = new Redis(redisUrl, redisOptions);

/** @type {Map<string, Set<WebSocket>>} */
const socketsByUser = new Map();

const track = (websocket) => {
  const sockets = socketsByUser.get(websocket.userId) ?? new Set();
  sockets.add(websocket);
  socketsByUser.set(websocket.userId, sockets);
};

const untrack = (websocket) => {
  const sockets = socketsByUser.get(websocket.userId);
  if (!sockets) return;
  sockets.delete(websocket);
  if (sockets.size === 0) socketsByUser.delete(websocket.userId);
};

const send = (websocket, message) => {
  if (websocket.readyState === WebSocket.OPEN) {
    websocket.send(message);
  }
};

const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    const ok = subscriber.status === "ready" && commands.status === "ready";
    response.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ status: ok ? "ok" : "redis-unavailable", sockets: wss.clients.size }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("websocket-relay\n");
});

const wss = new WebSocketServer({
  noServer: true,
  // The fronts only listen: anything they send is ignored, so there is no
  // reason to accept more than a ping's worth.
  maxPayload: 1024,
});

const rejectUpgrade = (socket, statusCode, message) => {
  socket.write(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

/**
 * Takes the ticket out of Redis: GETDEL makes it single-use even when two
 * upgrades race with the same one.
 */
const redeemTicket = async (ticket) => {
  if (!ticket || ticket.length > 128) return null;
  return parseTicket(await commands.getdel(`${TICKET_KEY_PREFIX}${ticket}`));
};

server.on("upgrade", (request, socket, head) => {
  if (!isHostAllowed(request.headers.host, allowedHosts)) {
    rejectUpgrade(socket, 403, "Forbidden");
    return;
  }

  const url = new URL(request.url ?? "/", "http://relay");
  if (url.pathname !== "/ws") {
    rejectUpgrade(socket, 404, "Not Found");
    return;
  }

  if (!isOriginAllowed(request.headers.origin, allowedOrigins)) {
    rejectUpgrade(socket, 403, "Forbidden");
    return;
  }

  // The ticket may sit in the URL: it is good for one connection and a few
  // seconds, so a copy in a proxy log is already spent.
  void redeemTicket(url.searchParams.get("ticket"))
    .then((session) => {
      if (!session) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }

      if ((socketsByUser.get(session.userId)?.size ?? 0) >= maxConnectionsPerUser) {
        rejectUpgrade(socket, 429, "Too Many Requests");
        return;
      }

      wss.handleUpgrade(request, socket, head, (websocket) => {
        websocket.userId = session.userId;
        websocket.admin = session.admin;
        wss.emit("connection", websocket);
      });
    })
    .catch((error) => {
      console.error("Ticket lookup failed", error.message);
      rejectUpgrade(socket, 503, "Service Unavailable");
    });
});

wss.on("connection", (websocket) => {
  websocket.isAlive = true;
  track(websocket);

  const expiry = setTimeout(
    () => websocket.close(CLOSE.sessionExpired, "Session expired"),
    maxSessionMs,
  );

  websocket.on("pong", () => {
    websocket.isAlive = true;
  });
  websocket.on("close", () => {
    clearTimeout(expiry);
    untrack(websocket);
  });
  websocket.on("error", () => websocket.terminate());
});

subscriber.on("message", (channel, message) => {
  if (channel === CHANNEL.everyone) {
    for (const websocket of wss.clients) send(websocket, message);
    return;
  }

  if (channel === CHANNEL.admins) {
    for (const websocket of wss.clients) {
      if (websocket.admin) send(websocket, message);
    }
    return;
  }

  if (channel === CHANNEL.control) {
    let order;
    try {
      order = JSON.parse(message);
    } catch {
      return;
    }
    if (order?.type === "disconnect" && typeof order.userId === "string") {
      for (const websocket of socketsByUser.get(order.userId) ?? []) {
        websocket.close(CLOSE.rightsChanged, "Rights changed");
      }
    }
  }
});

subscriber.on("pmessage", (_pattern, channel, message) => {
  const userId = channel.slice(CHANNEL.userPrefix.length);
  for (const websocket of socketsByUser.get(userId) ?? []) send(websocket, message);
});

/**
 * Pub/sub keeps nothing: what was published while the subscription was down is
 * gone. ioredis subscribes again on its own; the sockets are then told to
 * reload, as after a reconnection of their own.
 */
let subscribedOnce = false;
subscriber.on("ready", () => {
  if (subscribedOnce) {
    const resync = JSON.stringify({
      type: "realtime.resync",
      data: {},
      at: new Date().toISOString(),
    });
    for (const websocket of wss.clients) send(websocket, resync);
    console.log("Redis subscription restored, clients told to resync");
  }
  subscribedOnce = true;
});

for (const [name, connection] of [["subscriber", subscriber], ["commands", commands]]) {
  connection.on("error", (error) => console.error(`Redis ${name} error: ${error.message}`));
}

await subscriber.subscribe(CHANNEL.everyone, CHANNEL.admins, CHANNEL.control);
await subscriber.psubscribe(`${CHANNEL.userPrefix}*`);

const heartbeat = setInterval(() => {
  for (const websocket of wss.clients) {
    if (!websocket.isAlive) {
      websocket.terminate();
      continue;
    }

    websocket.isAlive = false;
    websocket.ping();
  }
}, heartbeatIntervalMs);

const shutdown = () => {
  clearInterval(heartbeat);
  for (const websocket of wss.clients) {
    websocket.close(1001, "Server shutdown");
  }
  wss.close();
  server.close();
  subscriber.disconnect();
  commands.disconnect();
};

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});
process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`websocket-relay listening on :${port}`);
});
