import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Pause,
  Play,
  Square,
  Mic,
  MonitorUp,
  Plus,
  Sparkles,
  FileText,
  BrainCircuit,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { api, post } from "../services/api";
import { useMeeting } from "../hooks/useMeeting";
import { useCapture } from "../hooks/useCapture";
import {
  Button,
  SectionTitle,
  ErrorBox,
  Loading,
  LanguageSelect,
  Pill,
  TextList,
  Empty,
} from "../components/UI";
import { AskPanel } from "../components/AskPanel";
import {
  languages,
  type Language,
  type Meeting,
  type Summary,
} from "../../../shared/types";
export function NewMeeting({ onCreated }: { onCreated: (m: Meeting) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <SectionTitle
        eyebrow="MAKE SPACE FOR THE CONVERSATION"
        title="Let's start with a little clarity."
      >
        Give your meeting a name. MeetMind will help you connect the ideas.
      </SectionTitle>
      <div className="new-meeting">
        <div className="new-meeting-art">
          <AudioLines size={52} />
          <h2>
            Less note-taking.
            <br />
            More being there.
          </h2>
          <p>
            Keep the context. Ask the questions.
            <br />
            Make the knowledge yours.
          </p>
          <div className="language-bubbles">
            {Object.values(languages).map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              onCreated(
                await post<Meeting>("/meetings", {
                  title: f.get("title"),
                  language: f.get("language"),
                  platform: f.get("platform"),
                  consent: !!f.get("consent"),
                }),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Your next conversation</h2>
          <label>
            Meeting title
            <input
              name="title"
              required
              placeholder="e.g. Java Collections — Study Session"
              maxLength={160}
            />
          </label>
          <div className="form-row">
            <label>
              Spoken language
              <select name="language">
                {Object.entries(languages).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Platform
              <select name="platform">
                <option>Browser</option>
                <option>Google Meet</option>
                <option>Microsoft Teams</option>
                <option>Zoom Web</option>
                <option>YouTube</option>
                <option>Classroom</option>
              </select>
            </label>
          </div>
          <label className="consent">
            <input type="checkbox" name="consent" required />
            <span>
              <ShieldCheck size={16} /> I have permission to capture this
              meeting.
              <small>
                Only record meetings when you have permission from participants
                and when permitted by applicable rules.
              </small>
            </span>
          </label>
          <ErrorBox message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Start assistant"}
            <ArrowRight size={18} />
          </Button>
          <p className="muted small-text">
            Audio stays off until you select a capture method.
          </p>
        </form>
      </div>
    </>
  );
}
export function LiveMeetingPage({
  id,
  onFinished,
}: {
  id: string;
  onFinished: (id: string) => void;
}) {
  const { meeting: m, error: loadError, refresh } = useMeeting(id);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [language, setLanguage] = useState<Language>("en"),
    [translated, setTranslated] = useState<Summary | null>(null),
    [translating, setTranslating] = useState(false),
    [tab, setTab] = useState("transcript"),
    [draft, setDraft] = useState(""),
    [demoPlaying, setDemoPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const end = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    autoscroll = useRef(true);
  const capture = useCapture(
    id,
    m?.detectedLanguage || "en",
    refresh,
    setError,
  );
  useEffect(() => {
    if (m) setLanguage(m.selectedDisplayLanguage);
  }, [m?.id]);
  useEffect(() => {
    if (!m) return;
    const tick = () =>
      setElapsed(
        Math.floor((Date.now() - new Date(m.startedAt).getTime()) / 1000),
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [m?.startedAt]);
  useEffect(() => {
    if (autoscroll.current)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [m?.transcript.length]);
  useEffect(() => {
    if (m?.status === "completed") {
      void capture.stop();
      onFinished(id);
    } else if (m?.status === "paused" && capture.mode !== "off")
      void capture.stop();
  }, [m?.status]);
  useEffect(() => {
    if (!m) return;
    let cancelled = false;
    setTranslated(null);
    if (language === m.detectedLanguage) return;
    setTranslating(true);
    post<{ summary: Summary }>(`/meetings/${id}/translate`, { language })
      .then((r) => {
        if (!cancelled) {
          setTranslated(r.summary);
          setError("");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setTranslating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, language, m?.revision]);
  useEffect(() => {
    if (!m?.demo || !demoPlaying || m.status !== "live") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const lesson = await api<{ chunks: string[] }>(
          `/demo/lesson?language=${m.detectedLanguage}`,
        );
        const i = m.transcript.length;
        if (i >= lesson.chunks.length) {
          setDemoPlaying(false);
          return;
        }
        if (cancelled) return;
        await post(`/meetings/${id}/transcript`, {
          text: lesson.chunks[i],
          speaker: "Dr. Ananya Kumar",
          language: m.detectedLanguage,
          clientId: `demo-${i}`,
        });
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        setDemoPlaying(false);
      }
    }, 2400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [m?.transcript.length, m?.status, m?.demo, demoPlaying, id]);
  const action = async (fn: () => Promise<unknown>) => {
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
  if (!m)
    return (
      <>
        <ErrorBox message={loadError} />
        <Loading />
      </>
    );
  const summary = translated || m.summary;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> Live meeting
          </div>
          <h1>{m.title}</h1>
          <p>
            <span className={"status-dot " + m.status} />
            {m.status === "live" ? "Assistant is ready" : "Assistant paused"}
            <span>·</span>
            {m.platform}
            <span>·</span>
            {m.demo ? "Sample lesson" : languages[m.detectedLanguage]}
          </p>
        </div>
        <LanguageSelect value={language} onChange={setLanguage} />
      </div>
      <div className="recording-bar">
        <div className="recording-info">
          <span className="recording-icon">
            <AudioLines size={23} />
          </span>
          <div>
            <b>
              {m.status === "live"
                ? "Stay in the conversation."
                : "Take a moment."}
            </b>
            <span>
              {m.demo
                ? "Demo lesson · content arrives gradually"
                : capture.mode === "off"
                  ? "Choose a capture method below"
                  : capture.mode === "tab"
                    ? "Shared tab audio is being captured"
                    : "Microphone recognition is active"}
            </span>
          </div>
        </div>
        <div className="recording-actions">
          <code>{new Date(elapsed * 1000).toISOString().slice(11, 19)}</code>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await capture.stop();
                await api(`/meetings/${id}/status`, {
                  method: "PATCH",
                  body: JSON.stringify({
                    status: m.status === "paused" ? "live" : "paused",
                  }),
                });
              })
            }
          >
            {m.status === "paused" ? <Play size={15} /> : <Pause size={15} />}{" "}
            {m.status === "paused" ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="stop"
            disabled={busy}
            onClick={() => {
              setDemoPlaying(false);
              void action(async () => {
                await capture.stop();
                await post(`/meetings/${id}/stop`);
                onFinished(id);
              });
            }}
          >
            <Square size={13} />
            {busy ? "Saving…" : "Stop meeting"}
          </Button>
        </div>
      </div>
      <ErrorBox message={loadError || error || m.aiError || ""} />
      {m.aiError && (
        <Button
          variant="outline"
          onClick={() => void action(() => post(`/meetings/${id}/process`))}
        >
          <RefreshCw size={14} />
          Retry processing
        </Button>
      )}
      <div className="live-grid">
        <section className="transcript-panel panel">
          <div className="tabs">
            <button
              className={tab === "transcript" ? "active" : ""}
              onClick={() => setTab("transcript")}
            >
              <FileText size={16} /> Live transcript{" "}
              <span>{m.transcript.length}</span>
            </button>
            <button
              className={tab === "questions" ? "active" : ""}
              onClick={() => setTab("questions")}
            >
              <BrainCircuit size={16} /> Questions{" "}
              <span>{summary.questions.length}</span>
            </button>
            <Pill kind="live">{m.status === "live" ? "LIVE" : "PAUSED"}</Pill>
          </div>
          <div
            className="transcript-scroll"
            ref={scroll}
            onScroll={() => {
              const e = scroll.current;
              if (e)
                autoscroll.current =
                  e.scrollHeight - e.scrollTop - e.clientHeight < 100;
            }}
          >
            {tab === "transcript" ? (
              m.transcript.length ? (
                m.transcript.map((c, i) => (
                  <div className="transcript-row appear" key={c.id}>
                    <span className={"avatar " + (i % 2 ? "cyan" : "")}>
                      {c.speaker
                        .split(" ")
                        .map((x) => x[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <div>
                      <b>
                        {c.speaker}
                        <small>
                          {new Date(c.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </b>
                      <p>{c.originalText}</p>
                    </div>
                  </div>
                ))
              ) : (
                <Empty title="Ready when you are">
                  {m.demo
                    ? "Play the sample lesson below to watch your notes take shape."
                    : "Start microphone or tab audio capture, use the extension, or paste a transcript."}
                </Empty>
              )
            ) : summary.questions.length ? (
              summary.questions.map((q, i) => (
                <div className="study-question" key={q.id}>
                  <Pill>{q.difficulty}</Pill>
                  <h3>
                    {i + 1}. {q.question}
                  </h3>
                  <details>
                    <summary>Reveal answer</summary>
                    <p>{q.answer}</p>
                    <small>
                      Source:{" "}
                      {q.sourceTranscriptIds
                        .map(
                          (x) =>
                            m.transcript.find((c) => c.id === x)?.originalText,
                        )
                        .join(" ")}
                    </small>
                  </details>
                </div>
              ))
            ) : (
              <Empty title="Questions follow the ideas">
                Meaningful discussion will become your practice questions.
              </Empty>
            )}
            <div ref={end} />
          </div>
          <div className="capture-controls">
            {m.demo ? (
              <>
                <Button
                  disabled={
                    m.status !== "live" || busy || m.transcript.length >= 8
                  }
                  onClick={() => setDemoPlaying(!demoPlaying)}
                >
                  {m.transcript.length >= 8 ? (
                    <Check size={16} />
                  ) : demoPlaying ? (
                    <Pause size={16} />
                  ) : (
                    <Play size={16} />
                  )}{" "}
                  {m.transcript.length >= 8
                    ? "Lesson complete"
                    : demoPlaying
                      ? "Pause sample"
                      : "Play sample lesson"}
                </Button>
                <span className="muted small-text">
                  {m.transcript.length} / 8 lesson segments
                </span>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={m.status !== "live" || busy}
                  onClick={() => void capture.microphone()}
                >
                  <Mic size={16} />
                  Microphone
                </Button>
                <Button
                  variant="outline"
                  disabled={m.status !== "live" || busy}
                  onClick={() => void capture.tab()}
                >
                  <MonitorUp size={16} />
                  Tab audio
                </Button>
                {capture.mode !== "off" && (
                  <Button variant="outline" onClick={() => void capture.stop()}>
                    Stop capture
                  </Button>
                )}
              </>
            )}
          </div>
          {!m.demo && (
            <form
              className="manual-transcript"
              onSubmit={(e) => {
                e.preventDefault();
                const text = draft;
                void action(async () => {
                  await post(`/meetings/${id}/transcript`, {
                    text,
                    language: m.detectedLanguage,
                    speaker: "Speaker",
                    clientId: crypto.randomUUID(),
                  });
                  setDraft("");
                });
              }}
            >
              <textarea
                aria-label="Manual transcript"
                placeholder="Or paste a transcript segment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={6000}
              />
              <Button
                type="submit"
                variant="icon"
                title="Add transcript"
                disabled={!draft.trim() || busy || m.status !== "live"}
              >
                <Plus size={18} />
              </Button>
            </form>
          )}
          <div className="panel-footnote">
            <ShieldCheck size={13} />
            Original transcript preserved · Capture only with permission
          </div>
        </section>
        <section className="summary-panel panel">
          <div className="card-heading">
            <h3>
              <Sparkles size={18} /> Live summary
            </h3>
            <span className="tiny-pill">
              {translating ? "TRANSLATING" : "AI NOTES"}
            </span>
          </div>
          {translating ? (
            <Loading text="Translating the original notes…" />
          ) : (
            <>
              <div className="current-topic">
                <span className="eyebrow">CURRENT TOPIC</span>
                <h3>{summary.currentTopic || "Your next great idea"}</h3>
              </div>
              <div className="summary-body">
                <h4>Key takeaways</h4>
                <TextList
                  items={summary.keyPoints}
                  empty="The important points will appear as the discussion unfolds."
                />
                {summary.concepts.length > 0 && (
                  <div className="concept-callout">
                    <BrainCircuit size={18} />
                    <div>
                      <span>Worth remembering</span>
                      <p>{summary.concepts.at(-1)}</p>
                    </div>
                  </div>
                )}
                <h4>Decisions & next steps</h4>
                <TextList
                  items={[...summary.decisions, ...summary.actionItems]}
                  empty="No decisions or action items recorded."
                />
              </div>
            </>
          )}
          <div className="summary-footer">
            <span className="dot" />
            Updates as new ideas arrive
          </div>
        </section>
      </div>
      <AskPanel id={id} language={language} />
    </>
  );
}
