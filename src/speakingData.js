import { WORDS } from "./data.js";

export const SPEAKING_TASK = {
  id: "unit-3-speaking-expression",
  name: "口语表达",
  grade: "高二",
  duration: "约 10 分钟",
};

const extras = {
  solution: {
    syllables: ["so", "lu", "tion"],
    stress: "lu",
    pronunciationTips: ["重音在第二个音节 /luː/。", "结尾 -tion 读 /ʃn/，不要读成完整的 tion。"],
  },
  achieve: {
    syllables: ["a", "chieve"],
    stress: "chieve",
    pronunciationTips: ["开头 a 轻读，重心放在 chieve。", "中间保持长音 /iː/，结尾 /v/ 要收住。"],
  },
  affect: {
    syllables: ["a", "ffect"],
    stress: "ffect",
    pronunciationTips: ["跟读时把 a 轻轻带过，重心放在 /fekt/。", "末尾 /kt/ 要短促收尾，不要加出额外元音。"],
  },
  natural: {
    syllables: ["na", "tural"],
    stress: "na",
    pronunciationTips: ["重音在开头 na。", "后半部分轻读，读出 /tʃrəl/ 的连缀感。"],
  },
  possible: {
    syllables: ["poss", "ible"],
    stress: "poss",
    pronunciationTips: ["重音在第一个音节。", "结尾 -ble 轻读，不要拖长。"],
  },
  invite: {
    syllables: ["in", "vite"],
    stress: "vite",
    pronunciationTips: ["开头 in 轻读，重心放在 vite。", "vite 中的 i 读 /aɪ/，结尾 /t/ 干净收住。"],
  },
};

export const SPEAKING_WORDS = WORDS.filter((word) => extras[word.id]).map((word) => ({
  ...word,
  ...extras[word.id],
}));

export const SHADOW_SENTENCES = [
  {
    id: "goal-solution",
    sentence: "We need a better solution to achieve our goal.",
    translation: "我们需要一个更好的办法来实现目标。",
    focusWords: ["solution", "achieve", "goal"],
    chunks: [
      { text: "We need a better solution", cue: "平稳", tip: "solution 保持重音。" },
      { text: "to achieve our goal", cue: "推进", tip: "to 弱读，achieve our 可以轻微连读。" },
    ],
    shadowTip: "按色块停顿，先听整句再跟读。",
  },
  {
    id: "weather-affect",
    sentence: "Sudden changes in weather can affect our plans.",
    translation: "天气的突然变化可能会影响我们的计划。",
    focusWords: ["sudden", "affect", "plans"],
    chunks: [
      { text: "Sudden changes in weather", cue: "连读", tip: "changes in 可以自然连读。" },
      { text: "can affect our plans", cue: "强调", tip: "can 弱读，affect 后半部分加重。" },
    ],
    shadowTip: "先慢速听，再按色块复现节奏。",
  },
  {
    id: "natural-increase",
    sentence: "Natural practice can increase your confidence.",
    translation: "自然的练习可以提升你的信心。",
    focusWords: ["natural", "increase", "confidence"],
    chunks: [
      { text: "Natural practice", cue: "轻、短", tip: "Natural 开头重，practice 轻收。" },
      { text: "can increase", cue: "强调", tip: "increase 后半部分加重。" },
      { text: "your confidence", cue: "读清晰", tip: "confidence 不要读得太重。" },
    ],
    shadowTip: "色块越短，越容易跟上节奏。",
  },
  {
    id: "possible-invite",
    sentence: "If possible, invite a friend to practice with you.",
    translation: "如果可以，邀请一位朋友和你一起练习。",
    focusWords: ["possible", "invite", "practice"],
    chunks: [
      { text: "If possible", cue: "停顿", tip: "逗号处短暂停顿。" },
      { text: "invite a friend", cue: "连读", tip: "invite a 可以连起来读。" },
      { text: "to practice with you", cue: "收尾", tip: "with you 轻柔收尾。" },
    ],
    shadowTip: "按色块读，不急着一次读快。",
  },
];
