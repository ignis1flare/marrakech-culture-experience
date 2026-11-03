import {
  getGetSessionStateQueryKey,
  getGetSlidesQueryKey,
  useGetSessionState,
  useGetSlides,
} from "@workspace/api-client-react";
import type { SessionConnectionState } from "@/lib/realtime";
import "./audience-live-slide.css";

const activityLabels: Record<string, string> = {
  poll: "A room poll is open",
  quiz: "A quiz question is live",
  "knowledge-check": "A knowledge check is live",
  "word-cloud": "The room is adding words",
  "word-cloud-closed": "Word cloud results",
  "audience-questions": "Questions are open",
  "audience-questions-closed": "Questions are being reviewed",
};

export function AudienceLiveSlide({
  code,
  connection,
}: {
  code: string;
  connection: SessionConnectionState;
}) {
  const session = useGetSessionState(code, {
    query: {
      enabled: Boolean(code),
      queryKey: getGetSessionStateQueryKey(code),
      refetchInterval: 7000,
    },
  });
  const slides = useGetSlides({
    query: { queryKey: getGetSlidesQueryKey() },
  });

  if (!code) return null;
  const index = session.data?.currentSlide ?? 0;
  const slide = slides.data?.[index];
  const activity = session.data?.currentActivity ?? "";

  return (
    <section
      className="audience-live-slide"
      aria-labelledby="audience-live-slide-title"
      aria-live="polite"
      data-testid="audience-current-slide"
    >
      <div className="audience-live-slide__topline">
        <span className={`audience-live-slide__connection ${session.data?.status === "ended" ? "is-ended" : `is-${connection}`}`}>
          <i aria-hidden="true" />
          {session.data?.status === "ended"
            ? "Visit ended"
            : session.isError && !session.data
              ? "Room unavailable"
              : connection === "connected"
                ? "Live sync"
                : connection === "reconnecting"
                  ? "Reconnecting"
                  : connection === "connecting"
                    ? "Connecting"
                    : "Offline"}
        </span>
        <span>
          {session.data
            ? `Chapter ${index + 1} of ${session.data.slideCount}`
            : "Current chapter"}
        </span>
      </div>
      {session.data?.status === "ended" ? (
        <div className="audience-live-slide__ended" role="status">
          This visit has ended.
        </div>
      ) : session.isError && !session.data ? (
        <div className="audience-live-slide__ended" role="status">
          This room is no longer available.
        </div>
      ) : (
        <>
          {activity && (
            <p className="audience-live-slide__activity">
              {activityLabels[activity] ?? activity}
            </p>
          )}
          <h2 id="audience-live-slide-title" className="serif">
            {slide?.title ?? "Preparing the current chapter…"}
          </h2>
          {slide?.subtitle && <p className="audience-live-slide__subtitle">{slide.subtitle}</p>}
          {slide?.content && <p className="audience-live-slide__copy">{slide.content}</p>}
        </>
      )}
    </section>
  );
}
