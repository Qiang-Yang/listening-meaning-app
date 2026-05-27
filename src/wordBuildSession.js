import { BUILD_TASK, BUILD_WORDS } from "./wordBuildData.js";

const STORAGE_KEY = "listen-build-meaning-session-v1";

const emptyResult = (wordId) => ({
  wordId,
  formationAttempts: 0,
  formationFirstCorrect: null,
  wrongSpellings: [],
  meaningAttempts: 0,
  meaningFirstCorrect: null,
  wrongMeanings: [],
  replays: 0,
  formed: false,
  completed: false,
});

export function newBuildSession() {
  return {
    taskId: BUILD_TASK.id,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    currentIndex: 0,
    results: Object.fromEntries(BUILD_WORDS.map((word) => [word.id, emptyResult(word.id)])),
  };
}

export function loadBuildSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return newBuildSession();
    const parsed = JSON.parse(saved);
    if (parsed.taskId !== BUILD_TASK.id) return newBuildSession();
    return parsed;
  } catch {
    return newBuildSession();
  }
}

export function saveBuildSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getBuildMetrics(session) {
  const results = Object.values(session.results);
  const completed = results.filter((result) => result.completed).length;
  const formationFirstCorrect = results.filter((result) => result.formationFirstCorrect === true).length;
  const meaningFirstCorrect = results.filter((result) => result.meaningFirstCorrect === true).length;
  const replays = results.reduce((total, result) => total + result.replays, 0);
  const focus = results.filter((result) => result.completed && (!result.formationFirstCorrect || !result.meaningFirstCorrect));

  return {
    completed,
    formationFirstCorrect,
    meaningFirstCorrect,
    focus,
    formationRate: Math.round((formationFirstCorrect / BUILD_WORDS.length) * 100),
    meaningRate: Math.round((meaningFirstCorrect / BUILD_WORDS.length) * 100),
    masteryRate: Math.round((completed / BUILD_WORDS.length) * 100),
    averageReplays: completed ? (replays / completed).toFixed(1) : "0.0",
  };
}
