import { pgTable, text, integer, boolean, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { participantsTable, presentationsTable } from "./marrakech-presentations";

export const quizQuestionsTable = pgTable(
  "marrakech_quiz_questions",
  {
    id: text("id").primaryKey(),
    question: text("question").notNull(),
    questionType: text("question_type").notNull().default("multiple-choice"),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation").notNull().default(""),
    points: integer("points").notNull().default(100),
    category: text("category").notNull().default("Culture"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const quizRunsTable = pgTable(
  "marrakech_quiz_runs",
  {
    id: text("id").primaryKey(),
    sessionCode: text("session_code")
      .notNull()
      .references(() => presentationsTable.sessionCode, { onDelete: "cascade" }),
    status: text("status").notNull().default("live"),
    currentQuestionIndex: integer("current_question_index").notNull().default(0),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    timeLimitSeconds: integer("time_limit_seconds").notNull().default(0),
    deadline: timestamp("deadline", { withTimezone: true }),
    currentQuestionStartedAt: timestamp("current_question_started_at", { withTimezone: true }).notNull().defaultNow(),
    revealed: boolean("revealed").notNull().default(false),
    leaderboardRevealed: boolean("leaderboard_revealed").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("marrakech_quiz_runs_session_idx").on(table.sessionCode, table.startedAt)],
);

export const quizResponsesTable = pgTable(
  "marrakech_quiz_responses",
  {
    id: text("id").primaryKey(),
    quizRunId: text("quiz_run_id")
      .notNull()
      .references(() => quizRunsTable.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => quizQuestionsTable.id, { onDelete: "restrict" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    selectedAnswer: integer("selected_answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    responseTimeMs: integer("response_time_ms").notNull().default(0),
  },
  (table) => [
    uniqueIndex("marrakech_quiz_responses_once_idx").on(
      table.quizRunId,
      table.questionId,
      table.participantId,
    ),
    index("marrakech_quiz_responses_run_idx").on(table.quizRunId),
  ],
);
