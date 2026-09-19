"use strict";
(() => {
  // src/content.ts
  var w = window;
  if (!w.__meetmindLoaded) {
    w.__meetmindLoaded = true;
    let observer = null;
    let timer = null;
    let selector = "";
    let active = false;
    let last = "";
    const seen = /* @__PURE__ */ new Map();
    const defaults = [
      ".ytp-caption-window-container .caption-visual-line",
      '[data-tid="closed-caption-text"]',
      '[data-tid="closed-caption-container"] [data-tid="caption-text"]',
      ".live-transcription-subtitle__item",
      '[jsname="tgaKEf"]',
      "[data-message-text]"
    ].join(",");
    const collect = () => {
      if (!active) return;
      const nodes = Array.from(document.querySelectorAll(selector || defaults));
      const text = nodes.slice(-4).map((n) => n.textContent?.trim() || "").filter(Boolean).join(" ").slice(0, 6e3);
      if (!text || text === last) return;
      last = text;
      const stamp = Date.now();
      if (stamp - (seen.get(text) || 0) < 15e3) return;
      seen.set(text, stamp);
      for (const [k, t] of seen) if (stamp - t > 6e4) seen.delete(k);
      chrome.runtime.sendMessage({ type: "CAPTION", text }).catch(() => {
      });
    };
    const stop = () => {
      active = false;
      observer?.disconnect();
      observer = null;
      if (timer) clearTimeout(timer);
      last = "";
    };
    chrome.runtime.onMessage.addListener((m, _sender, reply) => {
      if (m.type === "START_CAPTIONS") {
        stop();
        selector = m.selector || "";
        try {
          document.querySelector(selector || defaults);
        } catch {
          reply({ error: "Invalid CSS caption selector" });
          return;
        }
        active = true;
        seen.clear();
        observer = new MutationObserver(() => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(collect, 800);
        });
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true
        });
        collect();
        reply({ ok: true });
      } else if (m.type === "STOP_CAPTIONS") {
        stop();
        reply({ ok: true });
      }
    });
  }
})();
