import { useEffect, useState } from "react";
import { Search, Trash2, Download, ArrowUpRight, BookOpen } from "lucide-react";
import { api, download } from "../services/api";
import type { Meeting } from "../../../shared/types";
import { languages } from "../../../shared/types";
import {
  SectionTitle,
  Button,
  ErrorBox,
  Empty,
  Pill,
  date,
  Loading,
} from "../components/UI";
export function MeetingsPage({
  onOpen,
  summaryOnly = false,
}: {
  onOpen: (m: Meeting) => void;
  summaryOnly?: boolean;
}) {
  const [items, setItems] = useState<Meeting[] | null>(null),
    [query, setQuery] = useState(""),
    [language, setLanguage] = useState("all"),
    [period, setPeriod] = useState("all"),
    [quiz, setQuiz] = useState(false),
    [completed, setCompleted] = useState<Set<string>>(new Set()),
    [error, setError] = useState("");
  const load = () => {
    api<Meeting[]>("/meetings")
      .then(setItems)
      .catch((e) => setError(e.message));
    api<{ attempts: { meetingId: string }[] }>("/users/me/rewards")
      .then((r) => setCompleted(new Set(r.attempts.map((a) => a.meetingId))))
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);
  const filtered = items?.filter(
    (m) =>
      m.title.toLowerCase().includes(query.toLowerCase()) &&
      (language === "all" || m.detectedLanguage === language) &&
      (!quiz || completed.has(m.id)) &&
      (!summaryOnly || m.status === "completed") &&
      (period === "all" ||
        new Date(m.startedAt).getTime() >
          Date.now() - Number(period) * 86400000),
  );
  return (
    <>
      <SectionTitle
        eyebrow="YOUR KNOWLEDGE, TOGETHER"
        title={summaryOnly ? "Meeting summaries" : "My meetings"}
      >
        The ideas worth keeping, always within reach.
      </SectionTitle>
      <div className="filter-bar">
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Search meetings"
            placeholder="Search your conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter by date"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="all">All time</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
        <select
          aria-label="Filter by language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="all">All languages</option>
          {Object.entries(languages).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={quiz}
            onChange={(e) => setQuiz(e.target.checked)}
          />
          Quiz completed
        </label>
      </div>
      <ErrorBox message={error} />
      {!items ? (
        <Loading />
      ) : !filtered?.length ? (
        <Empty title="No meetings here yet">
          Try another filter, or start a new conversation.
        </Empty>
      ) : (
        <div className="history-list">
          {filtered.map((m) => (
            <article className="history-row" key={m.id}>
              <span className="meeting-icon">
                <BookOpen size={22} />
              </span>
              <div className="history-name">
                <h3>{m.title}</h3>
                <p>
                  {date(m.startedAt)} · {Math.floor(m.duration / 60)} min ·{" "}
                  {languages[m.detectedLanguage]}
                </p>
              </div>
              <Pill kind={m.status === "live" ? "live" : ""}>{m.status}</Pill>
              <Button
                variant="icon outline"
                title="Export meeting"
                onClick={() => download(m.id).catch((e) => setError(e.message))}
              >
                <Download size={17} />
              </Button>
              <Button
                variant="icon outline"
                title="Delete meeting"
                onClick={async () => {
                  if (
                    !confirm(
                      "Delete this meeting, its transcript, quiz and reward history?",
                    )
                  )
                    return;
                  try {
                    await api(`/meetings/${m.id}`, { method: "DELETE" });
                    load();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={17} />
              </Button>
              <Button variant="outline" onClick={() => onOpen(m)}>
                Open <ArrowUpRight size={16} />
              </Button>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
