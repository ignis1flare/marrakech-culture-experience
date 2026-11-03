import { pgTable, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { participantsTable, presentationsTable } from "./marrakech-presentations";

export const pollsTable = pgTable(
  "marrakech_polls",
  {
    id: text("id").primaryKey(),
    sessionCode: text("session_code")
      .notNull()
      .references(() => presentationsTable.sessionCode, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [index("marrakech_polls_session_idx").on(table.sessionCode, table.createdAt)],
);

export const pollResponsesTable = pgTable(
  "marrakech_poll_responses",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => pollsTable.id, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    optionIndex: integer("option_index").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("marrakech_poll_responses_once_idx").on(table.pollId, table.participantId),
    index("marrakech_poll_responses_poll_idx").on(table.pollId),
  ],
);

export const audienceSubmissionsTable = pgTable(
  "marrakech_audience_submissions",
  {
    id: text("id").primaryKey(),
    sessionCode: text("session_code")
      .notNull()
      .references(() => presentationsTable.sessionCode, { onDelete: "cascade" }),
    participantId: text("participant_id")
      .notNull()
      .references(() => participantsTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("marrakech_submissions_session_idx").on(table.sessionCode, table.createdAt)],
);
