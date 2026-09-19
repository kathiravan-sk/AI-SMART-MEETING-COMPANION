import { useEffect, useRef, useState } from "react";
import { api, post } from "../services/api";
import { speechLocales, type Language } from "../../../shared/types";
// The Web Speech API is not available in every browser. It captures the microphone, not remote meeting audio.
export function useCapture(
  id: string | undefined,
  language: Language,
  onUpdate: () => void,
  onError: (s: string) => void,
) {
  const [mode, setMode] = useState<"off" | "microphone" | "tab">("off");
  const speech = useRef<any>(null),
    stream = useRef<MediaStream | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    active = useRef(false),
    pending = useRef<Promise<unknown>>(Promise.resolve());
  const send = async (text: string, lang = language) => {
    if (!id || !text.trim()) return;
    await post(`/meetings/${id}/transcript`, {
      text,
      language: lang,
      speaker: "Speaker",
      clientId: crypto.randomUUID(),
    });
    onUpdate();
  };
  const enqueue = (fn: () => Promise<void>) => {
    pending.current = pending.current
      .then(fn)
      .catch((e) => onError((e as Error).message));
  };
  const stop = async () => {
    active.current = false;
    if (timer.current) clearTimeout(timer.current);
    if (speech.current) {
      const s = speech.current;
      await new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (!finished) {
            finished = true;
            resolve();
          }
        };
        s.addEventListener("end", done, { once: true });
        setTimeout(done, 1500);
        try {
          s.stop();
        } catch {
          done();
        }
      });
    }
    speech.current = null;
    if (recorder.current?.state === "recording") {
      const r = recorder.current;
      await new Promise<void>((resolve) => {
        r.addEventListener("stop", () => resolve(), { once: true });
        r.stop();
      });
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setMode("off");
    await pending.current;
  };
  useEffect(
    () => () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      speech.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [id],
  );
  const microphone = async () => {
    const Speech =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Speech) {
      onError(
        "Browser speech recognition is unavailable. Use tab audio with server transcription or paste transcript.",
      );
      return;
    }
    await stop();
    const s = new Speech();
    speech.current = s;
    active.current = true;
    s.lang = speechLocales[language];
    s.continuous = true;
    s.interimResults = false;
    s.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal)
          enqueue(() => send(event.results[i][0].transcript));
    };
    s.onerror = (e: any) => {
      onError("Microphone recognition: " + e.error);
      active.current = false;
      setMode("off");
    };
    s.onend = () => {
      if (active.current) {
        try {
          s.start();
        } catch {
          active.current = false;
          setMode("off");
        }
      }
    };
    s.start();
    setMode("microphone");
  };
  const tab = async () => {
    await stop();
    try {
      const health = await api<{ speech: string }>("/health");
      if (health.speech !== "faster-whisper")
        throw new Error(
          "Tab audio needs faster-whisper. Follow README → Server transcription, then restart the backend.",
        );
      const s = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      if (!s.getAudioTracks().length) {
        s.getTracks().forEach((t) => t.stop());
        throw new Error(
          "No audio shared. Choose a browser tab and enable Share tab audio.",
        );
      }
      stream.current = s;
      active.current = true;
      setMode("tab");
      s.getVideoTracks()[0].onended = () => void stop();
      const segment = () => {
        if (!active.current) return;
        const r = new MediaRecorder(new MediaStream(s.getAudioTracks()), {
          mimeType: "audio/webm",
        });
        recorder.current = r;
        const chunks: Blob[] = [];
        r.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        r.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size > 1000)
            enqueue(async () => {
              const form = new FormData();
              form.append("file", blob, "segment.webm");
              const out = await api<{ text: string; language: Language }>(
                `/meetings/${id}/audio`,
                { method: "POST", body: form },
              );
              await send(
                out.text,
                ["en", "ta", "ml", "hi"].includes(out.language)
                  ? out.language
                  : language,
              );
            });
          if (active.current) segment();
        };
        r.start();
        timer.current = setTimeout(() => {
          if (r.state === "recording") r.stop();
        }, 8000);
      };
      segment();
    } catch (e) {
      onError((e as Error).message);
      await stop();
    }
  };
  return { mode, stop, microphone, tab };
}
export function voiceQuestion(
  language: Language,
  onText: (s: string) => void,
  onError: (s: string) => void,
) {
  const Speech =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Speech) {
    onError(
      "Voice questions need a browser with SpeechRecognition support. You can type your question instead.",
    );
    return;
  }
  const s = new Speech();
  s.lang = speechLocales[language];
  s.onresult = (e: any) => onText(e.results[0][0].transcript);
  s.onerror = (e: any) => onError("Voice input: " + e.error);
  s.start();
}
