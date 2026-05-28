import { SHADOW_SENTENCES, SPEAKING_TASK, SPEAKING_WORDS } from "./speakingData.js";

const STORAGE_KEY = "listen-speaking-session-v1";

const emptyItem = (id, type) => ({
  id,
  type,
  completed: false,
  needsReview: false,
  selfRating: null,
  recordings: 0,
  standardPlays: 0,
  completedAt: null,
});

const makeResults = () => ({
  words: Object.fromEntries(SPEAKING_WORDS.map((word) => [word.id, emptyItem(word.id, "word")])),
  sentences: Object.fromEntries(SHADOW_SENTENCES.map((sentence) => [sentence.id, emptyItem(sentence.id, "sentence")])),
});

export function newSpeakingSession() {
  return {
    taskId: SPEAKING_TASK.id,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    mode: "word",
    currentWordIndex: 0,
    currentSentenceIndex: 0,
    results: makeResults(),
  };
}

export function loadSpeakingSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return newSpeakingSession();
    const parsed = JSON.parse(saved);
    if (parsed.taskId !== SPEAKING_TASK.id) return newSpeakingSession();
    const fallback = newSpeakingSession();
    return {
      ...fallback,
      ...parsed,
      results: {
        words: Object.fromEntries(SPEAKING_WORDS.map((word) => [
          word.id,
          { ...fallback.results.words[word.id], ...parsed.results?.words?.[word.id] },
        ])),
        sentences: Object.fromEntries(SHADOW_SENTENCES.map((sentence) => [
          sentence.id,
          { ...fallback.results.sentences[sentence.id], ...parsed.results?.sentences?.[sentence.id] },
        ])),
      },
    };
  } catch {
    return newSpeakingSession();
  }
}

export function saveSpeakingSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSpeakingMetrics(session) {
  const wordResults = Object.values(session.results.words);
  const sentenceResults = Object.values(session.results.sentences);
  const all = [...wordResults, ...sentenceResults];
  const completed = all.filter((item) => item.completed);
  const review = all.filter((item) => item.needsReview);
  const recordings = all.reduce((total, item) => total + item.recordings, 0);
  const plays = all.reduce((total, item) => total + item.standardPlays, 0);
  return {
    wordCompleted: wordResults.filter((item) => item.completed).length,
    sentenceCompleted: sentenceResults.filter((item) => item.completed).length,
    totalCompleted: completed.length,
    totalItems: all.length,
    review,
    recordings,
    plays,
    averageRecordings: completed.length ? (recordings / completed.length).toFixed(1) : "0.0",
    completionRate: Math.round((completed.length / all.length) * 100),
  };
}
