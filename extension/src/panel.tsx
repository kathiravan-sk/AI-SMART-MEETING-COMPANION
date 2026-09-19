import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioLines,
  Sparkles,
  ExternalLink,
  Pause,
  Play,
  Square,
  ArrowUp,
  LogOut,
  Mic,
} from "lucide-react";
import {
  languages,
  speechLocales,
  type Language,
  type Meeting,
  type Summary,
  type Answer,
} from "../../shared/types";
import "./style.css";
function Panel() {
  const [token, setToken] = useState(""),
    [apiUrl, setApiUrl] = useState("http://localhost:8000"),
    [dashboardUrl, setDashboardUrl] = useState("http://localhost:5173"),
    [meeting, setMeeting] = useState<Meeting | null>(null),
    [meetingId, setMeetingId] = useState(""),
    [tab, setTab] = useState("transcript"),
    [language, setLanguage] = useState<Language>("en"),
    [spoken, setSpoken] = useState<Language>("en"),
    [summary, setSummary] = useState<Summary | null>(null),
    [title, setTitle] = useState("My meeting"),
    [selector, setSelector] = useState(""),
    [mode, setMode] = useState("captions"),
    [consent, setConsent] = useState(false),
    [question, setQuestion] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [capture, setCapture] = useState<any>(null),
    [lastCapture, setLastCapture] = useState<number | null>(null),
    [unsent, setUnsent] = useState(0),
    [serverInput, setServerInput] = useState("http://localhost:8000");
  useEffect(() => {
    chrome.storage.local
      .get(["token", "apiUrl", "meetingId", "selector", "dashboardUrl"])
      .then((v) => {
        setToken(v.token || "");
        setApiUrl(v.apiUrl || "http://localhost:8000");
        setServerInput(v.apiUrl || "http://localhost:8000");
        setMeetingId(v.meetingId || "");
        setSelector(v.selector || "");
        setDashboardUrl(v.dashboardUrl || "http://localhost:5173");
      });
    const update = () =>
      chrome.storage.local
        .get(["capture", "captureError", "lastCaptureAt", "unsent"])
        .then((v) => {
          setCapture(v.capture || null);
          if (v.captureError) setError(v.captureError);
          setLastCapture(v.lastCaptureAt);
          setUnsent((v.unsent || []).length);
        });
    void update();
    chrome.storage.onChanged.addListener(update);
    return () => chrome.storage.onChanged.removeListener(update);
  }, []);
  async function request<T>(
    path: string,
    body?: unknown,
    method = body ? "POST" : "GET",
  ): Promise<T> {
    const response = await fetch(apiUrl + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const e = await response.json();
      if (response.status === 401) {
        setToken("");
        await chrome.storage.local.remove("token");
      }
      throw new Error(
        typeof e.detail === "string" ? e.detail : "Request failed",
      );
    }
    return response.json();
  }
  const refresh = async () => {
    if (!meetingId || !token) return;
    try {
      const m = await request<Meeting>(`/meetings/${meetingId}`);
      setMeeting(m);
      if (m.status !== "live") {
        const state = await chrome.storage.local.get("capture");
        if (state.capture)
          await chrome.runtime.sendMessage({ type: "STOP_CAPTURE" });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    setMeeting(null);
    if (!token || !meetingId) return;
    void refresh();
    const timer = setInterval(refresh, 3500);
    return () => clearInterval(timer);
  }, [token, meetingId, apiUrl]);
  useEffect(() => {
    if (!meeting) return;
    let ignore = false;
    setSummary(null);
    if (language === meeting.detectedLanguage) return;
    request<{ summary: Summary }>(`/meetings/${meeting.id}/translate`, {
      language,
    })
      .then((r) => {
        if (!ignore) setSummary(r.summary);
      })
      .catch((e) => {
        if (!ignore) setError(e.message);
      });
    return () => {
      ignore = true;
    };
  }, [meeting?.revision, language, meeting?.id]);
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
  const message = async (body: unknown) => {
    const r = await chrome.runtime.sendMessage(body);
    if (r?.error) throw new Error(r.error);
  };
  const stop = () => message({ type: "STOP_CAPTURE" });
  const start = () =>
    message({
      type: "START_CAPTURE",
      meetingId,
      mode,
      language: meeting?.detectedLanguage || spoken,
      selector,
    });
  const s = summary || meeting?.summary;
  const ask = () =>
    run(async () => {
      setAnswer(
        await request<Answer>(`/meetings/${meetingId}/ask`, {
          question,
          language,
        }),
      );
    });
  return (
    <>
      <header>
        <div className="brand">
          <span>
            <AudioLines size={21} />
          </span>
          meetmind<small>AI</small>
        </div>
        <button
          className="icon"
          title="Open dashboard"
          onClick={() =>
            chrome.tabs.create({
              url: dashboardUrl + (meetingId ? "#/meeting/" + meetingId : ""),
            })
          }
        >
          <ExternalLink size={16} />
        </button>
        {token && (
          <button
            className="icon"
            title="Sign out"
            onClick={() =>
              void run(async () => {
                await stop();
                await chrome.storage.local.remove(["token", "meetingId"]);
                setToken("");
                setMeeting(null);
                setMeetingId("");
              })
            }
          >
            <LogOut size={16} />
          </button>
        )}
      </header>
      {error && (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
      {!token ? (
        <main>
          <div className="intro">
            <Sparkles size={32} />
            <h1>
              A little more clarity.
              <br />
              Right beside your meeting.
            </h1>
            <p>
              Sign in with the account you created in the MeetMind dashboard.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                const r = await request<{ token: string }>(
                  "/auth/login",
                  Object.fromEntries(f),
                );
                await chrome.storage.local.set({ token: r.token });
                setToken(r.token);
              });
            }}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input name="password" type="password" minLength={8} required />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <button
            className="link"
            onClick={() =>
              chrome.tabs.create({ url: dashboardUrl + "#/login" })
            }
          >
            Create an account in the dashboard <ExternalLink size={12} />
          </button>
        </main>
      ) : !meeting ? (
        <main>
          <div className="intro">
            <h1>Your next conversation.</h1>
            <p>Open the meeting tab, then start the assistant here.</p>
          </div>
          <label>
            Meeting title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
            />
          </label>
          <label>
            Spoken language
            <select
              value={spoken}
              onChange={(e) => setSpoken(e.target.value as Language)}
            >
              {Object.entries(languages).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have permission from participants to capture this meeting.
            </span>
          </label>
          <button
            className="primary"
            disabled={busy || !consent || !title.trim()}
            onClick={() =>
              void run(async () => {
                const m = await request<Meeting>("/meetings", {
                  title,
                  language: spoken,
                  platform: "Chrome extension",
                  consent,
                });
                setMeeting(m);
                setMeetingId(m.id);
                await chrome.storage.local.set({ meetingId: m.id });
              })
            }
          >
            Start assistant
          </button>
          <p className="muted">
            No audio or captions are captured until you choose Start capture.
          </p>
        </main>
      ) : (
        <>
          <section className="meeting-head">
            <span className={"status " + meeting.status}>
              ● {meeting.status}
            </span>
            <h2>{meeting.title}</h2>
            <p>
              {capture ? "Capturing " + capture.mode : "Capture is off"} ·{" "}
              {meeting.transcript.length} segments saved
            </p>
            {lastCapture && capture && (
              <small>
                Last saved {new Date(lastCapture).toLocaleTimeString()}
              </small>
            )}
          </section>
          <nav>
            {[
              ["transcript", "Transcript"],
              ["summary", "Summary"],
              ["ask", "Ask AI"],
              ["questions", "Questions"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          <main className="workspace">
            {tab === "transcript" &&
              (meeting.transcript.length ? (
                meeting.transcript.map((c) => (
                  <article className="chunk" key={c.id}>
                    <div>
                      <b>{c.speaker}</b>
                      <small>
                        {new Date(c.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <p>{c.originalText}</p>
                  </article>
                ))
              ) : (
                <div className="empty">
                  <AudioLines size={28} />
                  <h3>Ready when you are.</h3>
                  <p>
                    For captions, first enable the meeting platform's captions.
                    Click Start capture below.
                  </p>
                  <p>
                    Selectors can change across sites. If no text arrives, try
                    tab audio or the custom selector.
                  </p>
                </div>
              ))}
            {tab === "summary" && (
              <>
                <div className="topic">
                  <small>CURRENT TOPIC</small>
                  <h3>{s?.currentTopic || "Waiting for the conversation"}</h3>
                </div>
                <h3>Key takeaways</h3>
                <ul>
                  {s?.keyPoints.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                <h3>Decisions & next steps</h3>
                <ul>
                  {[...(s?.decisions || []), ...(s?.actionItems || [])].map(
                    (p, i) => (
                      <li key={i}>{p}</li>
                    ),
                  )}
                </ul>
              </>
            )}
            {tab === "questions" &&
              (s?.questions.length ? (
                s.questions.map((q) => (
                  <article className="study" key={q.id}>
                    <small>
                      {q.difficulty} · {q.type.replace("_", " ")}
                    </small>
                    <h3>{q.question}</h3>
                    <details>
                      <summary>Show answer</summary>
                      <p>{q.answer}</p>
                    </details>
                  </article>
                ))
              ) : (
                <p className="muted">
                  Meaningful content will become your study questions.
                </p>
              ))}
            {tab === "ask" && (
              <>
                <div className="intro">
                  <Sparkles size={26} />
                  <h3>Ask about this meeting.</h3>
                  <p>Answers are grounded in the conversation.</p>
                </div>
                <form
                  className="ask"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ask();
                  }}
                >
                  <input
                    aria-label="Ask a question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What does this mean?"
                    required
                  />
                  <button
                    className="icon"
                    type="button"
                    title="Voice question"
                    onClick={() => {
                      const Speech =
                        (window as any).SpeechRecognition ||
                        (window as any).webkitSpeechRecognition;
                      if (!Speech) {
                        setError(
                          "Voice recognition is unavailable. Please type instead.",
                        );
                        return;
                      }
                      const rec = new Speech();
                      rec.lang = speechLocales[language];
                      rec.onresult = (event: any) =>
                        setQuestion(event.results[0][0].transcript);
                      rec.onerror = (event: any) =>
                        setError("Voice input: " + event.error);
                      rec.start();
                    }}
                  >
                    <Mic size={15} />
                  </button>
                  <button
                    className="primary icon"
                    disabled={busy}
                    title="Send question"
                  >
                    <ArrowUp size={17} />
                  </button>
                </form>
                {answer && (
                  <div className="answer">
                    <p>{answer.answer}</p>
                    {answer.sources.map((c) => (
                      <details key={c.id}>
                        <summary>
                          Source · {new Date(c.timestamp).toLocaleTimeString()}
                        </summary>
                        <p>{c.originalText}</p>
                      </details>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
          <section className="controls">
            <label className="language">
              Display language
              <select
                aria-label="Display language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value as Language);
                  setAnswer(null);
                }}
              >
                {Object.entries(languages).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {meeting.status !== "completed" ? (
              <>
                {!capture && (
                  <div className="capture-row">
                    <select
                      aria-label="Capture method"
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                    >
                      <option value="captions">Page captions</option>
                      <option value="audio">Tab audio</option>
                    </select>
                    <button
                      className="primary"
                      disabled={busy || meeting.status !== "live"}
                      onClick={() => void run(start)}
                    >
                      Start capture
                    </button>
                  </div>
                )}
                {capture && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => void run(stop)}
                  >
                    Stop capture
                  </button>
                )}
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await stop();
                        await request(
                          `/meetings/${meetingId}/status`,
                          {
                            status:
                              meeting.status === "paused" ? "live" : "paused",
                          },
                          "PATCH",
                        );
                      })
                    }
                  >
                    {meeting.status === "paused" ? (
                      <Play size={13} />
                    ) : (
                      <Pause size={13} />
                    )}
                    {meeting.status === "paused" ? "Resume" : "Pause"}
                  </button>
                  <button
                    className="stop"
                    disabled={busy || unsent > 0}
                    onClick={() =>
                      void run(async () => {
                        await stop();
                        await request(`/meetings/${meetingId}/stop`, {});
                      })
                    }
                  >
                    <Square size={12} />
                    {busy ? "Working…" : "Stop meeting"}
                  </button>
                </div>
                {unsent > 0 && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(() => message({ type: "RETRY_PENDING" }))
                    }
                  >
                    Retry {unsent} pending captions
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="primary"
                  onClick={() =>
                    chrome.tabs.create({
                      url: dashboardUrl + "#/meeting/" + meetingId,
                    })
                  }
                >
                  View summary & quiz <ExternalLink size={14} />
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    setMeeting(null);
                    setMeetingId("");
                    await chrome.storage.local.remove("meetingId");
                  }}
                >
                  New meeting
                </button>
              </>
            )}
            <p className="privacy">
              Only capture when permitted by participants and applicable rules.
            </p>
          </section>
        </>
      )}
      <details className="settings">
        <summary>Connection & capture settings</summary>
        <label>
          Backend URL
          <input
            value={serverInput}
            onChange={(e) => setServerInput(e.target.value)}
          />
        </label>
        <label>
          Dashboard URL
          <input
            value={dashboardUrl}
            onChange={(e) => setDashboardUrl(e.target.value)}
          />
        </label>
        <label>
          Custom caption CSS selector (optional)
          <input
            value={selector}
            onChange={(e) => setSelector(e.target.value)}
            placeholder="Leave blank for built-in selectors"
          />
        </label>
        <button
          className="secondary"
          disabled={busy || !!capture}
          onClick={() =>
            void run(async () => {
              const u = new URL(serverInput),
                d = new URL(dashboardUrl);
              if (!["http:", "https:"].includes(d.protocol))
                throw new Error("Dashboard URL must use HTTP or HTTPS");
              if (
                u.protocol !== "https:" &&
                !["localhost", "127.0.0.1"].includes(u.hostname)
              )
                throw new Error("Use HTTPS for a remote backend");
              if (u.protocol === "https:") {
                const granted = await chrome.permissions.request({
                  origins: [u.origin + "/*"],
                });
                if (!granted)
                  throw new Error("Server permission was not granted");
              }
              const url = u.origin;
              await chrome.storage.local.set({
                apiUrl: url,
                dashboardUrl: d.origin,
                selector,
              });
              if (url !== apiUrl) {
                await chrome.storage.local.remove(["token", "meetingId"]);
                setToken("");
                setMeetingId("");
                setMeeting(null);
              }
              setApiUrl(url);
            })
          }
        >
          Save settings
        </button>
      </details>
      <footer>Listen. Understand. Learn.</footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Panel />);
