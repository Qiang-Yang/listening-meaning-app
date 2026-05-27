import { TASK, WORDS } from "./data.js";

const STORAGE_KEY = "listen-meaning-session-v1";

const emptyResult = (wordId) => ({
  wordId,
  firstChoice: null,
  firstCorrect: null,
  firstReplays: 0,
  reviewAttempts: 0,
  reviewReplays: 0,
  mastered: false,
  focusedReviews: [],
});

export function newSession() {
  return {
    taskId: TASK.id,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    currentIndex: 0,
    results: Object.fromEntries(WORDS.map((word) => [word.id, emptyResult(word.id)])),
  };
}

export function loadSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return newSession();
    const parsed = JSON.parse(saved);
    if (parsed.taskId !== TASK.id) return newSession();
    return parsed;
  } catch {
    return newSession();
  }
}

export function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getLabel(result) {
  if (result.firstCorrect === true && result.firstReplays < TASK.replayThreshold) {
    return "fluent";
  }
  if (result.firstCorrect === true) {
    return "needs_reinforcement";
  }
  if (result.firstCorrect === false && result.reviewAttempts > 1) {
    return "priority_review";
  }
  if (result.firstCorrect === false && result.mastered) {
    return "learned_after_review";
  }
  return null;
}

export function getMetrics(session) {
  const results = Object.values(session.results);
  const attempted = results.filter((result) => result.firstCorrect !== null);
  const firstCorrect = results.filter((result) => result.firstCorrect === true).length;
  const mastered = results.filter((result) => result.mastered).length;
  const reviewed = results.filter((result) => result.firstCorrect === false && result.mastered).length;
  const focus = results.filter((result) => {
    const label = getLabel(result);
    return label === "priority_review" || label === "learned_after_review" || label === "needs_reinforcement";
  });
  const replays = results.reduce((total, result) => total + result.firstReplays + result.reviewReplays, 0);
  return {
    attempted: attempted.length,
    firstCorrect,
    mastered,
    reviewed,
    focus,
    firstCorrectRate: Math.round((firstCorrect / WORDS.length) * 100),
    masteryRate: Math.round((mastered / WORDS.length) * 100),
    averageReplays: attempted.length ? (replays / attempted.length).toFixed(1) : "0.0",
  };
}
