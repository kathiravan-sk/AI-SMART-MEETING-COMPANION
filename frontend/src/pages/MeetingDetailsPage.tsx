import { useEffect, useState } from "react";
import {
  Sparkles,
  Download,
  BrainCircuit,
  ArrowRight,
  Trash2,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { useMeeting } from "../hooks/useMeeting";
import { api, post, download } from "../services/api";
import { AskPanel } from "../components/AskPanel";
import {
  Button,
  SectionTitle,
  ErrorBox,
  Loading,
  LanguageSelect,
  TextList,
  Pill,
  date,
  duration,
} from "../components/UI";
import type { Language, Summary } from "../../../shared/types";
export function MeetingDetailsPage({
  id,
  onQuiz,
  askOnly = false,
}: {
  id: string;
  onQuiz: () => void;
  askOnly?: boolean;
}) {
  const { meeting: m, error: loadError, refresh } = useMeeting(id),
    [language, setLanguage] = useState<Language>("en"),
    [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("summary"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (m) setLanguage(m.selectedDisplayLanguage);
  }, [m?.id]);
  useEffect(() => {
    if (!m) return;
    let ignore = false;
    setSummary(null);
    if (language === m.detectedLanguage) return;
    post<{ summary: Summary }>(`/meetings/${id}/translate`, { language })
      .then((r) => {
        if (!ignore) {
          setSummary(r.summary);
          setError("");
        }
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [id, language, m?.revision]);
  if (!m)
    return (
      <>
        <ErrorBox message={loadError} />
        <Loading />
      </>
    );
  const s = summary || m.summary;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <SectionTitle
        eyebrow={
          askOnly ? "A LITTLE MORE CLARITY" : "YOUR CONVERSATION, CONNECTED"
        }
        title={m.title}
        action={<LanguageSelect value={language} onChange={setLanguage} />}
      >
        {date(m.startedAt)} · {duration(m.duration)} · {m.platform}
      </SectionTitle>
      <ErrorBox message={loadError || error || m.aiError || ""} />
      {askOnly ? (
        <AskPanel id={id} language={language} expanded />
      ) : (
        <>
          <div className="details-actions">
            <Pill kind="live">{m.status}</Pill>
            <Button
              variant="outline"
              onClick={() => download(id).catch((e) => setError(e.message))}
            >
              <Download size={16} />
              Export JSON
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => void run(() => post(`/meetings/${id}/process`))}
            >
              <RefreshCw size={15} />
              Refresh notes
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await post(`/meetings/${id}/quiz/generate`);
                  onQuiz();
                })
              }
            >
              <BrainCircuit size={17} />
              {m.quizId ? "Take knowledge test" : "Generate quiz"}
              <ArrowRight size={16} />
            </Button>
          </div>
          <div className="tabs standalone">
            {[
              ["summary", "Summary", Sparkles],
              ["transcript", "Transcript", MessageSquare],
              ["questions", "Study questions", BrainCircuit],
              ["chat", "Ask AI", MessageSquare],
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Sparkles;
              return (
                <button
                  key={key as string}
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key as string)}
                >
                  <I size={16} />
                  {label as string}
                </button>
              );
            })}
          </div>
          {tab === "summary" && (
            <div className="details-grid">
              <article className="panel notes-document">
                <div className="eyebrow">THE BIG PICTURE</div>
                <h2>Meeting overview</h2>
                <p className="overview-text">
                  {s.overview ||
                    "No summary available yet. Add transcript or retry processing."}
                </p>
                <h3>Key points</h3>
                <TextList items={s.keyPoints} />
                <h3>Important concepts</h3>
                <TextList items={s.concepts} />
              </article>
              <div>
                <article className="panel detail-side">
                  <h3>Topics discussed</h3>
                  <div className="topic-list">
                    {s.topics.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                  <h3>Decisions</h3>
                  <TextList
                    items={s.decisions}
                    empty="No decisions recorded."
                  />
                  <h3>Action items</h3>
                  <TextList
                    items={s.actionItems}
                    empty="No action items recorded."
                  />
                </article>
                <div className="quiz-promo">
                  <BrainCircuit size={25} />
                  <h3>What will you take away?</h3>
                  <p>
                    Turn the important ideas into a little lasting knowledge.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() =>
                      void run(async () => {
                        await post(`/meetings/${id}/quiz/generate`);
                        onQuiz();
                      })
                    }
                  >
                    Test your understanding <ArrowRight size={15} />
                  </Button>
                </div>
              </div>
            </div>
          )}
          {tab === "transcript" && (
            <section className="panel notes-document">
              <div className="between">
                <h2>Original transcript</h2>
                <Button
                  variant="outline danger"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete the transcript, summaries, quizzes, attempts and associated rewards? The meeting title will remain.",
                      )
                    )
                      void run(() =>
                        api(`/meetings/${id}/transcript`, { method: "DELETE" }),
                      );
                  }}
                >
                  <Trash2 size={15} />
                  Delete transcript
                </Button>
              </div>
              {m.transcript.map((c) => (
                <div className="transcript-row" key={c.id}>
                  <span className="avatar">{c.speaker.slice(0, 1)}</span>
                  <div>
                    <b>
                      {c.speaker}
                      <small>
                        {new Date(c.timestamp).toLocaleTimeString()}
                      </small>
                    </b>
                    <p>{c.originalText}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
          {tab === "questions" && (
            <div className="panel notes-document">
              <h2>Important questions</h2>
              {s.questions.length ? (
                s.questions.map((q) => (
                  <div className="study-question" key={q.id}>
                    <Pill>{q.difficulty}</Pill>
                    <h3>{q.question}</h3>
                    <details>
                      <summary>Show answer & source</summary>
                      <p>{q.answer}</p>
                      {q.sourceTranscriptIds.map((source) => (
                        <blockquote key={source}>
                          {
                            m.transcript.find((c) => c.id === source)
                              ?.originalText
                          }
                        </blockquote>
                      ))}
                    </details>
                  </div>
                ))
              ) : (
                <p>No supported questions generated yet.</p>
              )}
            </div>
          )}
          {tab === "chat" && <AskPanel id={id} language={language} expanded />}
        </>
      )}
    </>
  );
}
