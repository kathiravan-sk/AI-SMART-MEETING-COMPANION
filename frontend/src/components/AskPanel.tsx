import { useState, useRef, useEffect } from "react";
import { ArrowUp, Mic, Sparkles, MessageSquare, BookOpen } from "lucide-react";
import { post } from "../services/api";
import { voiceQuestion } from "../hooks/useCapture";
import type { Answer, Language } from "../../../shared/types";
import { Button, ErrorBox, Loading } from "./UI";
export function AskPanel({
  id,
  language,
  expanded = false,
}: {
  id: string;
  language: Language;
  expanded?: boolean;
}) {
  const [text, setText] = useState(""),
    [messages, setMessages] = useState<
      { question: string; response: Answer }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, busy]);
  useEffect(() => {
    setMessages([]);
    setError("");
  }, [id, language]);
  const ask = async (question = text) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    setText("");
    try {
      const response = await post<Answer>(`/meetings/${id}/ask`, {
        question,
        language,
      });
      setMessages((x) => [...x, { question, response }]);
    } catch (e) {
      setError((e as Error).message);
      setText(question);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={"ask-panel " + (expanded ? "expanded" : "")}>
      <div className="card-heading">
        <h3>
          <Sparkles size={18} /> Ask MeetMind
        </h3>
        <span className="tiny-pill">MEETING CONTEXT</span>
      </div>
      <div className="chat-messages">
        {!messages.length && (
          <div className="chat-welcome">
            <span>
              <MessageSquare size={25} />
            </span>
            <h3>A little clarity, right when you need it.</h3>
            <p>
              Ask about this conversation. Answers come with the context behind
              them.
            </p>
            <button
              className="prompt-chip"
              onClick={() => void ask("What is supervised learning?")}
            >
              What is supervised learning? <ArrowUp size={13} />
            </button>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="chat-turn">
            <p className="user-bubble">{m.question}</p>
            <div className="assistant-bubble">
              <Sparkles size={17} />
              <p>{m.response.answer}</p>
            </div>
            {m.response.sources.length > 0 && (
              <details className="sources">
                <summary>
                  <BookOpen size={12} /> {m.response.sources.length} meeting
                  source{m.response.sources.length > 1 ? "s" : ""}
                </summary>
                {m.response.sources.map((c) => (
                  <blockquote key={c.id}>
                    <small>
                      {new Date(c.timestamp).toLocaleTimeString()} · {c.speaker}
                    </small>
                    <p>{c.originalText}</p>
                  </blockquote>
                ))}
              </details>
            )}
          </div>
        ))}
        {busy && <Loading text="Finding the context…" />}
        <div ref={bottom} />
      </div>
      <ErrorBox message={error} />
      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <input
          aria-label="Ask MeetMind"
          placeholder="Ask about this meeting…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="plain"
          title="Speak a question"
          onClick={() => voiceQuestion(language, setText, setError)}
        >
          <Mic size={18} />
        </button>
        <Button
          type="submit"
          variant="icon"
          title="Send question"
          disabled={busy || !text.trim()}
        >
          <ArrowUp size={18} />
        </Button>
      </form>
      <small className="muted">
        Answers use your meeting context. Verify important details.
      </small>
    </div>
  );
}
