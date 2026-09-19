# A five-minute project demonstration

1. Open the landing page. Explain: **“MeetMind AI helps a user listen, understand and learn from a meeting.”**
2. Create an account, or choose Explore the demo for a temporary local account.
3. Start the sample Machine Learning lesson and click Play sample lesson. Point out that this is clearly labelled demo content, not a captured live call.
4. Watch the original transcript arrive and the summary change. Explain that only new chunks and the previous rolling summary are sent to AI when a real provider is configured.
5. Switch to Tamil, Malayalam, Hindi and back to English. Show that the original transcript stays in its original language.
6. Ask “What does supervised learning use?” Open the source excerpt. Ask about a topic absent from the meeting to demonstrate the “not discussed” response.
7. Pause and resume. Stop the meeting to produce final notes and the knowledge test.
8. Take the quiz. At least 50% passes. Show score, correct/wrong counts, time, XP and badge. Repeat a quiz to show that the same score does not repeatedly earn XP.
9. Show My Meetings, Rewards, JSON export, light mode and privacy deletion controls.
10. Open `http://127.0.0.1:8000/docs` to explain the API. Show `backend/app/ai/providers.py` and the provider settings in `.env.example`.

For a real meeting demonstration, configure and test an AI provider and your chosen capture method ahead of time. The browser speech microphone fallback, page captions and faster-whisper tab audio have different prerequisites; see README. Never use a real private meeting as a test without participant permission.
