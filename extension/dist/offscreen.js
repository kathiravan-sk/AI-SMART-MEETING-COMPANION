"use strict";
(() => {
  // src/offscreen.ts
  var stream = null;
  var context = null;
  var recorder = null;
  var timer = null;
  var active = false;
  var pending = Promise.resolve();
  async function stop() {
    active = false;
    if (timer) clearTimeout(timer);
    if (recorder?.state === "recording") {
      const r = recorder;
      await new Promise((resolve) => {
        r.addEventListener("stop", () => resolve(), { once: true });
        r.stop();
      });
    }
    await pending;
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    await context?.close();
    context = null;
  }
  chrome.runtime.onMessage.addListener((m, _sender, reply) => {
    if (m.target !== "offscreen") return;
    (async () => {
      if (m.type === "STOP_AUDIO") {
        await stop();
        return { ok: true };
      }
      if (m.type !== "START_AUDIO") return { error: "Unknown request" };
      await stop();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: m.streamId
          }
        },
        video: false
      });
      context = new AudioContext();
      context.createMediaStreamSource(stream).connect(context.destination);
      active = true;
      const current = stream;
      current.getTracks().forEach(
        (t) => t.onended = () => {
          if (active) {
            void stop();
            void chrome.storage.local.set({
              captureError: "Tab audio ended. Start capture again when ready."
            });
            void chrome.storage.local.remove("capture");
          }
        }
      );
      const segment = () => {
        if (!active) return;
        const r = new MediaRecorder(current, { mimeType: "audio/webm" });
        recorder = r;
        const chunks = [];
        r.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        r.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          if (blob.size > 1e3)
            pending = pending.then(async () => {
              const form = new FormData();
              form.append("file", blob, "segment.webm");
              const headers = { Authorization: `Bearer ${m.token}` };
              const response = await fetch(
                m.apiUrl + `/meetings/${m.meetingId}/audio`,
                { method: "POST", headers, body: form }
              );
              if (!response.ok)
                throw new Error(
                  "Audio transcription failed. Check the backend."
                );
              const result = await response.json();
              if (result.text.trim()) {
                const r2 = await fetch(
                  m.apiUrl + `/meetings/${m.meetingId}/transcript`,
                  {
                    method: "POST",
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      text: result.text,
                      speaker: "Tab audio",
                      clientId: crypto.randomUUID(),
                      language: ["en", "ta", "ml", "hi"].includes(
                        result.language
                      ) ? result.language : m.language
                    })
                  }
                );
                if (!r2.ok) throw new Error("Transcript could not be saved.");
                await chrome.storage.local.set({
                  lastCaptureAt: Date.now(),
                  captureError: ""
                });
              }
            }).catch(
              (e) => chrome.storage.local.set({
                captureError: e.message + " This audio segment was not saved; check your connection."
              })
            );
          if (active) segment();
        };
        r.start();
        timer = setTimeout(() => {
          if (r.state === "recording") r.stop();
        }, 8e3);
      };
      segment();
      return { ok: true };
    })().then(reply).catch((e) => reply({ error: e.message }));
    return true;
  });
})();
