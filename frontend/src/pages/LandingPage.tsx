import {
  ArrowRight,
  AudioLines,
  BrainCircuit,
  Check,
  Globe2,
  MessageSquare,
  Sparkles,
  Trophy,
  ShieldCheck,
  Play,
  CheckCheck,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Logo, Button } from "../components/UI";
export function LandingPage({
  onStart,
  onDemo,
}: {
  onStart: () => void;
  onDemo: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Logo />
        <div className="landing-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#privacy">Built for trust</a>
        </div>
        <Button onClick={onStart} variant="outline">
          Open workspace <ArrowRight size={16} />
        </Button>
      </nav>
      <main>
        <section className="hero">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="hero-tag">
              <span className="dot" /> A little more clarity. A lot more
              possibility.
            </div>
            <h1>
              Be in the moment.
              <br />
              <span>Keep the knowledge.</span>
            </h1>
            <p>
              Your meetings, understood. Turn conversations into clear notes,
              <br className="desktop-only" /> thoughtful answers, and knowledge
              that stays with you.
            </p>
            <div className="hero-actions">
              <Button onClick={onStart}>
                Start your workspace <ArrowRight size={18} />
              </Button>
              <Button onClick={onDemo} variant="outline">
                <Play size={15} /> Explore the demo
              </Button>
            </div>
            <div className="hero-checks">
              <span>
                <Check size={14} /> Four languages
              </span>
              <span>
                <Check size={14} /> Your notes, your control
              </span>
              <span>
                <Check size={14} /> Built for learning
              </span>
            </div>
          </motion.div>
          <motion.div
            className="hero-preview"
            initial={reduce ? false : { opacity: 0, y: 35 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.7 }}
          >
            <div className="preview-top">
              <Logo small />
              <span className="pill live">
                <span className="dot" /> Live meeting
              </span>
              <span className="muted">Illustrative workspace preview</span>
            </div>
            <div className="preview-grid">
              <div className="preview-transcript">
                <div className="eyebrow">A CONVERSATION BECOMES CLARITY</div>
                <h3>Machine Learning Fundamentals</h3>
                <div className="wave">
                  {Array.from({ length: 48 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height: 8 + ((i * 17) % 32),
                        animationDelay: `${i * 0.06}s`,
                      }}
                    />
                  ))}
                </div>
                <div className="transcript-row">
                  <span className="avatar">AK</span>
                  <div>
                    <b>
                      Speaker <small>10:24 AM</small>
                    </b>
                    <p>
                      Supervised learning uses labelled datasets for training.
                      Think of it as learning with a teacher.
                    </p>
                  </div>
                </div>
                <div className="transcript-row">
                  <span className="avatar cyan">
                    <AudioLines size={17} />
                  </span>
                  <div>
                    <b>MeetMind is listening</b>
                    <p className="muted">
                      Making room for your next great idea…
                    </p>
                  </div>
                </div>
              </div>
              <div className="preview-summary">
                <div className="summary-heading">
                  <Sparkles size={18} />
                  <b>The important things</b>
                  <span className="tiny-pill">AI NOTES</span>
                </div>
                <div className="mini-note">
                  <span>01</span>
                  <p>Supervised learning learns from labelled data.</p>
                </div>
                <div className="mini-note">
                  <span>02</span>
                  <p>
                    Examples connect a concept to its real-world application.
                  </p>
                </div>
                <div className="preview-insight">
                  <BrainCircuit size={20} />
                  <div>
                    <b>Don't just remember. Understand.</b>
                    <p>Turn key ideas into a knowledge check.</p>
                  </div>
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>
          </motion.div>
        </section>
        <section className="feature-section" id="features">
          <div className="eyebrow">FROM LISTENING TO LEARNING</div>
          <h2>
            Everything you need.
            <br />
            Right beside the conversation.
          </h2>
          <div className="feature-grid">
            {[
              [
                AudioLines,
                "Catch every important word",
                "Capture captions, use your microphone, or transcribe shared tab audio.",
              ],
              [
                Sparkles,
                "Make sense of it, live",
                "Get evolving summaries, decisions and action items as your meeting unfolds.",
              ],
              [
                MessageSquare,
                "A little context goes a long way",
                "Ask a question and trace the answer back to the discussion.",
              ],
              [
                BrainCircuit,
                "Make knowledge stick",
                "Practice with questions grounded in what was actually discussed.",
              ],
              [
                Globe2,
                "Learn in your language",
                "Switch between English, Tamil, Malayalam and Hindi.",
              ],
              [
                Trophy,
                "See yourself grow",
                "Earn XP and badges, and build a steady learning habit.",
              ],
            ].map(([Icon, title, body], i) => {
              const I = Icon as typeof AudioLines;
              return (
                <article className="feature-card" key={i}>
                  <I size={23} />
                  <h3>{title as string}</h3>
                  <p>{body as string}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section className="how-section" id="how">
          <h2>Listen. Understand. Learn.</h2>
          <div>
            {[
              "Start a meeting with permission",
              "Capture the conversation",
              "Leave with notes and new knowledge",
            ].map((s, i) => (
              <p key={s}>
                <span>0{i + 1}</span>
                {s}
                <CheckCheck size={18} />
              </p>
            ))}
          </div>
        </section>
        <section className="privacy-banner" id="privacy">
          <ShieldCheck size={30} />
          <div>
            <h3>Your conversations belong to you.</h3>
            <p>
              Capture starts only when you choose. Export your notes or delete
              your meeting and its derived content.
            </p>
          </div>
          <Button onClick={onStart} variant="outline">
            Let's begin <ArrowRight size={16} />
          </Button>
        </section>
      </main>
      <footer>
        <Logo small />
        <span>Listen. Understand. Learn.</span>
        <span>MeetMind AI · An independent learning companion</span>
      </footer>
    </div>
  );
}
