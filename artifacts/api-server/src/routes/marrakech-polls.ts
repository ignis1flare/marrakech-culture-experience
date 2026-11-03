import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import {
  ClosePollParams,
  ClosePollResponse,
  CreatePollBody,
  CreatePollParams,
  CreatePollResponse,
  GetActivePollParams,
  GetActivePollResponse,
  GetPollResultsParams,
  GetPollResultsResponse,
  SubmitPollVoteBody,
  SubmitPollVoteParams,
  SubmitPollVoteResponse,
} from "@workspace/api-zod";
import { db, pollResponsesTable, pollsTable, presentationsTable } from "@workspace/db";
import { getParticipantRequest, requireAdmin } from "../lib/marrakech-auth";
import { emitPresenterEvent, emitSessionEvent } from "../lib/marrakech-realtime";

const router: IRouter = Router();

async function pollResults(poll: typeof pollsTable.$inferSelect) {
  const [voteCount] = await db
    .select({ value: count() })
    .from(pollResponsesTable)
    .where(eq(pollResponsesTable.pollId, poll.id));
  const choices = poll.options.map((option, optionIndex) => ({ option, optionIndex, count: 0 }));
  const votes = await db.select().from(pollResponsesTable).where(eq(pollResponsesTable.pollId, poll.id));
  for (const vote of votes) {
    if (choices[vote.optionIndex]) choices[vote.optionIndex].count += 1;
  }
  const total = Number(voteCount?.value ?? 0);
  return GetPollResultsResponse.parse({
    id: poll.id,
    question: poll.question,
    options: poll.options,
    status: poll.status,
    voteCount: total,
    results: choices.map(({ option, count: optionCount }) => ({
      option,
      count: optionCount,
      percentage: total ? (optionCount / total) * 100 : 0,
    })),
  });
}

router.post("/admin/sessions/:sessionCode/polls", requireAdmin, async (req, res): Promise<void> => {
  const params = CreatePollParams.safeParse(req.params);
  const body = CreatePollBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [session] = await db
    .select()
    .from(presentationsTable)
    .where(and(eq(presentationsTable.sessionCode, sessionCode), eq(presentationsTable.status, "live")))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Live presentation session not found." });
    return;
  }
  await db
    .update(pollsTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(pollsTable.sessionCode, sessionCode), eq(pollsTable.status, "open")));
  const [poll] = await db
    .insert(pollsTable)
    .values({
      id: randomUUID(),
      sessionCode,
      question: body.data.question.trim(),
      options: body.data.options.map((option) => option.trim()),
      status: "open",
    })
    .returning();
  if (!poll) {
    res.status(500).json({ error: "Unable to open poll." });
    return;
  }
  await db.update(presentationsTable).set({ currentActivity: "poll" }).where(eq(presentationsTable.sessionCode, sessionCode));
  const result = CreatePollResponse.parse({ ...poll, voteCount: 0 });
  emitSessionEvent(sessionCode, "poll:opened", result);
  emitPresenterEvent(sessionCode, "poll:opened", result);
  res.status(201).json(result);
});

router.get("/sessions/:sessionCode/polls/active", async (req, res): Promise<void> => {
  const params = GetActivePollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(eq(pollsTable.sessionCode, sessionCode))
    .orderBy(desc(pollsTable.createdAt))
    .limit(1);
  if (!poll) {
    res.json(GetActivePollResponse.parse({ poll: null, myOptionIndex: null }));
    return;
  }
  const participant = await getParticipantRequest(req, sessionCode);
  const [myVote] = participant
    ? await db
        .select({ optionIndex: pollResponsesTable.optionIndex })
        .from(pollResponsesTable)
        .where(and(eq(pollResponsesTable.pollId, poll.id), eq(pollResponsesTable.participantId, participant.id)))
        .limit(1)
    : [];
  const [voteCount] = await db
    .select({ value: count() })
    .from(pollResponsesTable)
    .where(eq(pollResponsesTable.pollId, poll.id));
  const results = poll.status === "closed" ? await pollResults(poll) : undefined;
  res.json(
    GetActivePollResponse.parse({
      poll: { ...poll, voteCount: Number(voteCount?.value ?? 0) },
      myOptionIndex: myVote?.optionIndex ?? null,
      ...(results ? { results: results.results } : {}),
    }),
  );
});

router.post("/sessions/:sessionCode/polls/:pollId/vote", async (req, res): Promise<void> => {
  const params = SubmitPollVoteParams.safeParse(req.params);
  const body = SubmitPollVoteBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const participant = await getParticipantRequest(req, sessionCode);
  if (!participant) {
    res.status(401).json({ error: "Join this presentation before voting." });
    return;
  }
  const [session] = await db
    .select({
      status: presentationsTable.status,
      currentActivity: presentationsTable.currentActivity,
    })
    .from(presentationsTable)
    .where(eq(presentationsTable.sessionCode, sessionCode))
    .limit(1);
  if (
    session?.status !== "live" ||
    session.currentActivity !== "poll"
  ) {
    res.status(404).json({ error: "This poll is not accepting votes." });
    return;
  }
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(and(eq(pollsTable.id, params.data.pollId), eq(pollsTable.sessionCode, sessionCode), eq(pollsTable.status, "open")))
    .limit(1);
  if (!poll) {
    res.status(404).json({ error: "This poll is closed or unavailable." });
    return;
  }
  if (body.data.optionIndex >= poll.options.length) {
    res.status(400).json({ error: "Choose one of the listed options." });
    return;
  }
  const [vote] = await db
    .insert(pollResponsesTable)
    .values({ id: randomUUID(), pollId: poll.id, participantId: participant.id, optionIndex: body.data.optionIndex })
    .onConflictDoNothing()
    .returning({ id: pollResponsesTable.id });
  if (!vote) {
    res.status(409).json({ error: "Your vote has already been recorded." });
    return;
  }
  const [total] = await db
    .select({ value: count() })
    .from(pollResponsesTable)
    .where(eq(pollResponsesTable.pollId, poll.id));
  const payload = { pollId: poll.id, voteCount: Number(total?.value ?? 0) };
  emitSessionEvent(sessionCode, "poll:vote", payload);
  emitPresenterEvent(sessionCode, "poll:vote", payload);
  res.json(SubmitPollVoteResponse.parse({ accepted: true }));
});

router.post("/admin/sessions/:sessionCode/polls/:pollId/close", requireAdmin, async (req, res): Promise<void> => {
  const params = ClosePollParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [poll] = await db
    .update(pollsTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(pollsTable.id, params.data.pollId), eq(pollsTable.sessionCode, sessionCode)))
    .returning();
  if (!poll) {
    res.status(404).json({ error: "Poll not found." });
    return;
  }
  const results = await pollResults(poll);
  emitSessionEvent(sessionCode, "poll:results", results);
  emitPresenterEvent(sessionCode, "poll:results", results);
  res.json(ClosePollResponse.parse(results));
});

router.get("/admin/sessions/:sessionCode/polls/:pollId/results", requireAdmin, async (req, res): Promise<void> => {
  const params = GetPollResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [poll] = await db
    .select()
    .from(pollsTable)
    .where(and(eq(pollsTable.id, params.data.pollId), eq(pollsTable.sessionCode, params.data.sessionCode.toUpperCase())))
    .limit(1);
  if (!poll) {
    res.status(404).json({ error: "Poll not found." });
    return;
  }
  res.json(GetPollResultsResponse.parse(await pollResults(poll)));
});

export default router;
