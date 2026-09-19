import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  Trophy,
  Sparkles,
  BookOpen,
} from "lucide-react";
import { api, post } from "../services/api";
import type { Quiz, Result, Language } from "../../../shared/types";
import {
  SectionTitle,
  Button,
  ErrorBox,
  Loading,
  LanguageSelect,
  Pill,
  duration,
} from "../components/UI";
export function QuizPage({
  id,
  onReview,
}: {
  id: string;
  onReview: () => void;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null),
    [language, setLanguage] = useState<Language>("en"),
    [answers, setAnswers] = useState<Record<string, string | number>>({}),
    [index, setIndex] = useState(0),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  useEffect(() => {
    let gone = false;
    setQuiz(null);
    setError("");
    api<Quiz>(`/meetings/${id}/quiz?language=${language}`)
      .then((q) => {
        if (!gone) setQuiz(q);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [id, language]);
  if (result)
    return (
      <QuizResult
        result={result}
        onReview={onReview}
        onRetake={() => {
          setResult(null);
          setAnswers({});
          setIndex(0);
          started.current = Date.now();
        }}
      />
    );
  const q = quiz?.questions[index];
  return (
    <>
      <SectionTitle
        eyebrow="MAKE THE KNOWLEDGE YOURS"
        title="A little practice. A lasting impression."
        action={<LanguageSelect value={language} onChange={setLanguage} />}
      >
        A knowledge check built from your meeting. Score 50% or more to pass.
      </SectionTitle>
      <ErrorBox message={error} />
      {!quiz && !error ? (
        <Loading text="Preparing your knowledge check…" />
      ) : (
        q && (
          <div className="quiz-layout">
            <section className="quiz-card panel">
              <div className="between">
                <span className="eyebrow">
                  QUESTION {index + 1} OF {quiz!.questions.length}
                </span>
                <Pill>{q.difficulty}</Pill>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${(Object.keys(answers).length / quiz!.questions.length) * 100}%`,
                  }}
                />
              </div>
              <h2>{q.question}</h2>
              {q.type === "short_answer" ? (
                <label>
                  Your answer
                  <input
                    aria-label="Short answer"
                    placeholder="Type your answer…"
                    value={answers[q.id] ?? ""}
                    onChange={(e) =>
                      setAnswers({ ...answers, [q.id]: e.target.value })
                    }
                  />
                </label>
              ) : (
                <div className="quiz-options">
                  {q.options.map((o, i) => (
                    <button
                      key={i}
                      className={answers[q.id] === i ? "selected" : ""}
                      onClick={() => setAnswers({ ...answers, [q.id]: i })}
                    >
                      <span>{String.fromCharCode(65 + i)}</span>
                      {o}
                      {answers[q.id] === i && <Check size={18} />}
                    </button>
                  ))}
                </div>
              )}
              <div className="quiz-nav">
                <Button
                  variant="outline"
                  onClick={() => setIndex(index - 1)}
                  disabled={index === 0 || busy}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <span>
                  {Object.keys(answers).length} / {quiz!.questions.length}{" "}
                  answered
                </span>
                {index < quiz!.questions.length - 1 ? (
                  <Button
                    onClick={() => setIndex(index + 1)}
                    disabled={
                      answers[q.id] === undefined || answers[q.id] === ""
                    }
                  >
                    Next question
                    <ArrowRight size={17} />
                  </Button>
                ) : (
                  <Button
                    disabled={
                      busy ||
                      Object.keys(answers).length !== quiz!.questions.length ||
                      Object.values(answers).some((v) => v === "")
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        setResult(
                          await post<Result>(`/quiz/${quiz!.id}/submit`, {
                            answers,
                            language,
                            timeTaken: Math.floor(
                              (Date.now() - started.current) / 1000,
                            ),
                          }),
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Checking…" : "Finish knowledge test"}
                    <Check size={17} />
                  </Button>
                )}
              </div>
            </section>
            <aside className="quiz-aside">
              <span className="meeting-icon">
                <Sparkles size={24} />
              </span>
              <h3>Progress over perfection.</h3>
              <p>
                This is your chance to connect the dots. Take your time, trust
                what you've learned, and keep growing.
              </p>
              <div className="question-dots">
                {quiz!.questions.map((item, i) => (
                  <button
                    aria-label={`Go to question ${i + 1}`}
                    className={
                      index === i
                        ? "current"
                        : answers[item.id] !== undefined
                          ? "done"
                          : ""
                    }
                    key={item.id}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <small>
                Each question is linked to your meeting transcript. Short
                answers use exact normalized matching; see the README for
                limits.
              </small>
            </aside>
          </div>
        )
      )}
    </>
  );
}
function QuizResult({
  result: r,
  onReview,
  onRetake,
}: {
  result: Result;
  onReview: () => void;
  onRetake: () => void;
}) {
  return (
    <>
      <div className={"result-hero " + (r.passed ? "passed" : "")}>
        {r.passed && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 26 }, (_, i) => (
              <i
                key={i}
                style={{
                  left: `${i * 3.7}%`,
                  animationDelay: `${i * 0.07}s`,
                  background: ["#8b7dff", "#50d7c0", "#f5cf88"][i % 3],
                }}
              />
            ))}
          </div>
        )}
        <div className="result-icon">
          <Trophy size={38} />
        </div>
        <span className="eyebrow">
          {r.passed ? "LOOK AT YOU GROW" : "EVERY ATTEMPT IS PROGRESS"}
        </span>
        <h1>
          {r.passed ? "That knowledge is yours." : "You're getting there."}
        </h1>
        <p>
          {r.passed
            ? "You passed! Keep that curiosity going."
            : "Review the highlighted topics and try again."}
        </p>
        <strong className="score">
          {r.percentage}
          <span>%</span>
        </strong>
        <div className="result-stats">
          <span>
            <b>{r.correctAnswers}</b>Correct answers
          </span>
          <span>
            <b>{r.wrongAnswers}</b>To review
          </span>
          <span>
            <b>{duration(r.timeTaken)}</b>Time taken
          </span>
        </div>
        {r.passed && (
          <div className="reward-chip">
            <Sparkles size={17} />
            <b>+{r.xpEarned} XP</b>
            <span>·</span>
            {r.badge} badge
          </div>
        )}
        {r.passed && r.xpEarned === 0 && (
          <small className="muted">
            You already earned this quiz's XP. Improve your score to earn the
            difference.
          </small>
        )}
        <div className="hero-actions">
          <Button onClick={onReview}>
            <BookOpen size={17} />
            Review summary
          </Button>
          <Button variant="outline" onClick={onRetake}>
            <RotateCcw size={16} />
            Try again
          </Button>
        </div>
      </div>
      <section className="panel notes-document">
        <h2>Your answers, explained</h2>
        {r.review.map((q, i) => (
          <div
            className={"review-question " + (q.correct ? "correct" : "")}
            key={q.id}
          >
            <Pill kind={q.correct ? "live" : ""}>
              {q.correct ? "Correct" : "Review this idea"}
            </Pill>
            <h3>
              {i + 1}. {q.question}
            </h3>
            <p>
              Your answer:{" "}
              {q.type === "short_answer" ? q.given : q.options[Number(q.given)]}
            </p>
            <p>
              <b>Correct answer:</b> {q.answer}
            </p>
            <small>
              Supported by {q.sourceTranscriptIds.length} transcript segment(s).
              Open the meeting's Study questions for source text.
            </small>
          </div>
        ))}
      </section>
    </>
  );
}
