import { useEffect, useState } from "react";
import { Trophy, Flame, Star, Zap, Target, LockKeyhole } from "lucide-react";
import { api } from "../services/api";
import type { Progress } from "../../../shared/types";
import {
  SectionTitle,
  Loading,
  ErrorBox,
  date,
  Empty,
  Pill,
} from "../components/UI";
export function RewardsPage() {
  const [data, setData] = useState<Progress | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Progress>("/users/me/rewards")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <SectionTitle
        eyebrow="SMALL STEPS. REAL GROWTH."
        title="Your curiosity is paying off."
      >
        A little recognition for the knowledge you're building.
      </SectionTitle>
      <ErrorBox message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="reward-overview panel">
            <div className="big-badge">
              <Trophy size={48} />
            </div>
            <div>
              <span className="eyebrow">YOUR LEARNING JOURNEY</span>
              <h2>
                Level {data.level} · {data.totalXP} XP
              </h2>
              <p>{500 - data.levelXP} XP until your next level</p>
              <div className="progress">
                <i style={{ width: `${data.levelXP / 5}%` }} />
              </div>
            </div>
            <div className="reward-metric">
              <Flame />
              <b>{data.streak} days</b>
              <span>Current streak</span>
            </div>
            <div className="reward-metric">
              <Target />
              <b>{data.completedQuizzes}</b>
              <span>Quizzes completed</span>
            </div>
          </div>
          <h2 className="spaced-heading">Milestones worth celebrating</h2>
          <div className="badge-grid">
            {[
              ["Starter", "50–59%", Star],
              ["Quick Learner", "60–69%", Zap],
              ["Knowledge Builder", "70–79%", Target],
              ["Smart Learner", "80–89%", Flame],
              ["Meeting Master", "90–100%", Trophy],
            ].map(([name, score, Icon]) => {
              const I = Icon as typeof Trophy,
                unlocked = data.badges.includes(name as string);
              return (
                <div
                  className={"badge-card " + (unlocked ? "unlocked" : "")}
                  key={name as string}
                >
                  <span className="badge-art">
                    <I size={36} />
                  </span>
                  <h3>{name as string}</h3>
                  <p>Score {score as string}</p>
                  <Pill>
                    {unlocked ? (
                      "Unlocked"
                    ) : (
                      <>
                        <LockKeyhole size={11} />
                        Keep learning
                      </>
                    )}
                  </Pill>
                </div>
              );
            })}
          </div>
          <h2 className="spaced-heading">Your practice history</h2>
          {data.attempts.length ? (
            <div className="history-list">
              {data.attempts.map((a) => (
                <div className="history-row" key={a.id}>
                  <span className="meeting-icon">
                    <Target size={20} />
                  </span>
                  <div className="history-name">
                    <h3>
                      {a.percentage}% · {a.badge || "A step forward"}
                    </h3>
                    <p>{date(a.completedAt)}</p>
                  </div>
                  <Pill kind={a.passed ? "live" : ""}>
                    {a.passed ? "Passed" : "Keep going"}
                  </Pill>
                  <b>+{a.xpEarned} XP</b>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Your journey starts with a question">
              Complete a meeting quiz to earn your first milestone.
            </Empty>
          )}
        </>
      )}
    </>
  );
}
