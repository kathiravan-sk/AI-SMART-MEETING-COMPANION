import { useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  Clock3,
  Flame,
  BookOpen,
  Target,
  TrendingUp,
  Sparkles,
  Play,
  CalendarDays,
  ArrowUpRight,
} from "lucide-react";
import type { Dashboard, Meeting } from "../../../shared/types";
import { api } from "../services/api";
import {
  Button,
  SectionTitle,
  Loading,
  ErrorBox,
  Pill,
  date,
  Empty,
} from "../components/UI";
export function DashboardPage({
  name,
  onNew,
  onDemo,
  onOpen,
}: {
  name: string;
  onNew: () => void;
  onDemo: () => void;
  onOpen: (m: Meeting) => void;
}) {
  const [data, setData] = useState<Dashboard | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Dashboard>("/dashboard")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <SectionTitle
        eyebrow="YOUR LEARNING SPACE"
        title={`A clearer day starts here, ${name.split(" ")[0]}.`}
        action={
          <Button onClick={onNew}>
            <Plus size={17} /> New meeting
          </Button>
        }
      >
        Every conversation is a chance to learn something new.
      </SectionTitle>
      <ErrorBox message={error} />
      {!data && !error ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stat-grid">
              {[
                [
                  BookOpen,
                  "Meetings completed",
                  data.meetingsCompleted,
                  "Conversations, captured",
                ],
                [
                  Clock3,
                  "Learning time",
                  `${Math.floor(data.learningSeconds / 3600)}h ${Math.floor((data.learningSeconds % 3600) / 60)}m`,
                  "Time well spent",
                ],
                [
                  Target,
                  "Average quiz score",
                  `${data.averageScore}%`,
                  "Keep making progress",
                ],
                [
                  Flame,
                  "Learning streak",
                  `${data.streak} ${data.streak === 1 ? "day" : "days"}`,
                  "One little step each day",
                ],
              ].map(([Icon, label, value, sub], i) => {
                const I = Icon as typeof BookOpen;
                return (
                  <div className="stat-card" key={i}>
                    <div>
                      <span>{label as string}</span>
                      <I size={18} />
                    </div>
                    <strong>{value as string}</strong>
                    <small>{sub as string}</small>
                  </div>
                );
              })}
            </div>
            <div className="dashboard-middle">
              <section className="start-card">
                <div>
                  <span className="pill">
                    <Sparkles size={13} /> MORE THAN MEETING NOTES
                  </span>
                  <h2>
                    Stay present.
                    <br />
                    We'll connect the dots.
                  </h2>
                  <p>
                    Summaries, instant answers, and a little
                    <br />
                    confidence for whatever comes next.
                  </p>
                  <Button onClick={onDemo} variant="light">
                    <Play size={15} /> Try the sample lesson{" "}
                    <ArrowRight size={16} />
                  </Button>
                </div>
                <div className="orb">
                  <AudioOrb />
                </div>
                <span className="sample-label">
                  No API key needed for the sample lesson
                </span>
              </section>
              <section className="progress-card">
                <div className="card-heading">
                  <h3>Your learning journey</h3>
                  <TrendingUp size={19} />
                </div>
                <div className="xp-ring">
                  <div>
                    <span>LEVEL</span>
                    <strong>{data.level}</strong>
                  </div>
                </div>
                <div className="between">
                  <span>{data.totalXP} total XP</span>
                  <b>{data.levelXP} / 500</b>
                </div>
                <div className="progress">
                  <i style={{ width: `${data.levelXP / 5}%` }} />
                </div>
                <p>
                  {500 - data.levelXP} XP to your next level. You've got this.
                </p>
              </section>
            </div>
            <div className="card-heading recent-heading">
              <div>
                <h2>Recent conversations</h2>
                <p>Pick up where your curiosity left off.</p>
              </div>
              <Pill>{data.recentMeetings.length} recent</Pill>
            </div>
            <div className="meeting-grid">
              {data.recentMeetings.length ? (
                data.recentMeetings.map((m) => (
                  <button
                    className="meeting-card"
                    key={m.id}
                    onClick={() => onOpen(m)}
                  >
                    <div className="between">
                      <span className="meeting-icon">
                        <BookOpen size={20} />
                      </span>
                      <Pill kind={m.status === "live" ? "live" : ""}>
                        {m.status}
                      </Pill>
                    </div>
                    <h3>{m.title}</h3>
                    <p>
                      <CalendarDays size={13} />
                      {date(m.startedAt)}
                      <span>·</span>
                      {Math.floor(m.duration / 60)} min
                    </p>
                    <div className="meeting-card-bottom">
                      <span>
                        {m.quizId
                          ? "Knowledge check ready"
                          : m.demo
                            ? "Sample lesson"
                            : "Your conversation"}
                      </span>
                      <ArrowUpRight size={19} />
                    </div>
                  </button>
                ))
              ) : (
                <Empty title="A fresh page, just for you">
                  Start a meeting or explore the sample lesson to see your notes
                  here.
                </Empty>
              )}
            </div>
          </>
        )
      )}
    </>
  );
}
function AudioOrb() {
  return (
    <div className="orb-inner">
      {Array.from({ length: 9 }, (_, i) => (
        <i
          key={i}
          style={{
            height: 18 + (4 - Math.abs(i - 4)) * 13,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
