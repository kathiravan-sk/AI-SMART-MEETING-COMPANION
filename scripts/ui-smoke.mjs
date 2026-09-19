/** Run against the development servers: npm run test:ui.
 * Optional CHROMIUM_PATH points to a locally installed browser executable.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const output = resolve("docs/screenshots");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: process.env.CHROMIUM_PATH
    ? [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
      ]
    : [],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
try {
  await page.goto("http://127.0.0.1:5173");
  await page.getByRole("heading", { name: /Be in the moment/ }).waitFor();
  await page.screenshot({
    path: resolve(output, "01-landing.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start your workspace" }).click();
  await page.getByLabel("Your name").fill("Kathiravan");
  await page.getByLabel("Email address").fill(`ui-${Date.now()}@test.dev`);
  await page.getByLabel("Password").fill("meetmind-test-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("heading", { name: /A clearer day/ }).waitFor();
  await page.getByRole("button", { name: "Try the sample lesson" }).click();
  await page.getByRole("button", { name: "Play sample lesson" }).click();
  await page
    .getByRole("button", { name: "Lesson complete" })
    .waitFor({ timeout: 60000 });
  await page.screenshot({
    path: resolve(output, "02-live-workspace.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).waitFor();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  for (const lang of ["ta", "ml", "hi", "en"]) {
    await page.getByLabel("Display language").selectOption(lang);
    await page.waitForFunction((lang) => {
      const text = document.querySelector(".summary-body")?.textContent || "";
      return lang === "ta"
        ? text.includes("இயந்திர")
        : lang === "ml"
          ? text.includes("മെഷീൻ")
          : lang === "hi"
            ? text.includes("मशीन")
            : text.includes("Machine learning");
    }, lang);
  }
  await page
    .getByLabel("Ask MeetMind")
    .fill("What does supervised learning use?");
  await page.getByRole("button", { name: "Send question" }).click();
  await page.locator(".assistant-bubble").waitFor({ timeout: 15000 });
  assert(
    (await page.locator(".assistant-bubble").innerText()).includes("labelled"),
    "Q&A should cite labelled data",
  );
  await page.locator(".sources summary").click();
  assert(
    (await page.locator(".sources blockquote").count()) > 0,
    "Answer requires source context",
  );
  const meetingId = await page.evaluate(() => location.hash.split("/").at(-1));
  await page.getByRole("button", { name: "Stop meeting" }).click();
  await page
    .getByRole("button", { name: "Take knowledge test" })
    .waitFor({ timeout: 15000 });
  await page.screenshot({
    path: resolve(output, "03-meeting-summary.png"),
    fullPage: true,
  });
  const questions = await page.evaluate(async (id) => {
    const token = JSON.parse(localStorage.getItem("meetmind-session")).token;
    return fetch(`http://localhost:8000/meetings/${id}/questions`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
  }, meetingId);
  await page.getByRole("button", { name: "Take knowledge test" }).click();
  await page.locator(".quiz-options button").first().waitFor();
  await page.screenshot({
    path: resolve(output, "04-knowledge-test.png"),
    fullPage: true,
  });
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i],
      choice = i < 4 ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
    await page.locator(".quiz-options button").nth(choice).click();
    await page
      .getByRole("button", {
        name:
          i === questions.length - 1
            ? "Finish knowledge test"
            : "Next question",
      })
      .click();
  }
  await page
    .getByRole("heading", { name: "That knowledge is yours." })
    .waitFor();
  assert(
    (await page.locator(".score").innerText()).includes("50"),
    "Exactly half should score 50%",
  );
  assert(
    (await page.locator(".reward-chip").innerText()).includes("+50 XP"),
    "50% earns Starter XP",
  );
  await page.screenshot({
    path: resolve(output, "05-quiz-result.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Rewards", exact: true }).click();
  await page
    .getByRole("heading", { name: "Your curiosity is paying off." })
    .waitFor();
  await page.getByRole("heading", { name: "Level 1 · 50 XP" }).waitFor();
  await page.screenshot({
    path: resolve(output, "06-rewards.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("heading", { name: /A clearer day/ }).waitFor();
  await page.screenshot({
    path: resolve(output, "07-dashboard.png"),
    fullPage: true,
  });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({
      path: resolve(output, `08-dashboard-${width}.png`),
      fullPage: true,
    });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "Dashboard horizontal overflow at " + width,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("heading", { name: "A workspace that works for you." })
    .waitFor();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: resolve(output, "09-settings-mobile-light.png"),
    fullPage: true,
  });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Settings horizontal overflow",
  );
  assert(errors.length === 0, "Browser errors: " + errors.join("; "));
  console.log(
    JSON.stringify({
      status: "passed",
      screenshots: output,
      checks: [
        "Registration",
        "Timed transcript",
        "Pause/resume",
        "Four-language notes",
        "Grounded Q&A",
        "Meeting stop",
        "Quiz 50% pass",
        "Rewards",
        "Desktop/mobile/tablet overflow",
        "Light theme",
      ],
      browserErrors: errors,
    }),
  );
} finally {
  await browser.close();
}
