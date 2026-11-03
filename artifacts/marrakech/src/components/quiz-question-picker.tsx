import { Check, Minus, Plus } from "lucide-react";
import "./quiz-question-picker.css";

type QuizQuestionOption = { id: string; question: string };

export function QuizQuestionPicker({
  questions,
  selectedIds,
  onChange,
  questionCount,
  onQuestionCountChange,
  disabled = false,
}: {
  questions: QuizQuestionOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  disabled?: boolean;
}) {
  const toggleQuestion = (id: string) =>
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selected) => selected !== id)
        : [...selectedIds, id],
    );

  return (
    <section
      className="quiz-question-picker"
      aria-labelledby="quiz-question-picker-title"
      data-testid="quiz-question-picker"
    >
      <div className="quiz-question-picker__heading">
        <div>
          <p className="eyebrow">BUILD THIS ROUND</p>
          <h2 id="quiz-question-picker-title" className="serif">
            Choose the questions.
          </h2>
          <p>Select any questions, then set how many to use in this quiz.</p>
        </div>
        <label className="quiz-question-picker__count">
          <span>Questions in round</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, selectedIds.length)}
            value={Math.min(questionCount, Math.max(1, selectedIds.length))}
            onChange={(event) =>
              onQuestionCountChange(
                Math.max(
                  1,
                  Math.min(
                    Math.max(1, selectedIds.length),
                    Number(event.target.value) || 1,
                  ),
                ),
              )
            }
            disabled={disabled || selectedIds.length === 0}
            data-testid="input-quiz-question-count"
          />
        </label>
      </div>
      <div className="quiz-question-picker__selection">
        <span>
          {selectedIds.length} selected · {Math.min(questionCount, selectedIds.length)} will run
        </span>
        <div>
          <button
            type="button"
            onClick={() => onChange(questions.map((question) => question.id))}
            disabled={disabled || selectedIds.length === questions.length}
            data-testid="button-select-all-quiz-questions"
          >
            <Plus size={14} /> Select all
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled || selectedIds.length === 0}
            data-testid="button-clear-quiz-questions"
          >
            <Minus size={14} /> Clear
          </button>
        </div>
      </div>
      {questions.length ? (
        <div className="quiz-question-picker__list">
          {questions.map((question, index) => {
            const checked = selectedIds.includes(question.id);
            return (
              <label
                className={checked ? "is-selected" : ""}
                key={question.id}
                data-testid={`quiz-question-choice-${question.id}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleQuestion(question.id)}
                  disabled={disabled}
                />
                <span className="quiz-question-picker__number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{question.question}</span>
                {checked && <Check size={15} aria-hidden="true" />}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="quiz-question-picker__empty">
          Add questions to the bank below before starting a quiz.
        </p>
      )}
    </section>
  );
}
