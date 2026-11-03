import { createHash } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { signedCookie } from "cookie-parser";
import { Server, type Socket } from "socket.io";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import {
  adminSessionsTable,
  db,
  participantsTable,
  presentationsTable,
  slidesTable,
} from "@workspace/db";
import { logger } from "./logger";
import { isAllowedMarrakechOrigin, isSameOriginRequest } from "./marrakech-cors";

type SessionEvent =
  | "presentation:started"
  | "presentation:slide-changed"
  | "presentation:activity-changed"
  | "presentation:ended"
  | "participant:joined"
  | "participant:left"
  | "audience:reaction"
  | "poll:opened"
  | "poll:vote"
  | "poll:results"
  | "knowledge-check:opened"
  | "word-cloud:updated"
  | "audience:question-submitted"
  | "quiz:started"
  | "quiz:question-changed"
  | "quiz:answer-submitted"
  | "quiz:question-locked"
  | "quiz:answer-revealed"
  | "quiz:results-updated"
  | "quiz:leaderboard-updated"
  | "quiz:ended";

let io: Server | null = null;
const participantSockets = new Map<string, Set<string>>();

function cookieFromHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const pair = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  try {
    const value = decodeURIComponent(pair.slice(name.length + 1));
    const secret = process.env.SESSION_SECRET;
    if (!secret) return null;
    const verified = signedCookie(value, secret);
    return typeof verified === "string" ? verified : null;
  } catch {
    return null;
  }
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getSessionCode(socket: Socket): string | null {
  const value = socket.handshake.auth?.sessionCode ?? socket.handshake.query.sessionCode;
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^MARRAKECH-\d{3,6}$/.test(code) ? code : null;
}

async function publicSnapshot(sessionCode: string) {
  const [session] = await db.select().from(presentationsTable).where(eq(presentationsTable.sessionCode, sessionCode)).limit(1);
  if (!session) return null;
  const [connected] = await db
    .select({ value: count() })
    .from(participantsTable)
    .where(and(eq(participantsTable.sessionCode, sessionCode), eq(participantsTable.connected, true), isNull(participantsTable.removedAt)));
  const [slideTotal] = await db.select({ value: count() }).from(slidesTable);
  return {
    sessionCode: session.sessionCode,
    status: session.status,
    currentSlide: session.currentSlide,
    slideCount: Number(slideTotal?.value ?? 0),
    participantCount: Number(connected?.value ?? 0),
    currentActivity: session.currentActivity,
  };
}

async function broadcastParticipantCount(sessionCode: string): Promise<void> {
  if (!io) return;
  const [connected] = await db
    .select({ value: count() })
    .from(participantsTable)
    .where(and(eq(participantsTable.sessionCode, sessionCode), eq(participantsTable.connected, true), isNull(participantsTable.removedAt)));
  io.to(sessionCode).emit("audience:count", { participantCount: Number(connected?.value ?? 0) });
}

export function attachMarrakechRealtime(server: HttpServer): Server {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "marrakech-dev-insecure-session-secret-min32"
      : undefined);
  if (!secret) throw new Error("SESSION_SECRET is required for live presentation connections");

  io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin(origin, callback) {
        callback(null, isAllowedMarrakechOrigin(origin) ? origin : false);
      },
      credentials: true,
    },
    allowRequest(request, callback) {
      const origin = request.headers.origin;
      const host =
        request.headers["x-forwarded-host"] ?? request.headers.host;
      const protocol = request.headers["x-forwarded-proto"] ?? "https";
      callback(
        null,
        isAllowedMarrakechOrigin(origin) ||
          isSameOriginRequest(origin, host, protocol),
      );
    },
    pingInterval: 20000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const sessionCode = getSessionCode(socket);
      if (!sessionCode) {
        next(new Error("A valid session code is required"));
        return;
      }
      const [session] = await db
        .select({ sessionCode: presentationsTable.sessionCode, status: presentationsTable.status })
        .from(presentationsTable)
        .where(eq(presentationsTable.sessionCode, sessionCode))
        .limit(1);
      if (!session || session.status !== "live") {
        next(new Error("This presentation is not active"));
        return;
      }

      const adminToken = cookieFromHeader(socket.handshake.headers.cookie, "marrakech_admin");
      const participantToken = cookieFromHeader(socket.handshake.headers.cookie, "marrakech_participant");
      let participantId: string | null = null;
      const isProjector = socket.handshake.auth?.role === "projector";
      let authorized = false;
      let isAdmin = false;
      if (!isProjector && adminToken) {
        const [adminSession] = await db
          .select({ id: adminSessionsTable.id })
          .from(adminSessionsTable)
          .where(and(eq(adminSessionsTable.tokenHash, tokenHash(adminToken)), gt(adminSessionsTable.expiresAt, new Date())))
          .limit(1);
        authorized = Boolean(adminSession);
        isAdmin = authorized;
      }
      if (!isProjector && !authorized && participantToken) {
        const [participant] = await db
          .select({ id: participantsTable.id })
          .from(participantsTable)
          .where(
            and(
              eq(participantsTable.sessionCode, sessionCode),
              eq(participantsTable.tokenHash, tokenHash(participantToken)),
              isNull(participantsTable.removedAt),
            ),
          )
          .limit(1);
        if (participant) {
          authorized = true;
          participantId = participant.id;
        }
      }
      if (!authorized) {
        if (isProjector) authorized = true;
      }
      if (!authorized) {
        next(new Error("Join the presentation before connecting"));
        return;
      }
      socket.data.sessionCode = sessionCode;
      socket.data.participantId = participantId;
      socket.data.isAdmin = isAdmin;
      socket.data.isProjector = isProjector;
      next();
    } catch (error) {
      logger.warn({ error }, "Marrakech socket authorization failed");
      next(new Error("Unable to authorize live connection"));
    }
  });

  io.on("connection", (socket) => {
    const sessionCode = socket.data.sessionCode as string;
    const participantId = socket.data.participantId as string | null;
    void socket.join(sessionCode);
    if (socket.data.isAdmin) void socket.join(`${sessionCode}:presenters`);

    if (participantId) {
      const sockets = participantSockets.get(participantId) ?? new Set<string>();
      sockets.add(socket.id);
      participantSockets.set(participantId, sockets);
      if (sockets.size === 1) {
        void db
          .update(participantsTable)
          .set({ connected: true, lastSeenAt: new Date() })
          .where(eq(participantsTable.id, participantId))
          .then(() => broadcastParticipantCount(sessionCode))
          .then(() => io?.to(sessionCode).emit("participant:joined", {}))
          .catch((error: unknown) => logger.warn({ error }, "Unable to update audience connection state"));
      }
    }

    void publicSnapshot(sessionCode).then((snapshot) => {
      if (snapshot) socket.emit("presentation:state", snapshot);
    });

    socket.on("disconnect", () => {
      if (!participantId) return;
      const sockets = participantSockets.get(participantId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size > 0) return;
      participantSockets.delete(participantId);
      void db
        .update(participantsTable)
        .set({ connected: false, lastSeenAt: new Date() })
        .where(eq(participantsTable.id, participantId))
        .then(() => broadcastParticipantCount(sessionCode))
        .then(() => io?.to(sessionCode).emit("participant:left", {}))
        .catch((error: unknown) => logger.warn({ error }, "Unable to update audience disconnect state"));
    });
  });

  return io;
}

export function emitSessionEvent(sessionCode: string, event: SessionEvent, payload: unknown): void {
  io?.to(sessionCode).emit(event, payload);
}

export function emitPresenterEvent(sessionCode: string, event: SessionEvent, payload: unknown): void {
  io?.to(`${sessionCode}:presenters`).emit(event, payload);
}

export function disconnectParticipant(participantId: string): void {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.participantId === participantId) socket.disconnect(true);
  }
}

export function disconnectSessionSockets(sessionCode: string): void {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.sessionCode === sessionCode) socket.disconnect(true);
  }
}

export async function closeRealtimeServer(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => io!.close(() => resolve()));
  io = null;
  participantSockets.clear();
}
