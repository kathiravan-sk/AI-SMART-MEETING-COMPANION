import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  AudioLines,
  BookOpen,
  FileText,
  BrainCircuit,
  Trophy,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
  Plus,
  ArrowUpRight,
  X,
} from "lucide-react";
import { api, post, session } from "./services/api";
import type { Session, Meeting } from "../../shared/types";
import { Logo, Button, ErrorBox, Loading } from "./components/UI";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { MeetingsPage } from "./pages/MeetingsPage";
import { NewMeeting, LiveMeetingPage } from "./pages/LiveMeetingPage";
import { MeetingDetailsPage } from "./pages/MeetingDetailsPage";
import { QuizPage } from "./pages/QuizPage";
import { RewardsPage } from "./pages/RewardsPage";
import { SettingsPage } from "./pages/SettingsPage";
const nav = [
  ["dashboard", "Overview", LayoutDashboard],
  ["live", "Live meeting", AudioLines],
  ["meetings", "My meetings", BookOpen],
  ["summaries", "Summaries", FileText],
  ["quiz-list", "Knowledge tests", BrainCircuit],
  ["rewards", "Rewards", Trophy],
  ["ask-list", "Ask AI", MessageSquare],
] as const;
function route() {
  return location.hash.replace(/^#\/?/, "").split("/");
}
export default function App() {
  const [user, setUser] = useState<Session | null>(session()),
    [path, setPath] = useState(route()),
    [menu, setMenu] = useState(false),
    [theme, setTheme] = useState(
      localStorage.getItem("meetmind-theme") || "dark",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [page, id] = path;
  const go = (p: string) => {
    location.hash = "/" + p;
    setMenu(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const update = () => setPath(route());
    window.addEventListener("hashchange", update);
    const expired = () => {
      localStorage.removeItem("meetmind-session");
      setUser(null);
      setError("Your session expired. Please sign in again.");
      go("login");
    };
    window.addEventListener("session-expired", expired);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("session-expired", expired);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("meetmind-theme", theme);
  }, [theme]);
  const login = (s: Session) => {
    localStorage.setItem("meetmind-session", JSON.stringify(s));
    setUser(s);
    setError("");
    go("dashboard");
  };
  const open = (m: Meeting) =>
    go((m.status === "completed" ? "meeting/" : "live/") + m.id);
  const demo = async () => {
    setBusy(true);
    setError("");
    try {
      if (!session()) {
        const key = crypto.randomUUID();
        const s = await post<Session>("/auth/register", {
          name: "Curious learner",
          email: `demo-${key}@meetmind.local`,
          password: crypto.randomUUID(),
        });
        localStorage.setItem("meetmind-session", JSON.stringify(s));
        setUser(s);
      }
      const m = await post<Meeting>("/meetings", {
        title: "Machine Learning Fundamentals",
        platform: "Sample classroom",
        language: "en",
        consent: true,
        demo: true,
      });
      go("live/" + m.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!user) {
    return (
      <>
        {error && (
          <div className="global-error">
            <ErrorBox message={error} />
          </div>
        )}
        {busy && (
          <div className="blocking">
            <Loading text="Opening the sample workspace…" />
          </div>
        )}
        {page === "login" ? (
          <LoginPage onSession={login} onBack={() => go("")} />
        ) : (
          <LandingPage onStart={() => go("login")} onDemo={() => void demo()} />
        )}
      </>
    );
  }
  return (
    <div className="app-shell">
      <div
        className={"sidebar-scrim " + (menu ? "show" : "")}
        onClick={() => setMenu(false)}
      />
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <button className="plain brand-home" onClick={() => go("dashboard")}>
          <Logo />
        </button>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => go(key)}
              className={
                page === key ||
                (page === "meeting" && key === "meetings") ||
                (page === "quiz" && key === "quiz-list") ||
                (page === "ask" && key === "ask-list")
                  ? "active"
                  : ""
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "live" && <span className="nav-live-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>GOOD IDEAS START HERE</span>
            <p>
              A meeting today.
              <br />A little wiser tomorrow.
            </p>
            <button onClick={() => void demo()}>
              Explore a sample lesson <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={"settings-nav " + (page === "settings" ? "active" : "")}
            onClick={() => go("settings")}
          >
            <Settings size={18} />
            Settings
          </button>
          <div className="profile">
            <span className="avatar">
              {user.user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{user.user.name}</b>
              <small>Personal workspace</small>
            </div>
            <button
              className="plain"
              title="Sign out"
              onClick={() => {
                localStorage.removeItem("meetmind-session");
                setUser(null);
                go("");
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="plain mobile-menu"
              onClick={() => setMenu(!menu)}
              title="Toggle navigation"
            >
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>My workspace</span>
            <ChevronRight size={13} />
            <b>{nav.find((n) => n[0] === page)?.[1] || "Meeting companion"}</b>
          </div>
          <div>
            <span className="workspace-status">
              <span className="dot" /> Your space to grow
            </span>
            <Button variant="outline small-btn" onClick={() => go("live")}>
              <Plus size={14} />
              New meeting
            </Button>
          </div>
        </header>
        <main className="page-content">
          <ErrorBox message={error} />
          {busy ? (
            <Loading text="Opening the sample lesson…" />
          ) : page === "live" ? (
            id ? (
              <LiveMeetingPage
                key={id}
                id={id}
                onFinished={(id) => go("meeting/" + id)}
              />
            ) : (
              <NewMeeting onCreated={open} />
            )
          ) : page === "meetings" || page === "summaries" ? (
            <MeetingsPage summaryOnly={page === "summaries"} onOpen={open} />
          ) : page === "meeting" && id ? (
            <MeetingDetailsPage id={id} onQuiz={() => go("quiz/" + id)} />
          ) : page === "quiz" && id ? (
            <QuizPage id={id} onReview={() => go("meeting/" + id)} />
          ) : page === "rewards" ? (
            <RewardsPage />
          ) : page === "settings" ? (
            <SettingsPage
              theme={theme}
              onTheme={() => setTheme(theme === "dark" ? "light" : "dark")}
            />
          ) : page === "ask" && id ? (
            <MeetingDetailsPage
              id={id}
              onQuiz={() => go("quiz/" + id)}
              askOnly
            />
          ) : page === "quiz-list" || page === "ask-list" ? (
            <MeetingChooser
              mode={page === "quiz-list" ? "quiz" : "ask"}
              onSelect={(m) =>
                go((page === "quiz-list" ? "quiz/" : "ask/") + m.id)
              }
            />
          ) : (
            <DashboardPage
              name={user.user.name}
              onNew={() => go("live")}
              onDemo={() => void demo()}
              onOpen={open}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>MeetMind AI</span>
          <span>A little more clarity, every conversation.</span>
        </footer>
      </div>
    </div>
  );
}
function MeetingChooser({
  mode,
  onSelect,
}: {
  mode: string;
  onSelect: (m: Meeting) => void;
}) {
  const [items, setItems] = useState<Meeting[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Meeting[]>("/meetings")
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);
  const filtered = items.filter((m) => mode === "ask" || m.quizId);
  return (
    <>
      <div className="section-title">
        <div>
          <div className="eyebrow">PICK A CONVERSATION</div>
          <h1>
            {mode === "quiz"
              ? "Your next knowledge check."
              : "What are you curious about?"}
          </h1>
          <p>
            {mode === "quiz"
              ? "Choose a completed meeting with a generated quiz."
              : "Choose the meeting you want to ask about."}
          </p>
        </div>
      </div>
      <ErrorBox message={error} />
      <div className="meeting-grid">
        {filtered.map((m) => (
          <button
            className="meeting-card"
            key={m.id}
            onClick={() => onSelect(m)}
          >
            <BookOpen size={24} />
            <h3>{m.title}</h3>
            <p>
              {mode === "quiz" ? "Take knowledge test" : "Ask MeetMind"}{" "}
              <ArrowUpRight size={16} />
            </p>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <p className="muted">
          Start a meeting and capture some content first. Stop it to create your
          quiz.
        </p>
      )}
    </>
  );
}
