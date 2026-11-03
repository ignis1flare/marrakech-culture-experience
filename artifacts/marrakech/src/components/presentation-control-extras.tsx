import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  getGetActivePollQueryKey,
  getGetAdminSlidesQueryKey,
  getGetAudienceSubmissionsQueryKey,
  getGetCurrentQuizQueryKey,
  getGetQuizQuestionsQueryKey,
  getGetSessionStateQueryKey,
  useClosePoll,
  useChangeSlide,
  useEndQuiz,
  useGetActivePoll,
  useGetAdminSlides,
  useGetAudienceSubmissions,
  useGetCurrentQuiz,
  useGetQuizQuestions,
  useGetSessionState,
  useModerateAudienceSubmission,
  useSetSessionActivity,
  useStartQuiz,
  useUpdateSlide,
} from "@workspace/api-client-react";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import "./presentation-control-extras.css";

const activityNames: Record<string, string> = {
  poll: "Room poll",
  "word-cloud": "Word cloud",
  "word-cloud-closed": "Word cloud results",
  quiz: "Quiz",
  "knowledge-check": "Knowledge check",
  "audience-questions": "Audience questions",
  "audience-questions-closed": "Audience questions",
};

export function PresentationControlExtras({ code }: { code: string }) {
  const queryClient = useQueryClient();
  const session = useGetSessionState(code, {
    query: {
      enabled: Boolean(code),
      queryKey: getGetSessionStateQueryKey(code),
      refetchInterval: 5000,
    },
  });
  const slides = useGetAdminSlides({
    query: {
      enabled: Boolean(code),
      queryKey: getGetAdminSlidesQueryKey(),
    },
  });
  const submissions = useGetAudienceSubmissions(code, {
    query: {
      enabled: Boolean(code),
      queryKey: getGetAudienceSubmissionsQueryKey(code),
      refetchInterval: 7000,
    },
  });
  const activePoll = useGetActivePoll(code, {
    query: {
      enabled: Boolean(code),
      queryKey: getGetActivePollQueryKey(code),
      refetchInterval: 5000,
    },
  });
  const quiz = useGetCurrentQuiz(code, {
    query: {
      enabled: Boolean(code),
      queryKey: getGetCurrentQuizQueryKey(code),
      refetchInterval: 4000,
    },
  });
  const questions = useGetQuizQuestions({
    query: { queryKey: getGetQuizQuestionsQueryKey() },
  });
  const changeSlide = useChangeSlide();
  const setActivity = useSetSessionActivity();
  const updateSlide = useUpdateSlide();
  const moderate = useModerateAudienceSubmission();
  const closePoll = useClosePoll();
  const endQuiz = useEndQuiz();
  const startKnowledgeCheckMutation = useStartQuiz();
  const slideIndex = session.data?.currentSlide ?? 0;
  const currentSlide = slides.data?.[slideIndex];
  const currentActivity = session.data?.currentActivity ?? null;
  const [notes, setNotes] = useState("");
  const [knowledgeQuestionId, setKnowledgeQuestionId] = useState("");
  const [knowledgeSeconds, setKnowledgeSeconds] = useState(30);

  useEffect(() => {
    setNotes(currentSlide?.notes ?? "");
  }, [currentSlide?.id, currentSlide?.notes]);

  useEffect(() => {
    if (!knowledgeQuestionId && questions.data?.[0]) {
      setKnowledgeQuestionId(questions.data[0].id);
    }
  }, [knowledgeQuestionId, questions.data]);

  const refreshSession = () =>
    void queryClient.invalidateQueries({
      queryKey: getGetSessionStateQueryKey(code),
    });
  const move = (nextIndex: number) => {
    const bounded = Math.max(
      0,
      Math.min(nextIndex, Math.max(0, (session.data?.slideCount ?? 1) - 1)),
    );
    changeSlide.mutate(
      { sessionCode: code, data: { currentSlide: bounded } },
      { onSuccess: refreshSession },
    );
  };

  useEffect(() => {
    if (!code || !session.data || session.data.status !== "live") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        target?.isContentEditable ||
        target?.closest("input, textarea, select, [role='textbox']")
      ) {
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.code === "Space") {
        event.preventDefault();
        move(slideIndex + 1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        move(slideIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [code, session.data?.status, session.data?.slideCount, slideIndex]);

  const projectorHref = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/present?session=${encodeURIComponent(code)}`;
  const poll = activePoll.data?.poll;
  const quizIsLive = quiz.data?.status === "live";
  const canReturn =
    Boolean(currentActivity) &&
    currentActivity !== "poll" &&
    !quizIsLive &&
    currentActivity !== "word-cloud" &&
    currentActivity !== "audience-questions";

  const chooseActivity = (activity: "word-cloud" | "audience-questions") => {
    setActivity.mutate(
      { sessionCode: code, data: { activity } },
      { onSuccess: refreshSession },
    );
  };

  const closeCurrentActivity = () => {
    if (currentActivity === "poll" && poll?.status === "open") {
      closePoll.mutate(
        { sessionCode: code, pollId: poll.id },
        {
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: getGetActivePollQueryKey(code),
            });
            refreshSession();
          },
        },
      );
      return;
    }
    if (
      (currentActivity === "quiz" || currentActivity === "knowledge-check") &&
      quizIsLive
    ) {
      endQuiz.mutate(
        { sessionCode: code },
        { onSuccess: refreshSession },
      );
      return;
    }
    if (currentActivity === "word-cloud") {
      setActivity.mutate(
        { sessionCode: code, data: { activity: "word-cloud-closed" } },
        { onSuccess: refreshSession },
      );
      return;
    }
    if (currentActivity === "audience-questions") {
      setActivity.mutate(
        {
          sessionCode: code,
          data: { activity: "audience-questions-closed" },
        },
        { onSuccess: refreshSession },
      );
    }
  };

  const returnToPresentation = () =>
    setActivity.mutate(
      { sessionCode: code, data: { activity: "presentation" } },
      { onSuccess: refreshSession },
    );

  const startKnowledgeCheck = () => {
    if (!knowledgeQuestionId) return;
    startKnowledgeCheckMutation.mutate(
      {
        sessionCode: code,
        data: {
          questionIds: [knowledgeQuestionId],
          timeLimitSeconds: knowledgeSeconds,
          activity: "knowledge-check",
        },
      },
      { onSuccess: refreshSession },
    );
  };

  const questionsForPresenter =
    submissions.data
      ?.filter(
        (item) =>
          item.kind === "question" &&
          item.status !== "hidden" &&
          item.status !== "answered",
      )
      .slice(0, 5) ?? [];

  const setQuestionStatus = (
    submissionId: string,
    status: "approved" | "answered" | "hidden",
  ) =>
    moderate.mutate(
      { sessionCode: code, submissionId, data: { status } },
      {
        onSuccess: () =>
          void queryClient.invalidateQueries({
            queryKey: getGetAudienceSubmissionsQueryKey(code),
          }),
      },
    );

  if (!code) return null;

  return (
    <section className="presentation-extras" aria-label="Live session tools">
      <div className="presentation-extras__heading">
        <div>
          <p className="eyebrow">PRESENTER TOOLS</p>
          <h2 className="serif">Keep the room in sync.</h2>
        </div>
        <a
          className="btn btn-outline presentation-projector-link"
          href={projectorHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="link-open-projector"
        >
          Open projector <ArrowUpRight size={15} />
        </a>
      </div>

      <div className="presentation-extras__grid">
        <section className="presentation-tool-card presentation-notes">
          <div className="presentation-tool-card__heading">
            <div>
              <p className="eyebrow">PRIVATE TO YOU</p>
              <h3 className="serif">Speaker notes</h3>
            </div>
            <span className="private-tag">Not on screen</span>
          </div>
          <p className="presentation-notes__chapter">
            Chapter {slideIndex + 1}: {currentSlide?.title ?? "Loading chapter"}
          </p>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={5000}
            placeholder="Add private prompts, context, or reminders for this chapter."
            aria-label="Private speaker notes for the current chapter"
            data-testid="input-presenter-notes"
          />
          <div className="presentation-tool-card__footer">
            <span>{notes.length}/5000 characters</span>
            <button
              className="btn btn-outline"
              type="button"
              disabled={
                !currentSlide ||
                notes === (currentSlide.notes ?? "") ||
                updateSlide.isPending
              }
              onClick={() => {
                if (!currentSlide) return;
                updateSlide.mutate(
                  {
                    slideId: currentSlide.id,
                    data: { notes },
                  },
                  {
                    onSuccess: () =>
                      void queryClient.invalidateQueries({
                        queryKey: getGetAdminSlidesQueryKey(),
                      }),
                  },
                );
              }}
              data-testid="button-save-presenter-notes"
            >
              <Save size={15} />
              {updateSlide.isPending ? "Saving…" : "Save notes"}
            </button>
          </div>
          {updateSlide.isError && (
            <p className="error-text" role="alert">
              Notes could not be saved. Please try again.
            </p>
          )}
        </section>

        <section className="presentation-tool-card">
          <div className="presentation-tool-card__heading">
            <div>
              <p className="eyebrow">LIVE ACTIVITY</p>
              <h3 className="serif">Choose the next beat.</h3>
            </div>
            <span className="activity-state" data-testid="text-activity-status">
              {currentActivity
                ? `${activityNames[currentActivity] ?? currentActivity} · ${
                    currentActivity.endsWith("-closed") ||
                    poll?.status === "closed" ||
                    quiz.data?.status === "ended"
                      ? "results"
                      : "open"
                  }`
                : "Presentation"}
            </span>
          </div>
          <div className="activity-control-grid">
            <button
              type="button"
              onClick={() => chooseActivity("word-cloud")}
              disabled={setActivity.isPending || currentActivity === "word-cloud"}
              data-testid="button-open-word-cloud"
            >
              Word cloud
              {currentActivity === "word-cloud" && <Check size={15} />}
            </button>
            <button
              type="button"
              onClick={() => chooseActivity("audience-questions")}
              disabled={
                setActivity.isPending ||
                currentActivity === "audience-questions"
              }
              data-testid="button-open-audience-questions"
            >
              Audience questions
              {currentActivity === "audience-questions" && <Check size={15} />}
            </button>
            <Link href="/admin/quiz" data-testid="link-quiz-studio">
              Quiz studio <ArrowUpRight size={14} />
            </Link>
          </div>
          {questions.isLoading ? (
            <p className="presentation-tool-card__hint">Loading question bank…</p>
          ) : questions.data?.length ? (
            <div className="knowledge-check-control">
              <label>
                <span>One-question knowledge check</span>
                <select
                  value={knowledgeQuestionId}
                  onChange={(event) => setKnowledgeQuestionId(event.target.value)}
                  data-testid="select-knowledge-check-question"
                >
                  {questions.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.question}
                    </option>
                  ))}
                </select>
              </label>
              <label className="knowledge-check-time">
                <span>Seconds</span>
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={knowledgeSeconds}
                  onChange={(event) =>
                    setKnowledgeSeconds(
                      Math.max(10, Math.min(300, Number(event.target.value))),
                    )
                  }
                  data-testid="input-knowledge-check-time"
                />
              </label>
              <button
                className="btn btn-outline"
                type="button"
                onClick={startKnowledgeCheck}
                disabled={
                  !knowledgeQuestionId ||
                  startKnowledgeCheckMutation.isPending ||
                  quizIsLive
                }
                data-testid="button-start-knowledge-check"
              >
                {startKnowledgeCheckMutation.isPending
                  ? "Opening…"
                  : "Open knowledge check"}
              </button>
            </div>
          ) : (
            <p className="presentation-tool-card__hint">
              Add at least one question in Quiz studio to open a knowledge check.
            </p>
          )}
          {currentActivity === "word-cloud" ||
          currentActivity === "audience-questions" ||
          (currentActivity === "poll" && poll?.status === "open") ||
          ((currentActivity === "quiz" ||
            currentActivity === "knowledge-check") &&
            quizIsLive) ? (
            <button
              className="activity-close"
              type="button"
              onClick={closeCurrentActivity}
              disabled={
                closePoll.isPending ||
                endQuiz.isPending ||
                setActivity.isPending
              }
              data-testid="button-close-activity"
            >
              Close current activity
            </button>
          ) : null}
          {canReturn && (
            <button
              className="activity-return"
              type="button"
              onClick={returnToPresentation}
              disabled={setActivity.isPending}
              data-testid="button-return-to-presentation"
            >
              Return to presentation
            </button>
          )}
          {(setActivity.isError ||
            closePoll.isError ||
            endQuiz.isError ||
            startKnowledgeCheckMutation.isError) && (
            <p className="error-text" role="alert">
              The activity could not be updated. Please try again.
            </p>
          )}
        </section>
      </div>

      <div className="presentation-extras__grid">
        <section className="presentation-tool-card presentation-shortcuts">
          <div>
            <p className="eyebrow">KEYBOARD</p>
            <h3 className="serif">Move through chapters.</h3>
            <p>Use ← and →, Page Up and Page Down, or Space to move forward.</p>
          </div>
          <div className="presentation-shortcuts__buttons">
            <button
              type="button"
              onClick={() => move(slideIndex - 1)}
              disabled={slideIndex <= 0 || changeSlide.isPending}
              aria-label="Previous chapter"
              data-testid="button-previous-chapter"
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {slideIndex + 1} / {session.data?.slideCount ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => move(slideIndex + 1)}
              disabled={
                slideIndex >= (session.data?.slideCount ?? 1) - 1 ||
                changeSlide.isPending
              }
              aria-label="Next chapter"
              data-testid="button-next-chapter"
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </section>

        <section className="presentation-tool-card presenter-questions">
          <div className="presentation-tool-card__heading">
            <div>
              <p className="eyebrow">PRIVATE Q&A</p>
              <h3 className="serif">Questions for you.</h3>
            </div>
            <span className="private-tag">Only presenters see these</span>
          </div>
          {submissions.isLoading ? (
            <p className="presentation-tool-card__hint">Checking for questions…</p>
          ) : submissions.isError ? (
            <p className="error-text" role="alert">
              Questions could not be loaded.
            </p>
          ) : questionsForPresenter.length ? (
            <div className="presenter-question-list">
              {questionsForPresenter.map((item) => (
                <article key={item.id} data-testid={`question-${item.id}`}>
                  <div>
                    <strong>{item.nickname}</strong>
                    <p>{item.content}</p>
                    <small>{new Date(item.createdAt).toLocaleTimeString()}</small>
                  </div>
                  <div className="presenter-question-actions">
                    {item.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => setQuestionStatus(item.id, "approved")}
                        disabled={moderate.isPending}
                        data-testid={`button-approve-question-${item.id}`}
                      >
                        Approve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setQuestionStatus(item.id, "answered")}
                      disabled={moderate.isPending}
                      data-testid={`button-answer-question-${item.id}`}
                    >
                      Mark answered
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuestionStatus(item.id, "hidden")}
                      disabled={moderate.isPending}
                      data-testid={`button-hide-question-${item.id}`}
                    >
                      Hide
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="presentation-tool-card__hint">
              Questions from the audience will appear here, privately.
            </p>
          )}
          <Link href="/admin/participants" className="text-link">
            View all audience questions <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>
    </section>
  );
}
