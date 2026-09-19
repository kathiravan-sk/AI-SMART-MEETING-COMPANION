# Validation report

## Verified in this build

- **24 backend tests passed** under Python 3.12. These run against a fresh, isolated SQLite database and the demo provider.
- TypeScript compilation and Vite production builds passed for **both frontend and extension**.
- Browser smoke flow passed in a local Chromium instance with **zero uncaught browser errors**:
  - Account registration and dashboard entry.
  - Sample lesson's eight timed transcript segments.
  - Meeting pause/resume.
  - English → Tamil → Malayalam → Hindi → English notes.
  - Meeting-grounded question answering with expandable transcript sources.
  - Meeting stop, final notes and automatic quiz creation.
  - Eight-question quiz with exactly 4 correct answers: **50% pass, +50 XP**.
  - Reward page consistency.
  - Desktop, tablet (768 px) and mobile (390 px) dashboard layouts with no document-level horizontal overflow.
  - Mobile navigation and light-theme settings.
- Screenshots captured from the actual application are included in `docs/screenshots/`.

## Backend coverage

The integration suite checks original transcript preservation across translations, unknown-topic abstention, answer-key stripping from the quiz API, transcript idempotency, pause/stop enforcement, consent validation, cross-user access rejection, authenticated WebSocket access, all XP boundaries, exact 50% passing, retake reward differences, short-answer normalization, source-ID validation, export, and cascaded deletion of transcripts/quizzes/attempts/rewards.

Mocked HTTP contract checks cover OpenAI, Gemini and Ollama request serialization/JSON parsing. Additional tests verify that real-provider summarization receives only new chunks and that translation always starts from canonical content.

These mocked checks do **not** constitute live provider/model validation.

## Not verified here

- Actual Google Meet, Teams, Zoom Web and YouTube DOM capture. Selectors are best-effort and can change.
- Real microphone and tab-audio permission flows inside the unpacked Chrome extension.
- Live cloud AI calls using a real key, or a running Ollama model.
- faster-whisper model download, real audio recognition accuracy, latency or sustained throughput.
- A running MongoDB instance / Docker Desktop. The MongoDB adapter and Compose configuration are included; the integration suite uses SQLite.
- Native Windows execution of the `.bat` scripts. Manual Windows setup commands are provided as a fallback.
- Linguistic review of Tamil/Malayalam/Hindi by native speakers.
- Production security, load, multi-worker operation or Chrome Web Store publication.

## Reproduce

From the project root:

```bash
npm install
npm run typecheck
npm run build
python -m pytest -q backend/tests
```

Use a Python environment with `backend/requirements.txt` installed. For browser checks, start the backend and frontend in two terminals, then:

```bash
npx playwright install chromium
npm run test:ui
```

The browser test creates a dedicated test account and sample meeting on the configured **local default backend**, and writes screenshots. Do not point it at a shared production database. A `CHROMIUM_PATH` environment variable can select an existing Chromium executable.

## Runtime notes

The regular browser download was unavailable in the build environment. A packaged local Chromium was used instead, with local font configuration. Renderer and font setup issues were resolved before the successful browser test. Screenshots show sample content only.

Two dependency deprecation warnings appeared during Python tests (Starlette test client / AnyIO aliases); they did not fail the tests. Vite emitted third-party Framer Motion `use client` directive notices during bundling; production bundles were generated successfully.
