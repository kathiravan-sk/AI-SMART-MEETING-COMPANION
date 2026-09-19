# Engineering notes

## Boundaries

The dashboard and extension share TypeScript data contracts, but communicate only through authenticated backend endpoints. The extension never stores cloud AI keys. An explicit side-panel action injects the caption adapter into the selected tab; audio capture lives in a Manifest V3 offscreen document. The dashboard offers separate microphone, shared-tab audio and manual text inputs.

The FastAPI application coordinates requests, ownership, capture state and asynchronous summary updates. AIProvider, SpeechProvider and TranslationService isolate replaceable external engines. The database adapter keeps the same document shape across the persistent SQLite demo and MongoDB.

## Data ownership

Every meeting and quiz stores a `userId`. All corresponding routes resolve that ownership before reading or mutating content. WebSockets require a JWT in the first frame, validate meeting ownership, and recheck on heartbeats. Nested transcript/summary/question data cannot be fetched through a separate unscoped route.

Meeting transcript originals are immutable after ingestion except explicit deletion. Each request supplies a unique `clientId`; retries return the existing chunk. A meeting has a lifecycle `live → paused → live → completed`. Completed sessions do not resume. The stop endpoint persists the completed state even when AI processing fails.

Transcript deletion removes the canonical summary, translations, quiz and attempts to avoid preserving derived private content. Full meeting deletion cascades through quiz/attempt records. Rewards are computed from surviving attempts.

## Incremental context

New transcript windows are combined with the rolling summary. The summary keeps bounded key points, concepts and questions. Full-transcript finalization means flushing every previously unprocessed chunk, not sending the entire raw meeting in one context request.

Questions are validated with Pydantic and must reference known transcript IDs. Invalid answer indices, repeated question wording and nonexistent source IDs are rejected. Semantic entailment is still dependent on the model; source-ID validation alone is not proof of factual correctness.

Query retrieval uses Unicode token overlap. It is deliberately transparent and requires no embedding key or vector database. The included multilingual lesson augments each source with its prepared language variants. Future production work should add multilingual embeddings, reranking and evidence verification.

## Concurrency and recovery

One backend process owns per-meeting locks. Summary work acquires the same lock as writes to avoid overwriting concurrent transcript changes. Transcript persistence occurs before processing; a failed AI call leaves its processing cursor unchanged so it can be retried. Clients receive update notifications and fetch current state.

The extension serializes caption writes and retains failed caption bodies for retry with their original idempotency key. Audio recording creates independent WebM files rather than treating MediaRecorder timeslice fragments as standalone files. Audio transcription is serialized. For production, bounded durable audio queues, retry storage, worker pools, vector stores and shared locks are needed.

## Reward invariants

All scores are computed against server-held questions. Quiz copies omit answer keys for the test interface. Study mode reveals answers intentionally. The best XP entitlement per quiz is monotonic while its attempts exist. A retake receives only a positive entitlement difference. Dashboard totals recompute best entitlements, protecting totals from duplicate submissions.

## Scaling boundary

The document adapter uses synchronous database operations suited to an MVP. Meetings embed their transcripts within explicit size limits. In-process locks, subscriber sets and rate limiting require a single worker. MongoDB deployment is wired but needs a local integration run with MongoDB before use; real AI and STT also require local credential/device validation.
