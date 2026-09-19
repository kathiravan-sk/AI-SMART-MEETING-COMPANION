export type Language = "en" | "ta" | "ml" | "hi";
export const languages: Record<Language, string> = {
  en: "English",
  ta: "தமிழ்",
  ml: "മലയാളം",
  hi: "हिन्दी",
};
export const speechLocales: Record<Language, string> = {
  en: "en-IN",
  ta: "ta-IN",
  ml: "ml-IN",
  hi: "hi-IN",
};
export interface User {
  id: string;
  name: string;
  email: string;
}
export interface Session {
  token: string;
  user: User;
}
export interface Chunk {
  id: string;
  clientId: string;
  originalText: string;
  originalLanguage: Language;
  speaker: string;
  timestamp: string;
  startTime: number;
  endTime: number;
}
export interface Question {
  id: string;
  question: string;
  answer?: string;
  options: string[];
  correctIndex?: number;
  type: "multiple_choice" | "true_false" | "short_answer";
  difficulty: string;
  sourceTranscriptIds: string[];
}
export interface Summary {
  overview: string;
  currentTopic: string;
  keyPoints: string[];
  concepts: string[];
  topics: string[];
  decisions: string[];
  actionItems: string[];
  questions: Question[];
}
export interface Meeting {
  id: string;
  title: string;
  platform: string;
  startedAt: string;
  endedAt: string | null;
  duration: number;
  status: "live" | "paused" | "completed";
  detectedLanguage: Language;
  selectedDisplayLanguage: Language;
  demo: boolean;
  transcript: Chunk[];
  summary: Summary;
  revision: number;
  quizId: string | null;
  aiError: string | null;
}
export interface Answer {
  answer: string;
  grounded: boolean;
  sources: Chunk[];
  mode?: string;
}
export interface Quiz {
  id: string;
  meetingId: string;
  questions: Question[];
  language: Language;
}
export interface Result {
  id: string;
  quizId: string;
  meetingId: string;
  percentage: number;
  passed: boolean;
  score: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpEarned: number;
  rewardTotal: number;
  badge: string | null;
  timeTaken: number;
  completedAt: string;
  review: (Question & { given: string | number; correct: boolean })[];
}
export interface Progress {
  totalXP: number;
  level: number;
  levelXP: number;
  nextLevelXP: number;
  streak: number;
  badges: string[];
  completedQuizzes: number;
  averageScore: number;
  attempts: Result[];
}
export interface Dashboard extends Progress {
  meetingsCompleted: number;
  learningSeconds: number;
  recentMeetings: Meeting[];
}
