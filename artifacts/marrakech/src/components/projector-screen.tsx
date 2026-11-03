import { useState } from 'react';
import { Expand, Radio, RotateCcw } from 'lucide-react';
import '../projector-screen.css';

export type ProjectorStatus = 'loading' | 'waiting' | 'live' | 'ended' | 'error';
export type ProjectorConnection = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface ProjectorSlide {
  title: string;
  subtitle: string;
  content: string;
}

export interface ProjectorPoll {
  question: string;
  options: string[];
  status: 'open' | 'closed';
  voteCount: number;
  results?: { option: string; percentage: number }[];
}

export interface ProjectorQuiz {
  status?: 'live' | 'ended';
  question: string;
  questionNumber: number;
  totalQuestions: number;
  options: string[];
  revealed: boolean;
  correctIndex: number | null;
  explanation: string | null;
  leaderboard?: { nickname: string; score: number }[];
}

export interface ProjectorWord {
  word: string;
  count: number;
}

export interface ProjectorScreenProps {
  status: ProjectorStatus;
  sessionCode: string;
  connection: ProjectorConnection;
  slide: ProjectorSlide;
  slideNumber: number;
  slideCount: number;
  activity: string | null;
  slideImage?: string;
  poll?: ProjectorPoll;
  quiz?: ProjectorQuiz;
  words: ProjectorWord[];
  onRetry: () => void;
  onFullscreen: () => void;
  isFullscreen: boolean;
}

const connectionCopy: Record<ProjectorConnection, string> = {
  connecting: 'Connecting to the room',
  connected: 'Connected to the room',
  reconnecting: 'Connection interrupted · reconnecting',
  disconnected: 'Connection lost',
};

function ConnectionStatus({ connection }: { connection: ProjectorConnection }) {
  return (
    <div
      className={`projector-connection projector-connection--${connection}`}
      role="status"
      aria-live="polite"
      data-testid="status-connection"
    >
      <span className="projector-connection__dot" aria-hidden="true" />
      <span>{connectionCopy[connection]}</span>
    </div>
  );
}

function StateScreen({
  status,
  sessionCode,
  onRetry,
}: Pick<ProjectorScreenProps, 'status' | 'sessionCode' | 'onRetry'>) {
  if (status === 'loading') {
    return (
      <section className="projector-state" aria-label="Loading presentation" data-testid="state-loading">
        <span className="projector-state__eyebrow">Marrakech · Live experience</span>
        <div className="projector-skeleton projector-skeleton--short" />
        <div className="projector-skeleton" />
        <p>Preparing the room…</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section className="projector-state" aria-labelledby="projector-error-title" data-testid="state-error">
        <span className="projector-state__eyebrow">A moment, please</span>
        <h1 id="projector-error-title">The room could not be reached.</h1>
        <p>Check the connection, then try again.</p>
        <button className="projector-retry" type="button" onClick={onRetry} data-testid="button-retry">
          <RotateCcw size={17} aria-hidden="true" />
          Try again
        </button>
      </section>
    );
  }

  if (status === 'ended') {
    return (
      <section className="projector-state" aria-labelledby="projector-ended-title" data-testid="state-ended">
        <span className="projector-state__eyebrow">مراكش · Morocco</span>
        <div className="projector-state__seal" aria-hidden="true">م</div>
        <h1 id="projector-ended-title">Thank you for being here.</h1>
        <p>This visit has come to a close.</p>
      </section>
    );
  }

  return (
    <section className="projector-state" aria-labelledby="projector-waiting-title" data-testid="state-waiting">
      <span className="projector-state__eyebrow">Marrakech · A shared journey</span>
      <div className="projector-waiting-mark" aria-hidden="true"><Radio size={25} /></div>
      <h1 id="projector-waiting-title">{sessionCode ? 'Your visit begins shortly.' : 'Waiting for your session.'}</h1>
      <p>{sessionCode ? 'Settle in. The presenter will begin the journey soon.' : 'A session code will appear here when the room is ready.'}</p>
      {sessionCode && <div className="projector-code" data-testid="text-session-code"><span>SESSION</span><strong>{sessionCode}</strong></div>}
    </section>
  );
}

function PollActivity({ poll }: { poll: ProjectorPoll }) {
  const results = poll.results ?? [];
  const total = poll.voteCount;

  return (
    <section className="projector-activity-panel projector-poll" aria-label="Live poll results" data-testid="activity-poll">
      <div className="projector-activity-heading">
        <span className="projector-kicker">{poll.status === 'open' ? 'Room question' : 'The room has answered'}</span>
        <span className="projector-response-count" data-testid="text-poll-votes">{total} {total === 1 ? 'response' : 'responses'}</span>
      </div>
      <h2>{poll.question}</h2>
      {results.length > 0 ? (
        <div className="projector-poll-results">
          {results.map((result, index) => {
            const percentage = Math.max(0, Math.min(100, result.percentage));
            return (
              <div className="projector-poll-row" key={`${result.option}-${index}`} data-testid={`poll-result-${index}`}>
                <div className="projector-poll-row__label"><span>{result.option}</span><strong>{percentage}%</strong></div>
                <div className="projector-poll-track" aria-label={`${result.option}: ${percentage}%`}>
                  <span style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="projector-poll-prompt" data-testid="text-poll-awaiting">
          <div className="projector-poll-prompt__rule" />
          <p>{poll.status === 'open' ? 'Responses are finding their way into the room.' : 'No responses were recorded.'}</p>
          {poll.status === 'open' && <div className="projector-pulse" aria-hidden="true"><i /><i /><i /></div>}
        </div>
      )}
    </section>
  );
}

function WordCloudActivity({ words }: { words: ProjectorWord[] }) {
  const maxCount = Math.max(1, ...words.map(({ count }) => count));
  return (
    <section className="projector-activity-panel projector-word-cloud" aria-label="Audience word cloud" data-testid="activity-word-cloud">
      <span className="projector-kicker">What the room noticed</span>
      <h2>A city, in your words.</h2>
      {words.length ? (
        <div className="projector-word-cloud__words">
          {words.map(({ word, count }, index) => {
            const scale = maxCount ? count / maxCount : 0;
            const size = 1.15 + scale * 2.65;
            return (
              <span
                className={`projector-word-cloud__word projector-word-cloud__word--${index % 4}`}
                key={`${word}-${index}`}
                style={{ fontSize: `clamp(${Math.max(1.15, size * 0.52)}rem, ${size}vw, ${size}rem` }}
                data-testid={`word-${index}`}
              >
                {word}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="projector-activity-empty" data-testid="text-word-cloud-empty">Listening for the room’s first words…</p>
      )}
    </section>
  );
}

function QuizActivity({ quiz }: { quiz: ProjectorQuiz }) {
  const reveal = quiz.revealed && quiz.correctIndex !== null;
  const ended = quiz.status === 'ended';
  return (
    <section className="projector-activity-panel projector-quiz" aria-label="Live quiz question" data-testid="activity-quiz">
      <div className="projector-activity-heading">
        <span className="projector-kicker">{ended ? 'The quiz is complete' : 'A question for the room'}</span>
        {!ended && <span className="projector-quiz__count">{String(quiz.questionNumber).padStart(2, '0')} <i /> {String(quiz.totalQuestions).padStart(2, '0')}</span>}
      </div>
      {ended ? (
        <div className="projector-quiz-finish" data-testid="quiz-finished">
          <h2>The room has finished this quiz.</h2>
          {quiz.leaderboard?.length ? (
            <ol>
              {quiz.leaderboard.slice(0, 5).map((person, index) => (
                <li key={`${person.nickname}-${index}`}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{person.nickname}</strong>
                  <b>{person.score}</b>
                </li>
              ))}
            </ol>
          ) : (
            <p>Final results are ready for the presenter to reveal.</p>
          )}
        </div>
      ) : (
        <>
          <h2>{quiz.question}</h2>
          <div className="projector-quiz-options">
            {quiz.options.map((option, index) => {
              const isCorrect = reveal && index === quiz.correctIndex;
              return (
                <div className={`projector-quiz-option${isCorrect ? ' is-correct' : ''}`} key={`${option}-${index}`} data-testid={`quiz-option-${index}`}>
                  <span className="projector-quiz-option__letter">{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                  {isCorrect && <span className="projector-quiz-option__answer">Answer</span>}
                </div>
              );
            })}
          </div>
          {reveal && quiz.explanation && <p className="projector-quiz__explanation" data-testid="text-quiz-explanation">{quiz.explanation}</p>}
          {!reveal && <p className="projector-quiz__hint" data-testid="text-quiz-unrevealed">Choose your answer</p>}
        </>
      )}
    </section>
  );
}

function AudienceQuestionsActivity({ closed }: { closed: boolean }) {
  return (
    <section className="projector-activity-panel projector-questions" aria-label="Audience questions" data-testid="activity-audience-questions">
      <span className="projector-kicker">{closed ? 'Questions are closed' : 'A question for the presenter'}</span>
      <h2>{closed ? 'The presenter is reviewing your questions.' : 'What would you like to know?'}</h2>
      <p>{closed ? 'Audience questions remain private to the presenter.' : 'Send a private question from your phone. It will not appear on this screen.'}</p>
    </section>
  );
}

function SlideView({
  slide,
  slideImage,
  slideNumber,
  slideCount,
}: Pick<ProjectorScreenProps, 'slide' | 'slideImage' | 'slideNumber' | 'slideCount'>) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(slideImage) && !imageFailed;
  return (
    <article className={`projector-slide${showImage ? ' has-image' : ''}`} data-testid="projector-slide">
      {showImage && (
        <img
          className="projector-slide__image"
          src={slideImage}
          alt=""
          onError={() => setImageFailed(true)}
          data-testid="img-slide"
        />
      )}
      {showImage && <div className="projector-slide__image-shade" aria-hidden="true" />}
      <div className="projector-slide__frame" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="projector-slide__meta">
        <span>Marrakech <i /> The Red City Experience</span>
        <span className="projector-slide__number" data-testid="text-slide-number">{slideNumber} <i /> {slideCount}</span>
      </div>
      <div className="projector-slide__copy">
        <span className="projector-kicker">A city of many layers</span>
        {slide.subtitle && <p className="projector-slide__subtitle">{slide.subtitle}</p>}
        <h1 data-testid="text-slide-title">{slide.title}</h1>
        <div className="projector-slide__divider" aria-hidden="true"><span /></div>
        {slide.content && <p className="projector-slide__content" data-testid="text-slide-content">{slide.content}</p>}
      </div>
      <div className="projector-slide__footer">
        <span>مراكش · المغرب</span>
        <span>LOOK CLOSER <i /> LISTEN LONGER</span>
      </div>
    </article>
  );
}

export function ProjectorScreen({
  status,
  sessionCode,
  connection,
  slide,
  slideNumber,
  slideCount,
  activity,
  slideImage,
  poll,
  quiz,
  words,
  onRetry,
  onFullscreen,
  isFullscreen,
}: ProjectorScreenProps) {
  const isLive = status === 'live' && Boolean(sessionCode);
  const showConnectionStatus =
    (Boolean(sessionCode) || status !== 'waiting') && status !== 'ended';
  const normalizedActivity = activity?.toLowerCase().replaceAll('_', '-');
  const isWordCloud = normalizedActivity === 'word-cloud' || normalizedActivity === 'word-cloud-closed';
  const isQuiz = normalizedActivity === 'quiz' || normalizedActivity === 'knowledge-check';
  const isAudienceQuestions = normalizedActivity === 'audience-questions' || normalizedActivity === 'audience-questions-closed';

  return (
    <main className="projector-screen" data-testid="projector-screen">
      <div className="projector-screen__grain" aria-hidden="true" />
      {isLive ? (
        <div className={`projector-live${normalizedActivity === 'poll' || isQuiz || isWordCloud || isAudienceQuestions ? ' projector-live--activity' : ''}`}>
          {normalizedActivity === 'poll' && poll ? (
            <PollActivity poll={poll} />
          ) : isWordCloud ? (
            <WordCloudActivity words={words} />
          ) : isQuiz && quiz ? (
            <QuizActivity quiz={quiz} />
          ) : isAudienceQuestions ? (
            <AudienceQuestionsActivity closed={normalizedActivity === 'audience-questions-closed'} />
          ) : (
            <SlideView slide={slide} slideImage={slideImage} slideNumber={slideNumber} slideCount={slideCount} />
          )}
          <div className="projector-live__footer">
            <span className="projector-live__session" data-testid="text-live-session"><i /> SESSION {sessionCode}</span>
            <ConnectionStatus connection={connection} />
          </div>
        </div>
      ) : (
        <>
          <StateScreen status={status} sessionCode={sessionCode} onRetry={onRetry} />
          {status !== 'loading' && showConnectionStatus && <ConnectionStatus connection={connection} />}
        </>
      )}
      {connection === 'disconnected' && status === 'live' && (
        <button className="projector-disconnected-retry" type="button" onClick={onRetry} data-testid="button-retry-disconnected">
          <RotateCcw size={15} aria-hidden="true" /> Reconnect
        </button>
      )}
      <button
        className="projector-fullscreen"
        type="button"
        onClick={onFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        data-testid="button-fullscreen"
      >
        <Expand size={18} aria-hidden="true" />
      </button>
    </main>
  );
}

export default ProjectorScreen;
