import { randomInt, randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, isNull, ne, sql } from "drizzle-orm";
import {
  ChangeSlideBody,
  ChangeSlideParams,
  ChangeSlideResponse,
  EndPresentationParams,
  EndPresentationResponse,
  GetAdminOverviewResponse,
  GetParticipantsParams,
  GetParticipantsResponse,
  GetSessionStateParams,
  GetSessionStateResponse,
  JoinSessionBody,
  JoinSessionParams,
  JoinSessionResponse,
  RemoveParticipantParams,
  SetSessionActivityBody,
  SetSessionActivityParams,
  SetSessionActivityResponse,
  StartPresentationResponse,
} from "@workspace/api-zod";
import {
  db,
  participantsTable,
  pollsTable,
  presentationsTable,
  quizQuestionsTable,
  quizResponsesTable,
  quizRunsTable,
  slidesTable,
} from "@workspace/db";
import { getParticipantRequest, hashToken, issueOpaqueToken, requireAdmin, setParticipantCookie } from "../lib/marrakech-auth";
import { disconnectParticipant, disconnectSessionSockets, emitSessionEvent } from "../lib/marrakech-realtime";

const router: IRouter = Router();

async function makeSessionState(session: typeof presentationsTable.$inferSelect) {
  const [participantCount] = await db
    .select({ value: count() })
    .from(participantsTable)
    .where(
      and(
        eq(participantsTable.sessionCode, session.sessionCode),
        eq(participantsTable.connected, true),
        isNull(participantsTable.removedAt),
      ),
    );
  const [slideCount] = await db.select({ value: count() }).from(slidesTable);
  return GetSessionStateResponse.parse({
    sessionCode: session.sessionCode,
    status: session.status,
    currentSlide: session.currentSlide,
    slideCount: Number(slideCount?.value ?? 0),
    participantCount: Number(participantCount?.value ?? 0),
    currentActivity: session.currentActivity,
  });
}

async function endSessionActivities(sessionCode: string) {
  const endedAt = new Date();
  await db
    .update(pollsTable)
    .set({ status: "closed", closedAt: endedAt })
    .where(and(eq(pollsTable.sessionCode, sessionCode), eq(pollsTable.status, "open")));
  await db
    .update(quizRunsTable)
    .set({ status: "ended", endedAt })
    .where(and(eq(quizRunsTable.sessionCode, sessionCode), eq(quizRunsTable.status, "live")));
}

router.get("/admin/session", requireAdmin, async (_req, res): Promise<void> => {
  const [liveSession] = await db
    .select()
    .from(presentationsTable)
    .where(eq(presentationsTable.status, "live"))
    .orderBy(desc(presentationsTable.createdAt))
    .limit(1);
  const [questionCount] = await db.select({ value: count() }).from(quizQuestionsTable);
  const [totalSessions] = await db.select({ value: count() }).from(presentationsTable);
  const activeSession = liveSession ? await makeSessionState(liveSession) : null;
  res.json(
    GetAdminOverviewResponse.parse({
      activeSession,
      questionCount: Number(questionCount?.value ?? 0),
      totalSessions: Number(totalSessions?.value ?? 0),
    }),
  );
});

router.post("/sessions", requireAdmin, async (_req, res): Promise<void> => {
  const previousSessions = await db
    .select()
    .from(presentationsTable)
    .where(eq(presentationsTable.status, "live"));
  await db
    .update(presentationsTable)
    .set({ status: "ended", endedAt: new Date(), currentActivity: null })
    .where(eq(presentationsTable.status, "live"));
  for (const previous of previousSessions) {
    await endSessionActivities(previous.sessionCode);
    emitSessionEvent(previous.sessionCode, "presentation:ended", await makeSessionState({ ...previous, status: "ended", currentActivity: null }));
    disconnectSessionSockets(previous.sessionCode);
  }

  let sessionCode = "";
  for (let attempt = 0; attempt < 25; attempt += 1) {
    sessionCode = `MARRAKECH-${randomInt(10000, 100000)}`;
    const [existing] = await db
      .select({ sessionCode: presentationsTable.sessionCode })
      .from(presentationsTable)
      .where(eq(presentationsTable.sessionCode, sessionCode))
      .limit(1);
    if (!existing) break;
    sessionCode = "";
  }
  if (!sessionCode) {
    res.status(503).json({ error: "Unable to generate a unique session code. Please try again." });
    return;
  }
  const [session] = await db
    .insert(presentationsTable)
    .values({ sessionCode, status: "live", currentSlide: 0, currentActivity: null })
    .returning();
  if (!session) {
    res.status(500).json({ error: "Unable to start the presentation." });
    return;
  }
  const state = await makeSessionState(session);
  emitSessionEvent(sessionCode, "presentation:started", state);
  res.status(201).json(StartPresentationResponse.parse(state));
});

router.get("/sessions/:sessionCode/state", async (req, res): Promise<void> => {
  const parsed = GetSessionStateParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(presentationsTable)
    .where(eq(presentationsTable.sessionCode, parsed.data.sessionCode.toUpperCase()))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Presentation session not found." });
    return;
  }
  res.json(GetSessionStateResponse.parse(await makeSessionState(session)));
});

router.post("/sessions/:sessionCode/join", async (req, res): Promise<void> => {
  const params = JoinSessionParams.safeParse(req.params);
  const body = JoinSessionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const nickname = body.data.nickname.trim();
  if (!nickname) {
    res.status(400).json({ error: "Enter a display name to join." });
    return;
  }
  const [session] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.sessionCode, sessionCode), eq(presentationsTable.status, "live")))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "That presentation is not active. Check the code and try again." });
    return;
  }

  const returningParticipant = await getParticipantRequest(req, sessionCode);
  const duplicateConditions = [
    eq(participantsTable.sessionCode, sessionCode),
    isNull(participantsTable.removedAt),
    sql`lower(${participantsTable.nickname}) = lower(${nickname})`,
  ];
  if (returningParticipant) duplicateConditions.push(ne(participantsTable.id, returningParticipant.id));
  const [duplicate] = await db
    .select({ id: participantsTable.id })
    .from(participantsTable)
    .where(and(...duplicateConditions))
    .limit(1);
  if (duplicate) {
    res.status(409).json({ error: "That display name is already in use in this room." });
    return;
  }

  const participant = returningParticipant
    ? (
        await db
          .update(participantsTable)
          .set({ nickname, lastSeenAt: new Date() })
          .where(eq(participantsTable.id, returningParticipant.id))
          .returning()
      )[0]
    : await (async () => {
        const token = issueOpaqueToken();
        const [created] = await db
          .insert(participantsTable)
          .values({
            id: randomUUID(),
            sessionCode,
            nickname,
            tokenHash: hashToken(token),
            connected: false,
            lastSeenAt: new Date(),
          })
          .returning();
        if (created) setParticipantCookie(res, token);
        return created;
      })();

  if (!participant) {
    res.status(500).json({ error: "Unable to join this presentation." });
    return;
  }
  const state = await makeSessionState(session);
  const [latestRun] = await db
    .select()
    .from(quizRunsTable)
    .where(eq(quizRunsTable.sessionCode, sessionCode))
    .orderBy(desc(quizRunsTable.startedAt))
    .limit(1);
  const previousResponses = latestRun
    ? await db.select().from(quizResponsesTable).where(eq(quizResponsesTable.quizRunId, latestRun.id))
    : [];
  const ownResponses = previousResponses.filter((response) => response.participantId === participant.id);
  res.json(
    JoinSessionResponse.parse({
      participant: {
        id: participant.id,
        nickname: participant.nickname,
        connected: participant.connected,
        joinedAt: participant.joinedAt,
        score: ownResponses.reduce((total, response) => total + response.pointsAwarded, 0),
        answeredCount: ownResponses.length,
      },
      state,
    }),
  );
});

router.patch("/sessions/:sessionCode/slide", requireAdmin, async (req, res): Promise<void> => {
  const params = ChangeSlideParams.safeParse(req.params);
  const body = ChangeSlideBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [slideCount] = await db.select({ value: count() }).from(slidesTable);
  const nextSlide = body.data.currentSlide;
  if (nextSlide >= Number(slideCount?.value ?? 0)) {
    res.status(400).json({ error: "That slide does not exist." });
    return;
  }
  const [session] = await db
    .update(presentationsTable)
    .set({ currentSlide: nextSlide })
    .where(and(eq(presentationsTable.sessionCode, sessionCode), eq(presentationsTable.status, "live")))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Live presentation session not found." });
    return;
  }
  const state = await makeSessionState(session);
  emitSessionEvent(sessionCode, "presentation:slide-changed", state);
  res.json(ChangeSlideResponse.parse(state));
});

router.post("/admin/sessions/:sessionCode/activity", requireAdmin, async (req, res): Promise<void> => {
  const params = SetSessionActivityParams.safeParse(req.params);
  const body = SetSessionActivityBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [session] = await db
    .update(presentationsTable)
    .set({ currentActivity: body.data.activity === "presentation" ? null : body.data.activity })
    .where(and(eq(presentationsTable.sessionCode, sessionCode), eq(presentationsTable.status, "live")))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Live presentation session not found." });
    return;
  }
  const state = await makeSessionState(session);
  emitSessionEvent(sessionCode, "presentation:activity-changed", state);
  res.json(SetSessionActivityResponse.parse(state));
});

router.post("/sessions/:sessionCode/end", requireAdmin, async (req, res): Promise<void> => {
  const params = EndPresentationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [session] = await db
    .update(presentationsTable)
    .set({ status: "ended", endedAt: new Date(), currentActivity: null })
    .where(and(eq(presentationsTable.sessionCode, sessionCode), eq(presentationsTable.status, "live")))
    .returning();
  if (!session) {
    res.status(404).json({ error: "Live presentation session not found." });
    return;
  }
  await endSessionActivities(sessionCode);
  const state = await makeSessionState(session);
  emitSessionEvent(sessionCode, "presentation:ended", state);
  disconnectSessionSockets(sessionCode);
  res.json(EndPresentationResponse.parse(state));
});

router.get("/admin/sessions/:sessionCode/participants", requireAdmin, async (req, res): Promise<void> => {
  const params = GetParticipantsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const participants = await db
    .select()
    .from(participantsTable)
    .where(and(eq(participantsTable.sessionCode, sessionCode), isNull(participantsTable.removedAt)))
    .orderBy(asc(participantsTable.joinedAt));
  const [run] = await db
    .select()
    .from(quizRunsTable)
    .where(eq(quizRunsTable.sessionCode, sessionCode))
    .orderBy(desc(quizRunsTable.startedAt))
    .limit(1);
  const responses = run
    ? await db.select().from(quizResponsesTable).where(eq(quizResponsesTable.quizRunId, run.id))
    : [];
  const byParticipant = new Map<string, { score: number; answeredCount: number }>();
  for (const response of responses) {
    const current = byParticipant.get(response.participantId) ?? { score: 0, answeredCount: 0 };
    current.score += response.pointsAwarded;
    current.answeredCount += 1;
    byParticipant.set(response.participantId, current);
  }
  res.json(
    GetParticipantsResponse.parse(
      participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname,
        connected: participant.connected,
        joinedAt: participant.joinedAt,
        score: byParticipant.get(participant.id)?.score ?? 0,
        answeredCount: byParticipant.get(participant.id)?.answeredCount ?? 0,
      })),
    ),
  );
});

router.delete("/admin/sessions/:sessionCode/participants/:participantId", requireAdmin, async (req, res): Promise<void> => {
  const params = RemoveParticipantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [participant] = await db
    .update(participantsTable)
    .set({ removedAt: new Date(), connected: false, tokenHash: hashToken(randomUUID()), lastSeenAt: new Date() })
    .where(and(eq(participantsTable.id, params.data.participantId), eq(participantsTable.sessionCode, sessionCode), isNull(participantsTable.removedAt)))
    .returning({ id: participantsTable.id });
  if (!participant) {
    res.status(404).json({ error: "Participant not found." });
    return;
  }
  disconnectParticipant(participant.id);
  res.sendStatus(204);
});

export default router;
