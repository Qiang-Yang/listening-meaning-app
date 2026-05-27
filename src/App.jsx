import { useEffect, useMemo, useRef, useState } from "react";
import { TASK, WORDS } from "./data.js";
import { getLabel, getMetrics, loadSession, newSession, saveSession } from "./session.js";

const LABELS = {
  fluent: { text: "熟练掌握", tone: "success" },
  needs_reinforcement: { text: "建议巩固", tone: "warning" },
  learned_after_review: { text: "本次学会", tone: "primary" },
  priority_review: { text: "重点复习词", tone: "danger" },
};

const GROUPS = [
  { id: "priority_review", title: "重点复习", note: "需要优先再次听辨" },
  { id: "learned_after_review", title: "本次学会", note: "经提示后重新掌握" },
  { id: "needs_reinforcement", title: "建议巩固", note: "答对了，但依赖重听" },
  { id: "fluent", title: "已熟练掌握", note: "首答稳定" },
];

function usePersistedSession() {
  const [session, setSession] = useState(loadSession);
  useEffect(() => saveSession(session), [session]);
  return [session, setSession];
}

function rotateOptions(options, turns) {
  const shift = turns % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
}

function speakWord(word, setAudioStatus) {
  if (!("speechSynthesis" in window)) {
    setAudioStatus("error");
    return false;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  utterance.lang = "en-US";
  utterance.rate = 0.86;
  utterance.onstart = () => setAudioStatus("playing");
  utterance.onend = () => setAudioStatus("ready");
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") {
      setAudioStatus("error");
    }
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

function Icon({ name }) {
  const paths = {
    home: "M4 11.5 12 5l8 6.5V20H14v-5h-4v5H4z",
    book: "M5 5.5c3-1.5 5-1.5 7 0v14c-2-1.5-4-1.5-7 0zm14 0c-3-1.5-5-1.5-7 0v14c2-1.5 4-1.5 7 0z",
    chart: "M5 20V10h4v10zm6 0V4h4v16zm6 0v-8h4v8z",
    teacher: "M4 18h16M7 18V7h10v11M10 11h4",
    play: "M9 7.5 18 12l-9 4.5z",
    volume: "M5 10h4l5-4v12l-5-4H5zm12-1c2 2 2 4 0 6",
    back: "M15.5 5.5 9 12l6.5 6.5",
    check: "m5 12 4.5 4.5L19 7",
  };
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

function App() {
  const [session, setSession] = usePersistedSession();
  const [screen, setScreen] = useState("tasks");
  const [activeWordIds, setActiveWordIds] = useState(null);
  const metrics = getMetrics(session);

  const beginTask = (reset = false) => {
    const base = reset ? newSession() : session;
    const firstOpenIndex = reset
      ? 0
      : WORDS.findIndex((word) => !base.results[word.id].mastered);
    const updated = {
      ...base,
      status: "in_progress",
      startedAt: base.startedAt || new Date().toISOString(),
      currentIndex: firstOpenIndex === -1 ? 0 : firstOpenIndex,
    };
    setSession(updated);
    setActiveWordIds(null);
    setScreen("practice");
  };

  const startFocusedReview = (ids) => {
    setActiveWordIds(ids);
    setScreen("focused");
  };

  return (
    <div className="app">
      <Sidebar screen={screen} session={session} metrics={metrics} setScreen={setScreen} />
      {screen === "tasks" ? (
        <TasksScreen session={session} metrics={metrics} onOpen={() => setScreen("briefing")} onReport={() => setScreen("report")} onRestart={() => beginTask(true)} />
      ) : null}
      {screen === "briefing" ? (
        <BriefingScreen session={session} onBack={() => setScreen("tasks")} onStart={() => beginTask(false)} />
      ) : null}
      {screen === "practice" ? (
        <PracticeScreen session={session} setSession={setSession} onExit={() => setScreen("tasks")} onCompleted={() => setScreen("completed")} />
      ) : null}
      {screen === "completed" ? (
        <CompletedScreen metrics={metrics} onReport={() => setScreen("report")} onFocus={() => startFocusedReview(metrics.focus.map((item) => item.wordId))} />
      ) : null}
      {screen === "report" ? (
        <StudentReport session={session} metrics={metrics} onFocus={startFocusedReview} onRestart={() => beginTask(true)} onTeacher={() => setScreen("teacher")} />
      ) : null}
      {screen === "teacher" ? (
        <TeacherReport session={session} metrics={metrics} onStudent={() => setScreen("report")} />
      ) : null}
      {screen === "focused" ? (
        <FocusedReview session={session} setSession={setSession} ids={activeWordIds || metrics.focus.map((item) => item.wordId)} onDone={() => setScreen("report")} />
      ) : null}
    </div>
  );
}

function Sidebar({ screen, session, metrics, setScreen }) {
  const items = [
    { id: "tasks", icon: "home", label: "今日任务" },
    { id: "briefing", icon: "book", label: "练习说明" },
    { id: "report", icon: "chart", label: "学习报告", disabled: session.status !== "completed" },
    { id: "teacher", icon: "teacher", label: "教师视角", disabled: session.status !== "completed" },
  ];
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">L</span><div><strong>ListenUp</strong><small>词汇听辨训练</small></div></div>
      <nav className="side-nav">
        {items.map((item) => (
          <button key={item.id} className={screen === item.id ? "active" : ""} disabled={item.disabled} onClick={() => setScreen(item.id)}>
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </nav>
      <div className="student-card">
        <div className="avatar">陈</div>
        <strong>陈雨欣</strong>
        <span>高二（3）班</span>
        <div className="student-divider" />
        <small>本次进度</small>
        <b>{metrics.mastered} / {WORDS.length} 词</b>
      </div>
    </aside>
  );
}

function PageHeader({ title, subtitle }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="date-block">
        <span>今日学习</span>
        <strong>5 月 26 日</strong>
      </div>
    </header>
  );
}

function TasksScreen({ session, metrics, onOpen, onReport, onRestart }) {
  const completed = session.status === "completed";
  const inProgress = session.status === "in_progress";
  return (
    <main className="main">
      <PageHeader title="今日词汇任务" subtitle="通过听音辨认词义，完成今天的听力积累。" />
      <section className="task-hero">
        <div>
          <h2>{TASK.name}</h2>
          <p>听发音，选择正确中文意思。错题会立即带你重新掌握。</p>
          <div className="meta-list">
            <span>10 个单词</span><span>{TASK.duration}</span><span>可自由重听</span>
          </div>
        </div>
        <div className="task-state">
          <span>{completed ? "已完成" : inProgress ? "进行中" : "待开始"}</span>
          {inProgress ? <strong>{metrics.mastered} / {WORDS.length}</strong> : null}
          {completed ? <strong>{metrics.masteryRate}% 掌握</strong> : null}
        </div>
      </section>
      <section className="task-actions">
        {!completed ? <button className="button primary large" onClick={onOpen}>{inProgress ? "继续练习" : "开始练习"}</button> : null}
        {completed ? <button className="button primary large" onClick={onReport}>查看报告</button> : null}
        {completed ? <button className="button secondary large" onClick={onRestart}>再次练习</button> : null}
      </section>
      <section className="learning-prompt">
        <h3>今天的学习建议</h3>
        <p>找一个安静环境，先专注听词，再选择含义。需要时多听几遍，这也是学习的一部分。</p>
      </section>
    </main>
  );
}

function BriefingScreen({ session, onBack, onStart }) {
  const [tested, setTested] = useState(false);
  const [audioStatus, setAudioStatus] = useState("idle");
  const sample = WORDS[0];
  const testAudio = () => {
    setTested(true);
    speakWord(sample, setAudioStatus);
  };
  return (
    <main className="main briefing">
      <button className="text-back" onClick={onBack}><Icon name="back" />返回任务</button>
      <section className="brief-card">
        <h1>{TASK.name}</h1>
        <p className="brief-lead">听发音，选择正确中文意思</p>
        <div className="brief-stats">
          <div><strong>10</strong><span>题目总数</span></div>
          <div><strong>6</strong><span>预计分钟</span></div>
          <div><strong>不限</strong><span>重听次数</span></div>
        </div>
        <div className="rules">
          <h3>练习规则</h3>
          <p><Icon name="check" /> 可以重复播放发音，重听会帮助你确认声音。</p>
          <p><Icon name="check" /> 首次答错会自动重播；再次答错才展示完整解析。</p>
          <p><Icon name="check" /> 报告会分别记录首答表现和最终掌握情况。</p>
        </div>
        <button className="audio-check" onClick={testAudio}><Icon name="volume" />试听发音 {audioStatus === "playing" ? "播放中..." : tested ? "再次试听" : ""}</button>
        {audioStatus === "error" ? <p className="error-note">无法播放发音，请检查浏览器音频权限后重试。</p> : null}
        <button className="button primary block" onClick={onStart}>{session.status === "in_progress" ? "继续练习" : "开始"}</button>
      </section>
    </main>
  );
}

function PracticeScreen({ session, setSession, onExit, onCompleted }) {
  const index = session.currentIndex;
  const word = WORDS[index];
  const result = session.results[word.id];
  const [mode, setMode] = useState(result.firstCorrect === false ? "review" : "first");
  const [choice, setChoice] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [retryPrompt, setRetryPrompt] = useState(false);
  const [audioStatus, setAudioStatus] = useState("ready");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const audioKey = useRef("");
  const options = useMemo(() => (mode === "review" ? rotateOptions(word.options, result.reviewAttempts + 1) : word.options), [mode, result.reviewAttempts, word]);

  useEffect(() => {
    const key = `${word.id}-${mode}`;
    if (audioKey.current !== key) {
      audioKey.current = key;
      speakWord(word, setAudioStatus);
    }
    setChoice(null);
    setFeedback(null);
  }, [word, mode]);

  const replay = () => {
    if (audioStatus === "error") setAudioStatus("ready");
    speakWord(word, setAudioStatus);
    setSession((current) => {
      const currentResult = current.results[word.id];
      const field = mode === "first" && !feedback ? "firstReplays" : "reviewReplays";
      return { ...current, results: { ...current.results, [word.id]: { ...currentResult, [field]: currentResult[field] + 1 } } };
    });
  };

  const submit = () => {
    if (!choice || audioStatus === "error") return;
    const correct = choice === word.meaning;
    if (mode === "first") {
      setSession((current) => ({
        ...current,
        results: {
          ...current.results,
          [word.id]: { ...current.results[word.id], firstChoice: choice, firstCorrect: correct, mastered: correct },
        },
      }));
      if (!correct) {
        setMode("review");
        setChoice(null);
        setRetryPrompt(true);
        return;
      }
    } else {
      setSession((current) => ({
        ...current,
        results: {
          ...current.results,
          [word.id]: { ...current.results[word.id], reviewAttempts: current.results[word.id].reviewAttempts + 1, mastered: correct },
        },
      }));
    }
    setRetryPrompt(false);
    setFeedback(correct ? "correct" : "incorrect");
    if (!correct) speakWord(word, setAudioStatus);
  };

  const retry = () => {
    setMode("review");
    setChoice(null);
    setFeedback(null);
    setRetryPrompt(false);
    speakWord(word, setAudioStatus);
  };

  const next = () => {
    if (index === WORDS.length - 1) {
      setSession((current) => ({ ...current, status: "completed", completedAt: new Date().toISOString() }));
      onCompleted();
      return;
    }
    setSession((current) => ({ ...current, currentIndex: index + 1 }));
    setMode("first");
    setChoice(null);
    setFeedback(null);
    setRetryPrompt(false);
    audioKey.current = "";
  };

  return (
    <main className="practice-layout">
      <section className="practice-stage">
        <div className="practice-top">
          <button className="quiet-button" onClick={() => setLeaveOpen(true)}><Icon name="back" />暂离</button>
          <div className="progress-area">
            <span>{index + 1} / {WORDS.length}</span>
            <div className="progress"><i style={{ width: `${((index + 1) / WORDS.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="question-panel">
          {mode === "review" ? <p className="mode-label">巩固练习</p> : null}
          <h1>听发音，选择正确意思</h1>
          <button className={`play-circle ${audioStatus === "playing" ? "speaking" : ""}`} onClick={replay} aria-label="播放单词发音">
            <Icon name="volume" />
          </button>
          <button className="replay-link" onClick={replay}>再听一次</button>
          {audioStatus === "error" ? <div className="audio-error">发音加载失败，请重新加载后再作答。<button onClick={replay}>重新加载</button></div> : null}
          <div className="options">
            {options.map((option) => {
              const selected = choice === option;
              const isCorrect = feedback && option === word.meaning;
              const isWrong = feedback === "incorrect" && selected && !isCorrect;
              return (
                <button
                  key={option}
                  disabled={Boolean(feedback)}
                  className={`option ${selected ? "selected" : ""} ${isCorrect ? "correct" : ""} ${isWrong ? "wrong" : ""}`}
                  onClick={() => setChoice(option)}
                >
                  <span>{option}</span>
                </button>
              );
            })}
          </div>
          {retryPrompt ? <FirstRetryNotice /> : null}
          {!feedback ? <button className="button primary submit" disabled={!choice || audioStatus === "error"} onClick={submit}>确认</button> : null}
          {feedback ? <QuestionFeedback word={word} result={session.results[word.id]} correct={feedback === "correct"} mode={mode} onReplay={replay} onContinue={feedback === "correct" ? next : retry} /> : null}
        </div>
      </section>
      <PracticeAside mode={mode} result={result} />
      {leaveOpen ? <ExitDialog onStay={() => setLeaveOpen(false)} onLeave={onExit} /> : null}
    </main>
  );
}

function FirstRetryNotice() {
  return (
    <div className="retry-notice" role="status">
      <div className="retry-notice-icon"><Icon name="volume" /></div>
      <div>
        <h2>再听一遍，重新选择</h2>
        <p>先不显示答案。抓住读音线索，再试一次。</p>
      </div>
    </div>
  );
}

function PracticeAside({ mode, result }) {
  return (
    <aside className="practice-aside">
      <h2>本次目标</h2>
      <p>用耳朵识别单词意思，遇到陌生声音及时复习。</p>
      <div className="tip-card">
        <h3>听辨提示</h3>
        <p>先听完整读音，再关注开头音节和重音位置。</p>
      </div>
      <div className="status-card">
        <h3>当前单词</h3>
        <p>{mode === "review" ? "正在重新巩固" : "正在首次作答"}</p>
        <span>主动重听 {result.firstReplays + result.reviewReplays} 次</span>
      </div>
    </aside>
  );
}

function QuestionFeedback({ word, result, correct, mode, onReplay, onContinue }) {
  const label = correct ? LABELS[getLabel(result)] : null;
  return (
    <div className={`feedback ${correct ? "positive" : "negative"}`}>
      <h2>{correct ? (mode === "review" ? "已重新掌握这个词" : "正确，你听出了这个单词。") : `这个词的意思是：${word.meaning}`}</h2>
      <div className="word-reveal">
        <strong>{word.word}</strong><span>{word.phonetic}</span><b>{word.meaning}</b>
      </div>
      {!correct ? <p>{word.tip} 再听一次，把它记住。</p> : null}
      {label ? <span className={`tag ${label.tone}`}>{label.text}</span> : null}
      <div className="feedback-actions">
        <button className="button secondary" onClick={onReplay}><Icon name="volume" />再听一次</button>
        <button className="button primary" onClick={onContinue}>{correct ? "下一题" : "我记住了，重新选择"}</button>
      </div>
    </div>
  );
}

function ExitDialog({ onStay, onLeave }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>暂时退出练习？</h2>
        <p>退出后会保留当前进度，下次可以从未完成的单词继续。</p>
        <button className="button primary block" onClick={onStay}>继续练习</button>
        <button className="button secondary block" onClick={onLeave}>暂时退出</button>
      </div>
    </div>
  );
}

function CompletedScreen({ metrics, onReport, onFocus }) {
  return (
    <main className="main completion">
      <section className="completion-card">
        <div className="completion-check"><Icon name="check" /></div>
        <h1>本次练习完成</h1>
        <p>你通过练习和复习，完成了今天的听音选义任务。</p>
        <div className="completion-stats">
          <div><strong>{WORDS.length}</strong><span>学习题数</span></div>
          <div><strong>{metrics.mastered}</strong><span>最终掌握</span></div>
          <div><strong>{metrics.firstCorrect} / {WORDS.length}</strong><span>首答答对</span></div>
          <div><strong>{metrics.reviewed}</strong><span>重新掌握</span></div>
        </div>
        <button className="button primary large" onClick={onReport}>查看学习报告</button>
        {metrics.focus.length ? <button className="button secondary large" onClick={onFocus}>再练重点单词</button> : null}
      </section>
    </main>
  );
}

function StudentReport({ session, metrics, onFocus, onRestart, onTeacher }) {
  return (
    <main className="main report">
      <PageHeader title={`${TASK.name} · 学习报告`} subtitle="首答表现与复习成果分别记录，帮助你找到下一步重点。" />
      <div className="report-toggle">
        <button className="active">学生视角</button>
        <button onClick={onTeacher}>教师视角</button>
      </div>
      <section className="summary-grid">
        <Metric value={`${metrics.mastered}/${WORDS.length}`} label="已完成" />
        <Metric value={`${metrics.firstCorrectRate}%`} label="首答正确率" />
        <Metric value={`${metrics.masteryRate}%`} label="最终掌握率" tone="success" />
        <Metric value={`${metrics.focus.length} 词`} label="重点巩固" tone="warning" />
      </section>
      <p className="report-message">你通过复习掌握了全部单词。{metrics.reviewed ? `有 ${metrics.reviewed} 个单词是听错后重新学会的，建议今天再练一次。` : "本次首答状态稳定，继续保持。"}</p>
      <section className="group-list">
        {GROUPS.map((group) => {
          const words = WORDS.filter((word) => getLabel(session.results[word.id]) === group.id);
          return words.length ? <WordGroup key={group.id} group={group} words={words} session={session} onFocus={onFocus} /> : null;
        })}
      </section>
      <div className="report-actions">
        {metrics.focus.length ? <button className="button primary large" onClick={() => onFocus(metrics.focus.map((item) => item.wordId))}>练习重点单词</button> : null}
        <button className="button secondary large" onClick={onRestart}>重新练习全部单词</button>
      </div>
    </main>
  );
}

function Metric({ value, label, tone = "" }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function WordGroup({ group, words, session, onFocus }) {
  const badge = LABELS[group.id];
  return (
    <div className="word-group">
      <header><h2>{group.title}</h2><p>{group.note}</p></header>
      {words.map((word) => {
        const result = session.results[word.id];
        const lastFocus = result.focusedReviews.at(-1);
        return (
          <div className="word-row" key={word.id}>
            <div className="word-identity"><strong>{word.word}</strong><span>{word.phonetic}</span></div>
            <p>{word.meaning}</p>
            <span className={`tag ${badge.tone}`}>{badge.text}</span>
            <small>重听 {result.firstReplays + result.reviewReplays} 次{lastFocus ? " · 已再次巩固" : ""}</small>
            <button className="row-audio" onClick={() => speakWord(word, () => {})}><Icon name="volume" /></button>
            <button className="row-review" onClick={() => onFocus([word.id])}>单独再练</button>
          </div>
        );
      })}
    </div>
  );
}

function TeacherReport({ session, metrics, onStudent }) {
  return (
    <main className="main report teacher">
      <PageHeader title={`${TASK.name} · 教师报告`} subtitle="陈雨欣 · 高二（3）班 · 任务学习证据" />
      <div className="report-toggle">
        <button onClick={onStudent}>学生视角</button>
        <button className="active">教师视角</button>
      </div>
      <section className="summary-grid teacher-metrics">
        <Metric value={`${metrics.firstCorrectRate}%`} label="首答正确率" />
        <Metric value={`${metrics.masteryRate}%`} label="复习后掌握率" tone="success" />
        <Metric value={metrics.averageReplays} label="平均主动重听" />
        <Metric value={`${metrics.reviewed}`} label="首答错误词" tone="warning" />
      </section>
      <section className="teacher-insight">
        <h2>学习判断</h2>
        <p>{metrics.reviewed > 2 ? "该生能通过即时讲解完成掌握，但存在数个听辨薄弱词，建议安排重点词二次练习。" : "该生本次听辨较稳定，可继续进入下一单元。"}</p>
      </section>
      <section className="data-table">
        <div className="table-head"><span>单词</span><span>首答</span><span>误选释义</span><span>首答重听</span><span>复习轮次</span><span>最终状态</span><span>后续巩固</span></div>
        {WORDS.map((word) => {
          const result = session.results[word.id];
          const label = LABELS[getLabel(result)];
          return (
            <div className="table-row" key={word.id}>
              <strong>{word.word}</strong>
              <span className={result.firstCorrect ? "answer-good" : "answer-bad"}>{result.firstCorrect ? "正确" : "错误"}</span>
              <span>{result.firstCorrect ? "-" : result.firstChoice}</span>
              <span>{result.firstReplays} 次</span>
              <span>{result.reviewAttempts} 次</span>
              <span className={`tag ${label.tone}`}>{label.text}</span>
              <span>{result.focusedReviews.length ? "已巩固" : "-"}</span>
            </div>
          );
        })}
      </section>
    </main>
  );
}

function FocusedReview({ session, setSession, ids, onDone }) {
  const [position, setPosition] = useState(0);
  const [choice, setChoice] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [retryPrompt, setRetryPrompt] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [replays, setReplays] = useState(0);
  const [audioStatus, setAudioStatus] = useState("ready");
  const word = WORDS.find((item) => item.id === ids[position]);
  const options = useMemo(() => rotateOptions(word.options, attempts + 1), [word, attempts]);

  useEffect(() => {
    speakWord(word, setAudioStatus);
    setChoice(null);
    setFeedback(null);
    setRetryPrompt(false);
    setAttempts(0);
    setReplays(0);
  }, [word]);

  const replay = () => {
    setReplays((value) => value + 1);
    speakWord(word, setAudioStatus);
  };
  const submit = () => {
    if (!choice || audioStatus === "error") return;
    const correct = choice === word.meaning;
    setAttempts((value) => value + 1);
    if (!correct && attempts === 0) {
      setChoice(null);
      setRetryPrompt(true);
      speakWord(word, setAudioStatus);
      return;
    }
    setRetryPrompt(false);
    setFeedback(correct ? "correct" : "incorrect");
    if (!correct) speakWord(word, setAudioStatus);
  };
  const continueFocused = () => {
    if (feedback !== "correct") {
      setChoice(null);
      setFeedback(null);
      setRetryPrompt(false);
      speakWord(word, setAudioStatus);
      return;
    }
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        [word.id]: {
          ...current.results[word.id],
          focusedReviews: [...current.results[word.id].focusedReviews, { at: new Date().toISOString(), attempts, replays }],
        },
      },
    }));
    if (position + 1 === ids.length) onDone();
    else setPosition((value) => value + 1);
  };
  return (
    <main className="focused-layout">
      <button className="text-back" onClick={onDone}><Icon name="back" />返回报告</button>
      <section className="focused-card">
        <p className="mode-label">专项巩固 {position + 1} / {ids.length}</p>
        <h1>再听一次，你能直接选对吗？</h1>
        <button className={`play-circle ${audioStatus === "playing" ? "speaking" : ""}`} onClick={replay}><Icon name="volume" /></button>
        <button className="replay-link" onClick={replay}>再听一次</button>
        <div className="options compact">
          {options.map((option) => (
            <button
              key={option}
              disabled={Boolean(feedback)}
              className={`option ${choice === option ? "selected" : ""} ${feedback && option === word.meaning ? "correct" : ""} ${feedback === "incorrect" && choice === option && option !== word.meaning ? "wrong" : ""}`}
              onClick={() => setChoice(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {retryPrompt ? <FirstRetryNotice /> : null}
        {!feedback ? <button className="button primary submit" disabled={!choice || audioStatus === "error"} onClick={submit}>确认</button> : (
          <div className={`focus-feedback ${feedback === "correct" ? "positive" : "negative"}`}>
            <h2>{feedback === "correct" ? "这次你直接听对了" : `正确意思是：${word.meaning}`}</h2>
            <p>{word.word} {word.phonetic} · {word.tip}</p>
            <button className="button primary" onClick={continueFocused}>{feedback === "correct" ? (position + 1 === ids.length ? "完成巩固" : "下一个词") : "重新选择"}</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
