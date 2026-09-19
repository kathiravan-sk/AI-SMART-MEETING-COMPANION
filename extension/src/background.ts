export {};
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
type Capture = {
  meetingId: string;
  tabId: number;
  mode: "captions" | "audio";
  language: string;
  selector?: string;
  accepting: boolean;
};
let queue: Promise<unknown> = Promise.resolve();
async function api(path: string, body: unknown) {
  const { token, apiUrl = "http://localhost:8000" } =
    await chrome.storage.local.get(["token", "apiUrl"]);
  const r = await fetch(apiUrl + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const out = await r.json();
    throw new Error(
      typeof out.detail === "string"
        ? out.detail
        : `Request failed ${r.status}`,
    );
  }
  return r.json();
}
async function sendChunk(capture: Capture, text: string) {
  const item = {
    path: `/meetings/${capture.meetingId}/transcript`,
    body: {
      text,
      speaker: "Caption speaker",
      language: capture.language,
      clientId: crypto.randomUUID(),
    },
  };
  try {
    await api(item.path, item.body);
    await chrome.storage.local.set({
      lastCaptureAt: Date.now(),
      captureError: "",
    });
  } catch (e) {
    const { unsent = [] } = await chrome.storage.local.get("unsent");
    await chrome.storage.local.set({
      unsent: [...unsent, item].slice(-100),
      captureError:
        "A caption could not be saved. Retry pending captions before stopping. " +
        (e as Error).message,
    });
  }
}
async function stopCapture() {
  const { capture } = (await chrome.storage.local.get("capture")) as {
    capture?: Capture;
  };
  if (!capture) return;
  await chrome.storage.local.set({ capture: { ...capture, accepting: false } });
  if (capture.mode === "captions") {
    await chrome.tabs
      .sendMessage(capture.tabId, { type: "STOP_CAPTIONS" })
      .catch(() => {});
  } else if (await chrome.offscreen.hasDocument()) {
    const r = await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "STOP_AUDIO",
    });
    if (r?.error) throw new Error(r.error);
    await chrome.offscreen.closeDocument();
  }
  await queue;
  await chrome.storage.local.remove("capture");
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.target === "offscreen") return;
  // Content scripts can submit text only for their authorized source tab.
  if (message.type === "CAPTION") {
    queue = queue
      .then(async () => {
        const { capture } = (await chrome.storage.local.get("capture")) as {
          capture?: Capture;
        };
        if (
          capture?.accepting &&
          capture.mode === "captions" &&
          sender.tab?.id === capture.tabId &&
          typeof message.text === "string" &&
          message.text.length <= 6000
        )
          await sendChunk(capture, message.text);
      })
      .catch(async (e) => {
        await chrome.storage.local.set({ captureError: (e as Error).message });
      });
    queue.then(() => respond({ ok: true }));
    return true;
  }
  if (sender.tab || sender.id !== chrome.runtime.id) return;
  (async () => {
    if (message.type === "STOP_CAPTURE") {
      await stopCapture();
      return { ok: true };
    }
    if (message.type === "RETRY_PENDING") {
      const { unsent = [] } = await chrome.storage.local.get("unsent");
      const failed = [];
      for (const item of unsent) {
        try {
          await api(item.path, item.body);
        } catch {
          failed.push(item);
        }
      }
      await chrome.storage.local.set({
        unsent: failed,
        captureError: failed.length
          ? "Some captions are still pending. Resume the meeting and retry."
          : "",
      });
      return { ok: true };
    }
    if (message.type === "START_CAPTURE") {
      await stopCapture();
      const { apiUrl = "http://localhost:8000", token } =
        await chrome.storage.local.get(["apiUrl", "token"]);
      if (!token) throw new Error("Sign in first");
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs[0];
      if (!tab?.id) throw new Error("Open a meeting tab first");
      const capture: Capture = {
        meetingId: message.meetingId,
        tabId: tab.id,
        mode: message.mode,
        language: message.language,
        selector: message.selector,
        accepting: true,
      };
      if (capture.mode === "captions") {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        await chrome.storage.local.set({
          capture,
          captureError: "",
          lastCaptureAt: null,
        });
        const result = await chrome.tabs.sendMessage(tab.id, {
          type: "START_CAPTIONS",
          selector: message.selector,
        });
        if (result?.error) {
          await chrome.storage.local.remove("capture");
          throw new Error(result.error);
        }
      } else {
        const h = await fetch(apiUrl + "/health").then((r) => r.json());
        if (h.speech !== "faster-whisper")
          throw new Error(
            "Enable faster-whisper in the backend before using tab audio.",
          );
        if (!(await chrome.offscreen.hasDocument()))
          await chrome.offscreen.createDocument({
            url: "offscreen.html",
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification:
              "Transcribe the meeting tab audio after the user explicitly starts capture.",
          });
        try {
          const streamId = await new Promise<string>((resolve, reject) =>
            chrome.tabCapture.getMediaStreamId(
              { targetTabId: tab.id },
              (id) => {
                if (chrome.runtime.lastError)
                  reject(new Error(chrome.runtime.lastError.message));
                else resolve(id);
              },
            ),
          );
          const result = await chrome.runtime.sendMessage({
            target: "offscreen",
            type: "START_AUDIO",
            streamId,
            apiUrl,
            token,
            meetingId: message.meetingId,
            language: message.language,
          });
          if (result?.error) throw new Error(result.error);
          await chrome.storage.local.set({
            capture,
            captureError: "",
            lastCaptureAt: null,
          });
        } catch (e) {
          if (await chrome.offscreen.hasDocument())
            await chrome.offscreen.closeDocument();
          throw e;
        }
      }
      return { ok: true };
    }
    return { error: "Unknown request" };
  })()
    .then(respond)
    .catch((e) => respond({ error: (e as Error).message }));
  return true;
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { capture } = await chrome.storage.local.get("capture");
  if (capture?.tabId === tabId) {
    await stopCapture().catch(() => {});
    await chrome.storage.local.set({
      captureError:
        "The captured tab was closed. Your saved transcript is still available.",
    });
  }
});
