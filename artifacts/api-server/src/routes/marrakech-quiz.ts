import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import {
  AdvanceQuizParams,
  AdvanceQuizResponse,
  CreateQuizQuestionBody,
  CreateQuizQuestionResponse,
  DeleteQuizQuestionParams,
  DeleteQuizQuestionResponse,
  EndQuizParams,
  EndQuizResponse,
  GetCurrentQuizParams,
  GetCurrentQuizResponse,
  GetQuizQuestionsResponse,
  GetQuizResultsParams,
  GetQuizResultsResponse,
  RevealQuizAnswerParams,
  RevealQuizAnswerResponse,
  StartQuizBody,
  StartQuizParams,
  StartQuizResponse,
  SubmitQuizAnswerBody,
  SubmitQuizAnswerParams,
  SubmitQuizAnswerResponse,
  UpdateQuizQuestionBody,
  UpdateQuizQuestionParams,
  UpdateQuizQuestionResponse,
} from "@workspace/api-zod";
import {
  db,
  participantsTable,
  presentationsTable,
  quizQuestionsTable,
  quizResponsesTable,
  quizRunsTable,
} from "@workspace/db";
import { getParticipantRequest, isAdminRequest, requireAdmin } from "../lib/marrakech-auth";
import { emitPresenterEvent, emitSessionEvent } from "../lib/marrakech-realtime";

const router: IRouter = Router();

async function latestRun(sessionCode: string) {
  const [run] = await db
    .select()
    .from(quizRunsTable)
    .where(eq(quizRunsTable.sessionCode, sessionCode))
    .orderBy(desc(quizRunsTable.startedAt))
    .limit(1);
  return run ?? null;
}

async function makeLeaderboard(runId: string, sessionCode: string) {
  const [responses, participants] = await Promise.all([
    db.select().from(quizResponsesTable).where(eq(quizResponsesTable.quizRunId, runId)),
    db
      .select({ id: participantsTable.id, nickname: participantsTable.nickname })
      .from(participantsTable)
      .where(and(eq(participantsTable.sessionCode, sessionCode), isNull(participantsTable.removedAt))),
  ]);
  const totals = new Map<string, { score: number; correctCount: number }>();
  for (const participant of participants) totals.set(participant.id, { score: 0, correctCount: 0 });
  for (const response of responses) {
    const result = totals.get(response.participantId);
    if (!result) continue;
    result.score += response.pointsAwarded;
    if (response.isCorrect) result.correctCount += 1;
  }
  return participants
    .map((participant) => ({
      nickname: participant.nickname,
      score: totals.get(participant.id)?.score ?? 0,
      correctCount: totals.get(participant.id)?.correctCount ?? 0,
    }))
    .sort((a, b) => b.score - a.score || b.correctCount - a.correctCount || a.nickname.localeCompare(b.nickname));
}

async function makeQuizState(
  run: typeof quizRunsTable.$inferSelect | null,
  participantId: string | null = null,
  includePrivateLeaderboard = false,
) {
  if (!run) {
    return GetCurrentQuizResponse.parse({
      status: "idle",
      currentQuestion: null,
      revealed: false,
      leaderboardRevealed: false,
      correctIndex: null,
      explanation: null,
      participantAnswer: null,
      serverNow: new Date(),
      leaderboard: [],
    });
  }
  const questionId = run.questionIds[run.currentQuestionIndex];
  const [question] = questionId
    ? await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.id, questionId)).limit(1)
    : [];
  const revealed = run.revealed;
  const leaderboard = run.leaderboardRevealed || includePrivateLeaderboard
    ? await makeLeaderboard(run.id, run.sessionCode)
    : [];
  const [participantResponse] = participantId && question
    ? await db
        .select({ answerIndex: quizResponsesTable.selectedAnswer, submittedAt: quizResponsesTable.submittedAt })
        .from(quizResponsesTable)
        .where(
          and(
            eq(quizResponsesTable.quizRunId, run.id),
            eq(quizResponsesTable.questionId, question.id),
            eq(quizResponsesTable.participantId, participantId),
          ),
        )
        .limit(1)
    : [];
  return GetCurrentQuizResponse.parse({
    status: run.status,
    currentQuestion: question
      ? {
          id: question.id,
          question: question.question,
          questionType: question.questionType,
          options: question.options,
          points: question.points,
          questionNumber: run.currentQuestionIndex + 1,
          totalQuestions: run.questionIds.length,
          deadline: run.deadline,
        }
      : null,
    revealed,
    leaderboardRevealed: run.leaderboardRevealed,
    correctIndex: revealed && question ? question.correctIndex : null,
    explanation: revealed && question ? question.explanation : null,
    participantAnswer: participantResponse
      ? { answerIndex: participantResponse.answerIndex, submittedAt: participantResponse.submittedAt }
      : null,
    serverNow: new Date(),
    leaderboard,
  });
}

async function emitQuizUpdate(sessionCode: string, event: Parameters<typeof emitSessionEvent>[1], run: typeof quizRunsTable.$inferSelect) {
  const [audienceState, presenterState] = await Promise.all([
    makeQuizState(run),
    makeQuizState(run, null, true),
  ]);
  emitSessionEvent(sessionCode, event, audienceState);
  emitPresenterEvent(sessionCode, event, presenterState);
  return presenterState;
}

function validateQuestionInput(input: { options: string[]; correctIndex: number; questionType?: string }): string | null {
  if (input.correctIndex >= input.options.length) return "The correct answer must match one of the listed options.";
  if (
    input.questionType === "true-false" &&
    (input.options.length !== 2 || input.options[0]?.toLowerCase() !== "true" || input.options[1]?.toLowerCase() !== "false")
  ) {
    return "True/false questions must use True and False as their two choices.";
  }
  return null;
}

router.get("/admin/quiz/questions", requireAdmin, async (_req, res): Promise<void> => {
  const questions = await db.select().from(quizQuestionsTable).orderBy(asc(quizQuestionsTable.createdAt));
  res.json(GetQuizQuestionsResponse.parse(questions));
});

router.post("/admin/quiz/questions", requireAdmin, async (req, res): Promise<void> => {
  const body = CreateQuizQuestionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const questionType = body.data.questionType ?? "multiple-choice";
  const invalid = validateQuestionInput({ ...body.data, questionType });
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const [question] = await db
    .insert(quizQuestionsTable)
    .values({ id: randomUUID(), ...body.data, questionType, category: "Culture" })
    .returning();
  if (!question) {
    res.status(500).json({ error: "Unable to save the quiz question." });
    return;
  }
  res.status(201).json(CreateQuizQuestionResponse.parse(question));
});

router.patch("/admin/quiz/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateQuizQuestionParams.safeParse(req.params);
  const body = UpdateQuizQuestionBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.id, params.data.questionId))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Quiz question not found." });
    return;
  }
  const questionType = body.data.questionType ?? existing.questionType;
  const invalid = validateQuestionInput({ ...body.data, questionType });
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }
  const [question] = await db
    .update(quizQuestionsTable)
    .set({ ...body.data, questionType, updatedAt: new Date() })
    .where(eq(quizQuestionsTable.id, params.data.questionId))
    .returning();
  if (!question) {
    res.status(404).json({ error: "Quiz question not found." });
    return;
  }
  res.json(UpdateQuizQuestionResponse.parse(question));
});

router.delete("/admin/quiz/questions/:questionId", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteQuizQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [question] = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.id, params.data.questionId))
    .limit(1);
  if (!question) {
    res.status(404).json({ error: "Quiz question not found." });
    return;
  }
  const [used] = await db
    .select({ value: count() })
    .from(quizResponsesTable)
    .where(eq(quizResponsesTable.questionId, question.id));
  const activeRuns = await db.select().from(quizRunsTable).where(eq(quizRunsTable.status, "live"));
  if (Number(used?.value ?? 0) > 0 || activeRuns.some((run) => run.questionIds.includes(question.id))) {
    res.status(409).json({ error: "This question is part of quiz history and cannot be deleted." });
    return;
  }
  await db.delete(quizQuestionsTable).where(eq(quizQuestionsTable.id, question.id));
  res.status(204).json(DeleteQuizQuestionResponse.parse(undefined));
});

router.post("/sessions/:sessionCode/quiz/start", requireAdmin, async (req, res): Promise<void> => {
  const params = StartQuizParams.safeParse(req.params);
  const body = StartQuizBody.safeParse(req.body);
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
  const questionIds = [...new Set(body.data.questionIds)];
  if (questionIds.length !== body.data.questionIds.length) {
    res.status(400).json({ error: "Choose each quiz question only once." });
    return;
  }
  const questions = await db.select().from(quizQuestionsTable);
  if (questionIds.some((id) => !questions.some((question) => question.id === id))) {
    res.status(400).json({ error: "One or more selected quiz questions no longer exist." });
    return;
  }
  await db
    .update(quizRunsTable)
    .set({ status: "ended", endedAt: new Date(), revealed: true })
    .where(and(eq(quizRunsTable.sessionCode, sessionCode), eq(quizRunsTable.status, "live")));
  const deadline = body.data.timeLimitSeconds
    ? new Date(Date.now() + body.data.timeLimitSeconds * 1000)
    : null;
  const [run] = await db
    .insert(quizRunsTable)
    .values({
      id: randomUUID(),
      sessionCode,
      status: "live",
      currentQuestionIndex: 0,
      questionIds,
      timeLimitSeconds: body.data.timeLimitSeconds,
      deadline,
      currentQuestionStartedAt: new Date(),
      revealed: false,
      leaderboardRevealed: false,
    })
    .returning();
  if (!run) {
    res.status(500).json({ error: "Unable to start the quiz." });
    return;
  }
  await db
    .update(presentationsTable)
    .set({ currentActivity: body.data.activity ?? "quiz" })
    .where(eq(presentationsTable.sessionCode, sessionCode));
  const state = await emitQuizUpdate(sessionCode, "quiz:started", run);
  res.json(StartQuizResponse.parse(state));
});

router.get("/sessions/:sessionCode/quiz/current", async (req, res): Promise<void> => {
  const params = GetCurrentQuizParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const [session] = await db
    .select({ status: presentationsTable.status })
    .from(presentationsTable)
    .where(eq(presentationsTable.sessionCode, sessionCode))
    .limit(1);
  if (!session || session.status !== "live") {
    res.status(404).json({ error: "Live presentation session not found." });
    return;
  }
  const run = await latestRun(sessionCode);
  res.json(
    GetCurrentQuizResponse.parse(
      await makeQuizState(run),
    ),
  );
});

router.post("/sessions/:sessionCode/quiz/answer", async (req, res): Promise<void> => {
  const params = SubmitQuizAnswerParams.safeParse(req.params);
  const body = SubmitQuizAnswerBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.error?.message ?? body.error?.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const participant = await getParticipantRequest(req, sessionCode);
  if (!participant) {
    res.status(401).json({ error: "Join this presentation before answering." });
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
    (session.currentActivity !== "quiz" &&
      session.currentActivity !== "knowledge-check")
  ) {
    res.json(SubmitQuizAnswerResponse.parse({ accepted: false, locked: true }));
    return;
  }
  const run = await latestRun(sessionCode);
  if (!run || run.status !== "live" || run.revealed) {
    res.json(SubmitQuizAnswerResponse.parse({ accepted: false, locked: true }));
    return;
  }
  const questionId = run.questionIds[run.currentQuestionIndex];
  if (questionId !== body.data.questionId || (run.deadline && run.deadline.getTime() <= Date.now())) {
    res.json(SubmitQuizAnswerResponse.parse({ accepted: false, locked: true }));
    return;
  }
  const [question] = await db
    .select()
    .from(quizQuestionsTable)
    .where(eq(quizQuestionsTable.id, questionId))
    .limit(1);
  if (!question || body.data.answerIndex >= question.options.length) {
    res.status(400).json({ error: "Choose one of the listed answers." });
    return;
  }
  const [response] = await db
    .insert(quizResponsesTable)
    .values({
      id: randomUUID(),
      quizRunId: run.id,
      questionId,
      participantId: participant.id,
      selectedAnswer: body.data.answerIndex,
      isCorrect: body.data.answerIndex === question.correctIndex,
      pointsAwarded: body.data.answerIndex === question.correctIndex ? question.points : 0,
      responseTimeMs: Math.max(0, Date.now() - run.currentQuestionStartedAt.getTime()),
    })
    .onConflictDoNothing()
    .returning({ id: quizResponsesTable.id });
  if (!response) {
    res.json(SubmitQuizAnswerResponse.parse({ accepted: false, locked: true }));
    return;
  }
  const [submittedCount] = await db
    .select({ value: count() })
    .from(quizResponsesTable)
    .where(and(eq(quizResponsesTable.quizRunId, run.id), eq(quizResponsesTable.questionId, questionId)));
  const payload = { questionId, submittedCount: Number(submittedCount?.value ?? 0) };
  emitSessionEvent(sessionCode, "quiz:answer-submitted", payload);
  emitPresenterEvent(sessionCode, "quiz:answer-submitted", payload);
  const state = await makeQuizState(run, null, true);
  if (state.leaderboardRevealed) {
    emitSessionEvent(sessionCode, "quiz:leaderboard-updated", state.leaderboard);
  }
  emitPresenterEvent(sessionCode, "quiz:leaderboard-updated", state.leaderboard);
  res.json(SubmitQuizAnswerResponse.parse({ accepted: true, locked: false }));
});

router.post("/admin/sessions/:sessionCode/quiz/next", requireAdmin, async (req, res): Promise<void> => {
  const params = AdvanceQuizParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const run = await latestRun(sessionCode);
  if (!run || run.status !== "live") {
    res.status(404).json({ error: "There is no live quiz to advance." });
    return;
  }
  const nextIndex = run.currentQuestionIndex + 1;
  const finished = nextIndex >= run.questionIds.length;
  const [updated] = await db
    .update(quizRunsTable)
    .set({
      currentQuestionIndex: finished ? run.currentQuestionIndex : nextIndex,
      status: finished ? "ended" : "live",
      endedAt: finished ? new Date() : null,
      deadline: finished || run.timeLimitSeconds === 0 ? null : new Date(Date.now() + run.timeLimitSeconds * 1000),
      currentQuestionStartedAt: finished ? run.currentQuestionStartedAt : new Date(),
      revealed: finished ? run.revealed : false,
    })
    .where(eq(quizRunsTable.id, run.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Unable to advance the quiz." });
    return;
  }
  const event = finished ? "quiz:ended" : "quiz:question-changed";
  const state = await emitQuizUpdate(sessionCode, event, updated);
  res.json(AdvanceQuizResponse.parse(state));
});

router.post("/admin/sessions/:sessionCode/quiz/reveal", requireAdmin, async (req, res): Promise<void> => {
  const params = RevealQuizAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const run = await latestRun(params.data.sessionCode.toUpperCase());
  if (!run || run.status !== "live") {
    res.status(404).json({ error: "There is no live quiz to reveal." });
    return;
  }
  const [updated] = await db
    .update(quizRunsTable)
    .set({ revealed: true })
    .where(eq(quizRunsTable.id, run.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Unable to reveal the answer." });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const state = await emitQuizUpdate(sessionCode, "quiz:answer-revealed", updated);
  res.json(RevealQuizAnswerResponse.parse(state));
});

router.post("/admin/sessions/:sessionCode/quiz/leaderboard/reveal", requireAdmin, async (req, res): Promise<void> => {
  const params = RevealQuizAnswerParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const run = await latestRun(sessionCode);
  if (!run || run.status !== "ended") {
    res.status(409).json({ error: "Finish the quiz before revealing its leaderboard." });
    return;
  }
  const [updated] = await db
    .update(quizRunsTable)
    .set({ leaderboardRevealed: true })
    .where(eq(quizRunsTable.id, run.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Unable to reveal the leaderboard." });
    return;
  }
  const state = await emitQuizUpdate(sessionCode, "quiz:leaderboard-updated", updated);
  res.json(AdvanceQuizResponse.parse(state));
});

router.post("/admin/sessions/:sessionCode/quiz/end", requireAdmin, async (req, res): Promise<void> => {
  const params = EndQuizParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const run = await latestRun(sessionCode);
  if (!run) {
    res.status(404).json({ error: "Quiz not found." });
    return;
  }
  const [updated] = await db
    .update(quizRunsTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(quizRunsTable.id, run.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Unable to end the quiz." });
    return;
  }
  const state = await emitQuizUpdate(sessionCode, "quiz:ended", updated);
  res.json(EndQuizResponse.parse(state));
});

router.get("/admin/sessions/:sessionCode/results", requireAdmin, async (req, res): Promise<void> => {
  const params = GetQuizResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sessionCode = params.data.sessionCode.toUpperCase();
  const run = await latestRun(sessionCode);
  const participantRows = await db
    .select()
    .from(participantsTable)
    .where(and(eq(participantsTable.sessionCode, sessionCode), isNull(participantsTable.removedAt)))
    .orderBy(asc(participantsTable.joinedAt));
  const connectedCount = participantRows.filter((participant) => participant.connected).length;
  if (!run) {
    res.json(
      GetQuizResultsResponse.parse({
        sessionCode,
        summary: {
          participantCount: participantRows.length,
          connectedCount,
          completedCount: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          accuracy: 0,
        },
        participants: participantRows.map((participant) => ({
          id: participant.id,
          nickname: participant.nickname,
          connected: participant.connected,
          score: 0,
          correctCount: 0,
          incorrectCount: 0,
          answeredCount: 0,
          completed: false,
          accuracy: 0,
          submittedAt: null,
          answers: [],
        })),
        questions: [],
      }),
    );
    return;
  }
  const responses = await db.select().from(quizResponsesTable).where(eq(quizResponsesTable.quizRunId, run.id));
  const responseMap = new Map<string, typeof responses>();
  for (const response of responses) {
    const current = responseMap.get(response.participantId) ?? [];
    current.push(response);
    responseMap.set(response.participantId, current);
  }
  const quizQuestions = (
    await Promise.all(
      run.questionIds.map(async (questionId) => {
        const [question] = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.id, questionId)).limit(1);
        return question;
      }),
    )
  ).filter((question): question is NonNullable<typeof question> => question !== undefined);
  const questionsById = new Map(quizQuestions.map((question) => [question.id, question]));
  const participantResults = participantRows.map((participant) => {
    const participantResponses = responseMap.get(participant.id) ?? [];
    const correctCount = participantResponses.filter((answer) => answer.isCorrect).length;
    const answers = participantResponses.flatMap((answer) => {
      const question = questionsById.get(answer.questionId);
      if (!question) return [];
      return [{
        questionId: question.id,
        question: question.question,
        selectedAnswer: answer.selectedAnswer,
        selectedOption: question.options[answer.selectedAnswer] ?? "Unknown option",
        correctIndex: question.correctIndex,
        isCorrect: answer.isCorrect,
        pointsAwarded: answer.pointsAwarded,
        responseTimeMs: answer.responseTimeMs,
        submittedAt: answer.submittedAt,
      }];
    }).sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    const submittedAt = participantResponses.reduce<Date | null>(
      (latest, answer) => (!latest || answer.submittedAt > latest ? answer.submittedAt : latest),
      null,
    );
    return {
      id: participant.id,
      nickname: participant.nickname,
      connected: participant.connected,
      score: participantResponses.reduce((total, answer) => total + answer.pointsAwarded, 0),
      correctCount,
      incorrectCount: participantResponses.length - correctCount,
      answeredCount: participantResponses.length,
      completed: participantResponses.length >= run.questionIds.length,
      accuracy: participantResponses.length ? (correctCount / participantResponses.length) * 100 : 0,
      submittedAt,
      answers,
    };
  });
  const scoreValues = participantResults.map((participant) => participant.score);
  const totalCorrect = responses.filter((response) => response.isCorrect).length;
  const questions = run.questionIds.flatMap((questionId) => {
    const question = questionsById.get(questionId);
    if (!question) return [];
    const answers = responses.filter((response) => response.questionId === questionId);
    const correctParticipantIds = new Set(answers.filter((answer) => answer.isCorrect).map((answer) => answer.participantId));
    const incorrectParticipantIds = new Set(answers.filter((answer) => !answer.isCorrect).map((answer) => answer.participantId));
    const answeredIds = new Set(answers.map((answer) => answer.participantId));
    return [{
      questionId: question.id,
      question: question.question,
      choices: question.options,
      correctIndex: question.correctIndex,
      correctCount: correctParticipantIds.size,
      incorrectCount: incorrectParticipantIds.size,
      answerCounts: question.options.map((option, index) => {
        const countForOption = answers.filter((answer) => answer.selectedAnswer === index).length;
        return {
          option,
          count: countForOption,
          percentage: answers.length ? (countForOption / answers.length) * 100 : 0,
        };
      }),
      correctParticipants: participantRows.filter((participant) => correctParticipantIds.has(participant.id)).map((participant) => participant.nickname),
      incorrectParticipants: participantRows.filter((participant) => incorrectParticipantIds.has(participant.id)).map((participant) => participant.nickname),
      unansweredParticipants: participantRows.filter((participant) => !answeredIds.has(participant.id)).map((participant) => participant.nickname),
    }];
  });
  const result = {
    sessionCode,
    summary: {
      participantCount: participantResults.length,
      connectedCount,
      completedCount: participantResults.filter((participant) => participant.completed).length,
      averageScore: participantResults.length ? scoreValues.reduce((sum, score) => sum + score, 0) / participantResults.length : 0,
      highestScore: scoreValues.length ? Math.max(...scoreValues) : 0,
      lowestScore: scoreValues.length ? Math.min(...scoreValues) : 0,
      accuracy: responses.length ? (totalCorrect / responses.length) * 100 : 0,
    },
    participants: participantResults.sort(
      (a, b) => b.score - a.score || b.correctCount - a.correctCount || a.nickname.localeCompare(b.nickname),
    ),
    questions: questions.filter((question): question is NonNullable<typeof question> => question !== null),
  };
  res.json(GetQuizResultsResponse.parse(result));
});

export default router;
