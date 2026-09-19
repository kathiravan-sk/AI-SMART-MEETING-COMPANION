import { useEffect, useState } from "react";
import { ShieldCheck, Sun, Moon, Trash2, ExternalLink } from "lucide-react";
import { api } from "../services/api";
import { SectionTitle, Button, ErrorBox, Pill } from "../components/UI";
export function SettingsPage({
  theme,
  onTheme,
}: {
  theme: string;
  onTheme: () => void;
}) {
  const [health, setHealth] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    api<Record<string, string>>("/health")
      .then(setHealth)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <SectionTitle
        eyebrow="MAKE IT YOURS"
        title="A workspace that works for you."
      >
        Your preferences, connections, and privacy controls.
      </SectionTitle>
      <ErrorBox message={error} />
      {notice && <div className="notice">{notice}</div>}
      <div className="settings-grid">
        <section className="panel settings-card">
          <h2>Appearance</h2>
          <p>Choose the space that helps you focus.</p>
          <Button variant="outline" onClick={onTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}Switch to{" "}
            {theme === "dark" ? "light" : "dark"} mode
          </Button>
        </section>
        <section className="panel settings-card">
          <h2>Connected services</h2>
          <div className="settings-line">
            <span>AI provider</span>
            <Pill>{health.aiProvider || "Connecting…"}</Pill>
          </div>
          <div className="settings-line">
            <span>Database</span>
            <span>{health.database || "—"}</span>
          </div>
          <div className="settings-line">
            <span>Server transcription</span>
            <span>{health.speech || "—"}</span>
          </div>
          <p className="small-text">
            Configure providers in backend/.env, then restart the server. API
            keys stay on the backend.
          </p>
        </section>
        <section className="panel settings-card">
          <h2>
            <ShieldCheck size={21} /> Privacy & capture
          </h2>
          <p>
            Only capture meetings with participant permission. Starting a
            meeting does not automatically enable your microphone or tab audio.
          </p>
          <p>
            Cloud AI providers receive the transcript context needed for the
            requested operation. Browser speech recognition may use your browser
            vendor's servers. Use Ollama and faster-whisper for local
            processing.
          </p>
        </section>
        <section className="panel settings-card">
          <h2>Chrome companion</h2>
          <p>
            Keep MeetMind beside your meeting with the Chrome side-panel
            extension.
          </p>
          <ol>
            <li>
              Build the project with <code>npm run build</code>.
            </li>
            <li>
              Open <code>chrome://extensions</code>.
            </li>
            <li>
              Enable Developer mode → Load unpacked → select{" "}
              <code>extension/dist</code>.
            </li>
            <li>Sign in using this account, then start capture.</li>
          </ol>
          <a
            href="https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked"
            target="_blank"
            rel="noreferrer"
          >
            Chrome installation guide <ExternalLink size={13} />
          </a>
        </section>
        <section className="panel settings-card danger-card">
          <h2>Clear meeting history</h2>
          <p>
            Delete all of your meetings, transcripts, quizzes, attempts and
            associated rewards. This action cannot be undone.
          </p>
          <Button
            variant="outline danger"
            onClick={async () => {
              if (
                !confirm("Permanently delete ALL meeting content and rewards?")
              )
                return;
              try {
                await api("/users/me/history", { method: "DELETE" });
                setNotice("Your meeting history has been cleared.");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Trash2 size={16} />
            Clear all history
          </Button>
        </section>
      </div>
    </>
  );
}
