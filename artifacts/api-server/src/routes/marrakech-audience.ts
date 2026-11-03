import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import {
  GetAudienceSubmissionsParams,
  GetAudienceSubmissionsResponse,
  GetWordCloudParams,
  GetWordCloudResponse,
  ModerateAudienceSubmissionBody,
  ModerateAudienceSubmissionParams,
  ModerateAudienceSubmissionResponse,
  SubmitAudienceContributionBody,
  SubmitAudienceContributionParams,
  SubmitAudienceContributionResponse,
} from "@workspace/api-zod";
import { audienceSubmissionsTable, db, participantsTable, presentationsTable } from "@workspace/db";
import { getParticipantRequest, requireAdmin } from "../lib/marrakech-auth";
import { emitPresenterEvent, emitSessionEvent } from "../lib/marrakech-realtime";

const router: IRouter = Router();
const allowedReactions = new Set(["applause", "curiosity", "wonder", "thanks"]);

router.post("/sessions/:sessionCode/submissions", async (req, res): Promise<void> => {
  const params = SubmitAudienceContributionParams.safeParse(req.params);
  const body = SubmitAudienceContributionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const participant = await getParticipantRequest(req, sessionCode);
  if (!participant) {
    res.status(401).json({ error: "Join this presentation to participate." });
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
  if (!session || session.status !== "live") {
    res.status(404).json({ error: "This presentation is no longer active." });
    return;
  }

  const kind = body.data.kind;
  if (kind === "word" && session.currentActivity !== "word-cloud") {
    res.status(409).json({ error: "The word cloud is not open right now." });
    return;
  }
  const limit = kind === "reaction" ? 12 : 5;
  const [recent] = await db
    .select({ value: count() })
    .from(audienceSubmissionsTable)
    .where(and(eq(audienceSubmissionsTable.participantId, participant.id), gte(audienceSubmissionsTable.createdAt, new Date(Date.now() - 60_000))));
  if (Number(recent?.value ?? 0) >= limit) {
    res.status(429).json({ error: "Please wait a moment before sending another contribution." });
    return;
  }

  const content = body.data.content.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!content) {
    res.status(400).json({ error: "Your contribution cannot be empty." });
    return;
  }
  if (kind === "word" && (!/^[\p{L}\p{N}\s'-]+$/u.test(content) || content.split(/\s+/).length > 2)) {
    res.status(400).json({ error: "Submit one or two words using letters or numbers." });
    return;
  }
  if (kind === "reaction" && !allowedReactions.has(content)) {
    res.status(400).json({ error: "Choose one of the available reactions." });
    return;
  }
  const status = kind === "question" ? "pending" : "approved";
  const [submission] = await db
    .insert(audienceSubmissionsTable)
    .values({ id: randomUUID(), sessionCode, participantId: participant.id, kind, content, status })
    .returning();
  if (!submission) {
    res.status(500).json({ error: "Unable to save your contribution." });
    return;
  }
  const result = SubmitAudienceContributionResponse.parse({
    id: submission.id,
    nickname: participant.nickname,
    kind: submission.kind,
    content: submission.content,
    status: submission.status,
    createdAt: submission.createdAt,
  });
  if (kind === "word") {
    emitSessionEvent(sessionCode, "word-cloud:updated", { id: result.id, word: result.content });
  } else if (kind === "reaction") {
    emitSessionEvent(sessionCode, "audience:reaction", { reaction: result.content });
  } else {
    const privateMessage = { ...result };
    emitPresenterEvent(sessionCode, "audience:question-submitted", privateMessage);
  }
  res.status(201).json(result);
});

router.get("/admin/sessions/:sessionCode/submissions", requireAdmin, async (req, res): Promise<void> => {
  const params = GetAudienceSubmissionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const rows = await db
    .select({ submission: audienceSubmissionsTable, nickname: participantsTable.nickname })
    .from(audienceSubmissionsTable)
    .innerJoin(participantsTable, eq(audienceSubmissionsTable.participantId, participantsTable.id))
    .where(eq(audienceSubmissionsTable.sessionCode, sessionCode))
    .orderBy(desc(audienceSubmissionsTable.createdAt));
  res.json(
    GetAudienceSubmissionsResponse.parse(
      rows.map(({ submission, nickname }) => ({
        id: submission.id,
        nickname,
        kind: submission.kind,
        content: submission.content,
        status: submission.status,
        createdAt: submission.createdAt,
      })),
    ),
  );
});

router.get("/sessions/:sessionCode/word-cloud", async (req, res): Promise<void> => {
  const params = GetWordCloudParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select({ word: audienceSubmissionsTable.content })
    .from(audienceSubmissionsTable)
    .where(
      and(
        eq(audienceSubmissionsTable.sessionCode, params.data.sessionCode.toUpperCase()),
        eq(audienceSubmissionsTable.kind, "word"),
        eq(audienceSubmissionsTable.status, "approved"),
      ),
    )
    .orderBy(desc(audienceSubmissionsTable.createdAt))
    .limit(100);
  const totals = new Map<string, { word: string; count: number }>();
  for (const row of rows) {
    const key = row.word.toLocaleLowerCase();
    const current = totals.get(key);
    if (current) current.count += 1;
    else totals.set(key, { word: row.word, count: 1 });
  }
  res.json(GetWordCloudResponse.parse([...totals.values()].sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))));
});

router.patch("/admin/sessions/:sessionCode/submissions/:submissionId", requireAdmin, async (req, res): Promise<void> => {
  const params = ModerateAudienceSubmissionParams.safeParse(req.params);
  const body = ModerateAudienceSubmissionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const [row] = await db
    .update(audienceSubmissionsTable)
    .set({ status: body.data.status })
    .where(and(eq(audienceSubmissionsTable.id, params.data.submissionId), eq(audienceSubmissionsTable.sessionCode, params.data.sessionCode.toUpperCase())))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Audience contribution not found." });
    return;
  }
  const [participant] = await db
    .select({ nickname: participantsTable.nickname })
    .from(participantsTable)
    .where(eq(participantsTable.id, row.participantId))
    .limit(1);
  const result = ModerateAudienceSubmissionResponse.parse({
    id: row.id,
    nickname: participant?.nickname ?? "Former participant",
    kind: row.kind,
    content: row.content,
    status: row.status,
    createdAt: row.createdAt,
  });
  emitPresenterEvent(params.data.sessionCode.toUpperCase(), "audience:question-submitted", result);
  res.json(result);
});

export default router;
