CREATE TABLE "marrakech_admin_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marrakech_admin_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "marrakech_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"session_code" text NOT NULL,
	"nickname" text NOT NULL,
	"token_hash" text NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	CONSTRAINT "marrakech_participants_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "marrakech_presentations" (
	"session_code" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"current_slide" integer DEFAULT 0 NOT NULL,
	"current_activity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marrakech_slides" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"presenter_notes" text DEFAULT '' NOT NULL,
	"order_index" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marrakech_slides_order_index_unique" UNIQUE("order_index")
);
--> statement-breakpoint
CREATE TABLE "marrakech_audience_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_code" text NOT NULL,
	"participant_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marrakech_poll_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"poll_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"option_index" integer NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marrakech_polls" (
	"id" text PRIMARY KEY NOT NULL,
	"session_code" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marrakech_quiz_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"question_type" text DEFAULT 'multiple-choice' NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"points" integer DEFAULT 100 NOT NULL,
	"category" text DEFAULT 'Culture' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marrakech_quiz_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"quiz_run_id" text NOT NULL,
	"question_id" text NOT NULL,
	"participant_id" text NOT NULL,
	"selected_answer" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"points_awarded" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_time_ms" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marrakech_quiz_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"session_code" text NOT NULL,
	"status" text DEFAULT 'live' NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"question_ids" jsonb NOT NULL,
	"time_limit_seconds" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"current_question_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revealed" boolean DEFAULT false NOT NULL,
	"leaderboard_revealed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "marrakech_participants" ADD CONSTRAINT "marrakech_participants_session_code_marrakech_presentations_session_code_fk" FOREIGN KEY ("session_code") REFERENCES "public"."marrakech_presentations"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_audience_submissions" ADD CONSTRAINT "marrakech_audience_submissions_session_code_marrakech_presentations_session_code_fk" FOREIGN KEY ("session_code") REFERENCES "public"."marrakech_presentations"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_audience_submissions" ADD CONSTRAINT "marrakech_audience_submissions_participant_id_marrakech_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."marrakech_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_poll_responses" ADD CONSTRAINT "marrakech_poll_responses_poll_id_marrakech_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."marrakech_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_poll_responses" ADD CONSTRAINT "marrakech_poll_responses_participant_id_marrakech_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."marrakech_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_polls" ADD CONSTRAINT "marrakech_polls_session_code_marrakech_presentations_session_code_fk" FOREIGN KEY ("session_code") REFERENCES "public"."marrakech_presentations"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_quiz_responses" ADD CONSTRAINT "marrakech_quiz_responses_quiz_run_id_marrakech_quiz_runs_id_fk" FOREIGN KEY ("quiz_run_id") REFERENCES "public"."marrakech_quiz_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_quiz_responses" ADD CONSTRAINT "marrakech_quiz_responses_question_id_marrakech_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."marrakech_quiz_questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_quiz_responses" ADD CONSTRAINT "marrakech_quiz_responses_participant_id_marrakech_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."marrakech_participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marrakech_quiz_runs" ADD CONSTRAINT "marrakech_quiz_runs_session_code_marrakech_presentations_session_code_fk" FOREIGN KEY ("session_code") REFERENCES "public"."marrakech_presentations"("session_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "marrakech_admin_sessions_expiry_idx" ON "marrakech_admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marrakech_participants_session_nickname_idx" ON "marrakech_participants" USING btree ("session_code",lower("nickname"));--> statement-breakpoint
CREATE INDEX "marrakech_participants_session_idx" ON "marrakech_participants" USING btree ("session_code");--> statement-breakpoint
CREATE INDEX "marrakech_submissions_session_idx" ON "marrakech_audience_submissions" USING btree ("session_code","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marrakech_poll_responses_once_idx" ON "marrakech_poll_responses" USING btree ("poll_id","participant_id");--> statement-breakpoint
CREATE INDEX "marrakech_poll_responses_poll_idx" ON "marrakech_poll_responses" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "marrakech_polls_session_idx" ON "marrakech_polls" USING btree ("session_code","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "marrakech_quiz_responses_once_idx" ON "marrakech_quiz_responses" USING btree ("quiz_run_id","question_id","participant_id");--> statement-breakpoint
CREATE INDEX "marrakech_quiz_responses_run_idx" ON "marrakech_quiz_responses" USING btree ("quiz_run_id");--> statement-breakpoint
CREATE INDEX "marrakech_quiz_runs_session_idx" ON "marrakech_quiz_runs" USING btree ("session_code","started_at");