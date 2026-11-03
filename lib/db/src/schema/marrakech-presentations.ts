import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const presentationsTable = pgTable("marrakech_presentations", {
  sessionCode: text("session_code").primaryKey(),
  status: text("status").notNull().default("live"),
  currentSlide: integer("current_slide").notNull().default(0),
  currentActivity: text("current_activity"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const adminSessionsTable = pgTable(
  "marrakech_admin_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("marrakech_admin_sessions_expiry_idx").on(table.expiresAt)],
);

export const slidesTable = pgTable("marrakech_slides", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  content: text("content").notNull(),
  presenterNotes: text("presenter_notes").notNull().default(""),
  orderIndex: integer("order_index").notNull().unique(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participantsTable = pgTable(
  "marrakech_participants",
  {
    id: text("id").primaryKey(),
    sessionCode: text("session_code")
      .notNull()
      .references(() => presentationsTable.sessionCode, { onDelete: "cascade" }),
    nickname: text("nickname").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    connected: boolean("connected").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("marrakech_participants_session_nickname_idx").on(
      table.sessionCode,
      sql`lower(${table.nickname})`,
    ),
    index("marrakech_participants_session_idx").on(table.sessionCode),
  ],
);
