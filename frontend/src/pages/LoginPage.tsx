import { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import type { Session } from "../../../shared/types";
import { post } from "../services/api";
import { Logo, Button, ErrorBox } from "../components/UI";

type GoogleCredentialResponse = { credential: string };
type GoogleClient = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        callback(response: GoogleCredentialResponse): void;
      }): void;
      renderButton(element: HTMLElement, options: Record<string, string>): void;
    };
  };
};
declare global {
  interface Window {
    google?: GoogleClient;
  }
}

const googleClientId = (import.meta as unknown as { env: Record<string, string> })
  .env.VITE_GOOGLE_CLIENT_ID;
export function LoginPage({
  onSession,
  onBack,
}: {
  onSession: (s: Session) => void;
  onBack: () => void;
}) {
  const [register, setRegister] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const googleButton = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!googleClientId || !googleButton.current) return;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          setBusy(true);
          setError("");
          void post<Session>("/auth/google", response)
            .then(onSession)
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        },
      });
      googleButton.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: "outline",
        size: "large",
        width: "360",
        text: "signin_with",
      });
    };
    if (window.google) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    document.head.appendChild(script);
    return () => script.remove();
  }, [onSession]);
  return (
    <div className="auth-page">
      <div className="auth-story">
        <button className="plain" onClick={onBack}>
          <Logo />
        </button>
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Good conversations.
            <br />
            <span>Lasting knowledge.</span>
          </h1>
          <p>
            A calmer space to listen, connect ideas,
            <br />
            and learn something that stays.
          </p>
        </div>
        <span className="muted">
          <ShieldCheck size={17} /> Thoughtfully built. Always in your control.
        </span>
      </div>
      <div className="auth-form">
        <div className="eyebrow">WELCOME TO MEETMIND</div>
        <h2>{register ? "Make room for better learning." : "Welcome back."}</h2>
        <p>
          {register
            ? "Create your account to start your first meeting."
            : "Your notes and next ideas are waiting for you."}
        </p>
        {googleClientId && <div ref={googleButton} className="google-button" />}
        {googleClientId && <div className="auth-divider">or use email</div>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              onSession(
                await post<Session>(
                  "/auth/" + (register ? "register" : "login"),
                  Object.fromEntries(form),
                ),
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Your name
              <input
                name="name"
                placeholder="Kathiravan"
                required
                maxLength={60}
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={128}
              placeholder="At least 8 characters"
              required
              autoComplete={register ? "new-password" : "current-password"}
            />
          </label>
          <ErrorBox message={error} />
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </Button>
        </form>
        <p className="small-text">
          {register ? "Already have an account?" : "New here?"}{" "}
          <button
            className="text-button"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}
