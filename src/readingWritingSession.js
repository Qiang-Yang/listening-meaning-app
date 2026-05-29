import { CHUNK_BANK, READING_WRITING_SETS, READING_WRITING_TASK } from "./readingWritingData.js";

const STORAGE_KEY = "listen-reading-writing-session-v2";
const MODES = ["source", "retrieval", "judge", "application"];
const MAX_ROUND = 3;

const makeBaseKey = (setId, index) => `${setId}:${index}`;
const makeKey = (setId, index, round) => `${setId}:${index}:${round}`;

const makeQueue = (mode) => READING_WRITING_SETS.flatMap((set) => {
  const items = mode === "source" ? set.sourceCards : mode === "application" ? [set.application] : set[mode];
  return items.map((_, index) => ({ setId: set.id, index, round: 1 }));
});

const emptyMode = (mode) => ({
  queue: makeQueue(mode),
  currentIndex: 0,
  visitedHistory: [],
  completed: false,
  results: {},
});

export function newReadingWritingSession() {
  return {
    taskId: READING_WRITING_TASK.id,
    version: 2,
    status: "not_started",
    startedAt: null,
    completedAt: null,
    activeMode: "source",
    autoPlay: true,
    modes: Object.fromEntries(MODES.map((mode) => [mode, emptyMode(mode)])),
  };
}

export function loadReadingWritingSession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return newReadingWritingSession();
    const parsed = JSON.parse(saved);
    if (parsed.taskId !== READING_WRITING_TASK.id || parsed.version !== 2) return newReadingWritingSession();
    const fallback = newReadingWritingSession();
    return {
      ...fallback,
      ...parsed,
      modes: Object.fromEntries(MODES.map((mode) => [
        mode,
        { ...emptyMode(mode), ...parsed.modes?.[mode] },
      ])),
    };
  } catch {
    return newReadingWritingSession();
  }
}

export function saveReadingWritingSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSetById(setId) {
  return READING_WRITING_SETS.find((set) => set.id === setId) || READING_WRITING_SETS[0];
}

export function getItemForEntry(mode, entry) {
  const set = getSetById(entry.setId);
  const items = mode === "source" ? set.sourceCards : mode === "application" ? [set.application] : set[mode];
  return { set, item: items[entry.index], key: makeKey(entry.setId, entry.index, entry.round), baseKey: makeBaseKey(entry.setId, entry.index) };
}

export function getSentences(passage) {
  return passage.match(/[^.!?。！？]+[.!?。！？]/g)?.map((sentence) => sentence.trim()) || [passage];
}

export function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[“”"'.;,]/g, "").replace(/\s+/g, " ").trim();
}

export function getChunkEntry(chunk) {
  const key = normalizeText(chunk);
  return CHUNK_BANK.find((entry) => normalizeText(entry.chunk) === key);
}

export function getSetChunkBank(set) {
  const seen = new Set();
  return set.retrieval
    .map((item) => {
      const entry = getChunkEntry(item.targetChunk) || {};
      const key = normalizeText(item.targetChunk);
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        word: item.sourceWord,
        chunk: item.targetChunk,
        example: item.expected,
        zh: entry.zh || "",
        role: entry.role || "",
        tip: entry.tip || "应用时保持词块完整。",
        alternatives: entry.alternatives || [],
      };
    })
    .filter(Boolean);
}

export function usesChunk(answer, bankItem) {
  const clean = normalizeText(answer);
  const chunk = normalizeText(bankItem.chunk);
  const example = normalizeText(bankItem.example);
  if (!clean) return false;
  if (example && clean.includes(example)) return true;
  if (chunk && clean.includes(chunk)) return true;
  if (chunk.includes(" do")) return clean.includes(chunk.replace(" do", ""));
  if (chunk.includes("sth")) {
    return chunk.split("sth").map((part) => part.trim()).filter(Boolean).every((part) => clean.includes(part));
  }
  if (chunk === "account for") return clean.includes("account for") || clean.includes("accounted for");
  return false;
}

export function getUsedChunks(answer, set) {
  return getSetChunkBank(set).filter((item) => usesChunk(answer, item));
}

export function appendReviewIfNeeded(modeState, entry, correct) {
  if (correct) {
    return modeState.queue.filter((queued) => !(
      queued.setId === entry.setId && queued.index === entry.index && queued.round > entry.round
    ));
  }
  if (entry.round >= MAX_ROUND) return modeState.queue;
  const nextRound = entry.round + 1;
  const alreadyQueued = modeState.queue.some((queued) => (
    queued.setId === entry.setId && queued.index === entry.index && queued.round === nextRound
  ));
  if (alreadyQueued) return modeState.queue;
  return [...modeState.queue, { ...entry, round: nextRound }];
}

export function getReadingWritingMetrics(session) {
  const modes = session.modes || newReadingWritingSession().modes;
  const modeMetrics = Object.fromEntries(MODES.map((mode) => {
    const modeState = modes[mode];
    const results = Object.entries(modeState.results || {});
    const completed = new Set(results.filter(([, result]) => result.status === "correct" || result.status === "revealed").map(([key]) => key.split(":").slice(0, 2).join(":"))).size;
    const firstCorrect = results.filter(([, result]) => result.firstCorrect).length;
    const reviewNeeded = new Set(results.filter(([, result]) => result.needsReview).map(([key]) => key.split(":").slice(0, 2).join(":"))).size;
    return [mode, { completed, total: makeQueue(mode).length, firstCorrect, reviewNeeded, done: modeState.completed }];
  }));
  const transferredChunks = [...new Set(Object.values(modes.application.results || {}).flatMap((result) => result.usedChunks || []))];
  const completedModes = MODES.filter((mode) => modes[mode].completed).length;

  return {
    completedModes,
    totalModes: MODES.length,
    modeMetrics,
    transferredChunks,
    completionRate: Math.round((completedModes / MODES.length) * 100),
  };
}
