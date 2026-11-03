import { useEffect, useState } from "react";
import {
  getGetActivePollQueryKey,
  getGetCurrentQuizQueryKey,
  getGetSessionStateQueryKey,
  getGetSlidesQueryKey,
  getGetWordCloudQueryKey,
  useGetActivePoll,
  useGetCurrentQuiz,
  useGetSessionState,
  useGetSlides,
  useGetWordCloud,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import ProjectorScreen, {
  type ProjectorConnection,
  type ProjectorStatus,
} from "@/components/projector-screen";
import { subscribeToProjectorSession } from "@/lib/realtime";
import medinaImage from "@/assets/medina-lanes.jpg";
import courtyardImage from "@/assets/zellige-courtyard.jpg";
import tableImage from "@/assets/moroccan-table.jpg";
import craftImage from "@/assets/craft-workshop.jpg";
import squareImage from "@/assets/jemaa-square.jpg";
import gardenImage from "@/assets/atlas-garden.jpg";
import heroImage from "@/assets/marrakech-dusk.jpg";

const chapterImages = [
  medinaImage,
  courtyardImage,
  tableImage,
  craftImage,
  squareImage,
  gardenImage,
  heroImage,
];

function readSessionCode(): string {
  return (
    new URLSearchParams(window.location.search)
      .get("session")
      ?.trim()
      .toUpperCase() ?? ""
  );
}

export default function ProjectorPage() {
  const sessionCode = readSessionCode();
  const queryClient = useQueryClient();
  const [connection, setConnection] =
    useState<ProjectorConnection>("connecting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const session = useGetSessionState(sessionCode, {
    query: {
      enabled: Boolean(sessionCode),
      queryKey: getGetSessionStateQueryKey(sessionCode),
      refetchInterval: (query) =>
        query.state.data?.status === "ended" ? false : 5000,
    },
  });
  const isLiveSession = session.data?.status === "live";
  const slides = useGetSlides({
    query: { queryKey: getGetSlidesQueryKey(), refetchInterval: 30000 },
  });
  const activePoll = useGetActivePoll(sessionCode, {
    query: {
      enabled: Boolean(sessionCode) && isLiveSession,
      queryKey: getGetActivePollQueryKey(sessionCode),
      refetchInterval: 7000,
    },
  });
  const quizState = useGetCurrentQuiz(sessionCode, {
    query: {
      enabled: Boolean(sessionCode) && isLiveSession,
      queryKey: getGetCurrentQuizQueryKey(sessionCode),
      refetchInterval: 5000,
    },
  });
  const wordCloud = useGetWordCloud(sessionCode, {
    query: {
      enabled: Boolean(sessionCode) && isLiveSession,
      queryKey: getGetWordCloudQueryKey(sessionCode),
      refetchInterval: 10000,
    },
  });

  useEffect(() => {
    if (!sessionCode || !isLiveSession) {
      setConnection(session.isLoading ? "connecting" : "disconnected");
      return;
    }
    let dispose = () => {};
    let mounted = true;
    const refresh = (event?: string) => {
      void queryClient.invalidateQueries({
        queryKey: getGetSessionStateQueryKey(sessionCode),
      });
      if (event === "presentation:ended") return;
      void queryClient.invalidateQueries({
        queryKey: getGetActivePollQueryKey(sessionCode),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetCurrentQuizQueryKey(sessionCode),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetWordCloudQueryKey(sessionCode),
      });
      void queryClient.invalidateQueries({
        queryKey: getGetSlidesQueryKey(),
      });
    };
    subscribeToProjectorSession(sessionCode, refresh, undefined, setConnection).then(
      (stop) => {
        if (mounted) dispose = stop;
        else stop();
      },
    );
    return () => {
      mounted = false;
      dispose();
    };
  }, [queryClient, sessionCode, isLiveSession, session.isLoading]);

  useEffect(() => {
    const updateFullscreen = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const retry = () => {
    setConnection("connecting");
    void session.refetch();
    void slides.refetch();
    if (session.data?.status === "live") {
      void activePoll.refetch();
      void quizState.refetch();
      void wordCloud.refetch();
    }
  };
  const toggleFullscreen = () => {
    const screen = document.querySelector(".projector-screen");
    if (!document.fullscreenElement) {
      void screen?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const slideIndex = session.data?.currentSlide ?? 0;
  const currentSlide = slides.data?.[slideIndex];
  const hasFetchError =
    Boolean(sessionCode) &&
    (session.isError || (session.data?.status === "live" && slides.isError));
  let status: ProjectorStatus = "live";
  if (!sessionCode) status = "waiting";
  else if (session.isLoading || (session.data?.status === "live" && !currentSlide))
    status = "loading";
  else if (hasFetchError || !session.data) status = "error";
  else if (session.data.status === "ended") status = "ended";

  const activity = session.data?.currentActivity ?? null;
  const pollRecord = activePoll.data?.poll;
  const poll =
    pollRecord && activity === "poll"
      ? {
          question: pollRecord.question,
          options: pollRecord.options,
          status: pollRecord.status,
          voteCount: pollRecord.voteCount,
          results: activePoll.data?.results?.map((result) => ({
            option: result.option,
            percentage: result.percentage,
          })),
        }
      : undefined;
  const question = quizState.data?.currentQuestion;
  const quiz =
    question &&
    (activity === "quiz" || activity === "knowledge-check")
      ? {
          status:
            quizState.data?.status === "ended"
              ? ("ended" as const)
              : ("live" as const),
          question: question.question,
          questionNumber: question.questionNumber,
          totalQuestions: question.totalQuestions,
          options: question.options,
          revealed: quizState.data?.revealed ?? false,
          correctIndex: quizState.data?.correctIndex ?? null,
          explanation: quizState.data?.explanation ?? null,
          leaderboard:
            quizState.data?.leaderboard.map((person) => ({
              nickname: person.nickname,
              score: person.score,
            })) ?? [],
        }
      : undefined;
  if (
    status === "live" &&
    ((activity === "poll" && !poll) ||
      ((activity === "quiz" || activity === "knowledge-check") && !quiz))
  ) {
    status = "loading";
  }

  return (
    <ProjectorScreen
      status={status}
      sessionCode={sessionCode}
      connection={connection}
      slide={{
        title: currentSlide?.title ?? "",
        subtitle: currentSlide?.subtitle ?? "",
        content: currentSlide?.content ?? "",
      }}
      slideNumber={slideIndex + 1}
      slideCount={session.data?.slideCount ?? slides.data?.length ?? 0}
      activity={activity}
      slideImage={chapterImages[slideIndex % chapterImages.length]}
      poll={poll}
      quiz={quiz}
      words={wordCloud.data ?? []}
      onRetry={retry}
      onFullscreen={toggleFullscreen}
      isFullscreen={isFullscreen}
    />
  );
}
