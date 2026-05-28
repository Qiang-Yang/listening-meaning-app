import { useEffect, useMemo, useRef, useState } from "react";
import { speakText, useRecorder } from "./audio.js";
import { TASK, WORDS } from "./data.js";
import { enqueueMeaningReview, getLabel, getMetrics, loadSession, newSession, saveSession } from "./session.js";
import { SHADOW_SENTENCES, SPEAKING_TASK, SPEAKING_WORDS } from "./speakingData.js";
import { getSpeakingMetrics, loadSpeakingSession, newSpeakingSession, saveSpeakingSession } from "./speakingSession.js";
import { BUILD_TASK, BUILD_WORDS } from "./wordBuildData.js";
import { enqueueBuildReview, getBuildMetrics, loadBuildSession, newBuildSession, saveBuildSession } from "./wordBuildSession.js";

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

const SPEECH_SPEEDS = [
  { id: "slow", label: "慢速", rate: 0.72 },
  { id: "normal", label: "常速", rate: 0.86 },
  { id: "fast", label: "快速", rate: 1 },
];

function usePersistedSession() {
  const [session, setSession] = useState(loadSession);
  useEffect(() => saveSession(session), [session]);
  return [session, setSession];
}

function usePersistedBuildSession() {
  const [session, setSession] = useState(loadBuildSession);
  useEffect(() => saveBuildSession(session), [session]);
  return [session, setSession];
}

function usePersistedSpeakingSession() {
  const [session, setSession] = useState(loadSpeakingSession);
  useEffect(() => saveSpeakingSession(session), [session]);
  return [session, setSession];
}

function rotateOptions(options, turns) {
  const shift = turns % options.length;
  return [...options.slice(shift), ...options.slice(0, shift)];
}

function speakWord(word, setAudioStatus) {
  return speakText(word.word, setAudioStatus);
}

function Icon({ name }) {
  const paths = {
    home: "M4 11.5 12 5l8 6.5V20H14v-5h-4v5H4z",
    book: "M5 5.5c3-1.5 5-1.5 7 0v14c-2-1.5-4-1.5-7 0zm14 0c-3-1.5-5-1.5-7 0v14c2-1.5 4-1.5 7 0z",
    chart: "M5 20V10h4v10zm6 0V4h4v16zm6 0v-8h4v8z",
    teacher: "M4 18h16M7 18V7h10v11M10 11h4",
    play: "M9 7.5 18 12l-9 4.5z",
    volume: "M5 10h4l5-4v12l-5-4H5zm12-1c2 2 2 4 0 6",
    mic: "M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm6-3a6 6 0 0 1-12 0m6 6v4m-4 0h8",
    stop: "M8 8h8v8H8z",
    headphones: "M4 14v-2a8 8 0 0 1 16 0v2m-16 0h4v6H4zm12 0h4v6h-4z",
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
  const [buildSession, setBuildSession] = usePersistedBuildSession();
  const [speakingSession, setSpeakingSession] = usePersistedSpeakingSession();
  const [screen, setScreen] = useState("tasks");
  const [selectedTask, setSelectedTask] = useState("meaning");
  const [activeWordIds, setActiveWordIds] = useState(null);
  const metrics = getMetrics(session);
  const buildMetrics = getBuildMetrics(buildSession);
  const speakingMetrics = getSpeakingMetrics(speakingSession);

  const beginTask = (reset = false) => {
    const base = reset ? newSession() : session;
    const updated = {
      ...base,
      status: "in_progress",
      startedAt: base.startedAt || new Date().toISOString(),
      currentIndex: reset ? 0 : base.currentIndex,
    };
    setSession(updated);
    setSelectedTask("meaning");
    setActiveWordIds(null);
    setScreen("practice");
  };

  const startFocusedReview = (ids) => {
    setSelectedTask("meaning");
    setActiveWordIds(ids);
    setScreen("focused");
  };

  const beginBuildTask = (reset = false) => {
    const base = reset ? newBuildSession() : buildSession;
    const updated = {
      ...base,
      status: "in_progress",
      startedAt: base.startedAt || new Date().toISOString(),
      currentIndex: reset ? 0 : base.currentIndex,
    };
    setBuildSession(updated);
    setSelectedTask("build");
    setScreen("buildPractice");
  };

  const beginSpeakingTask = (mode, reset = false) => {
    const base = reset ? newSpeakingSession() : speakingSession;
    const updated = {
      ...base,
      mode,
      status: "in_progress",
      startedAt: base.startedAt || new Date().toISOString(),
      currentWordIndex: reset && mode === "word" ? 0 : base.currentWordIndex,
      currentSentenceIndex: reset && mode === "shadow" ? 0 : base.currentSentenceIndex,
    };
    setSpeakingSession(updated);
    setSelectedTask("speaking");
    setScreen(mode === "shadow" ? "speakingShadowPractice" : "speakingWordPractice");
  };

  const openTask = (taskId) => {
    setSelectedTask(taskId);
    setScreen(taskId === "build" ? "buildBriefing" : taskId === "speaking" ? "speakingBriefing" : "briefing");
  };

  return (
    <div className="app">
      <Sidebar
        screen={screen}
        selectedTask={selectedTask}
        session={session}
        metrics={metrics}
        buildSession={buildSession}
        buildMetrics={buildMetrics}
        speakingSession={speakingSession}
        speakingMetrics={speakingMetrics}
        setScreen={setScreen}
      />
      {screen === "tasks" ? (
        <TasksScreen
          session={session}
          metrics={metrics}
          buildSession={buildSession}
          buildMetrics={buildMetrics}
          speakingSession={speakingSession}
          speakingMetrics={speakingMetrics}
          onOpen={openTask}
          onReport={(taskId) => {
            setSelectedTask(taskId);
            setScreen(taskId === "build" ? "buildReport" : taskId === "speaking" ? "speakingReport" : "report");
          }}
          onRestart={(taskId) => (taskId === "build" ? beginBuildTask(true) : taskId === "speaking" ? beginSpeakingTask("word", true) : beginTask(true))}
        />
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
      {screen === "buildBriefing" ? (
        <BuildBriefingScreen buildSession={buildSession} onBack={() => setScreen("tasks")} onStart={() => beginBuildTask(false)} />
      ) : null}
      {screen === "buildPractice" ? (
        <BuildPracticeScreen
          session={buildSession}
          setSession={setBuildSession}
          onExit={() => setScreen("tasks")}
          onCompleted={() => setScreen("buildCompleted")}
        />
      ) : null}
      {screen === "buildCompleted" ? (
        <BuildCompletedScreen metrics={buildMetrics} onReport={() => setScreen("buildReport")} />
      ) : null}
      {screen === "buildReport" ? (
        <BuildReport session={buildSession} metrics={buildMetrics} onRestart={() => beginBuildTask(true)} />
      ) : null}
      {screen === "speakingBriefing" ? (
        <SpeakingBriefingScreen
          session={speakingSession}
          metrics={speakingMetrics}
          onBack={() => setScreen("tasks")}
          onStart={beginSpeakingTask}
          onReport={() => setScreen("speakingReport")}
        />
      ) : null}
      {screen === "speakingWordPractice" ? (
        <SpeakingWordPracticeScreen
          session={speakingSession}
          setSession={setSpeakingSession}
          onExit={() => setScreen("tasks")}
          onCompleted={() => setScreen("speakingCompleted")}
        />
      ) : null}
      {screen === "speakingShadowPractice" ? (
        <SpeakingShadowPracticeScreen
          session={speakingSession}
          setSession={setSpeakingSession}
          onExit={() => setScreen("tasks")}
          onCompleted={() => setScreen("speakingCompleted")}
        />
      ) : null}
      {screen === "speakingCompleted" ? (
        <SpeakingCompletedScreen metrics={speakingMetrics} onReport={() => setScreen("speakingReport")} onContinue={() => setScreen("speakingBriefing")} />
      ) : null}
      {screen === "speakingReport" ? (
        <SpeakingReport session={speakingSession} metrics={speakingMetrics} onRestart={() => beginSpeakingTask("word", true)} onPractice={beginSpeakingTask} />
      ) : null}
    </div>
  );
}

function Sidebar({ screen, selectedTask, session, metrics, buildSession, buildMetrics, speakingSession, speakingMetrics, setScreen }) {
  const buildSelected = selectedTask === "build";
  const speakingSelected = selectedTask === "speaking";
  const currentSession = speakingSelected ? speakingSession : buildSelected ? buildSession : session;
  const mastered = speakingSelected ? speakingMetrics.totalCompleted : buildSelected ? buildMetrics.completed : metrics.mastered;
  const total = speakingSelected ? speakingMetrics.totalItems : buildSelected ? BUILD_WORDS.length : WORDS.length;
  const items = [
    { id: "tasks", target: "tasks", icon: "home", label: "学习任务" },
    { id: "briefing", target: speakingSelected ? "speakingBriefing" : buildSelected ? "buildBriefing" : "briefing", icon: "book", label: "练习说明" },
    { id: "report", target: speakingSelected ? "speakingReport" : buildSelected ? "buildReport" : "report", icon: "chart", label: "学习报告", disabled: currentSession.status !== "completed" },
  ];
  if (!buildSelected && !speakingSelected) {
    items.push({ id: "teacher", target: "teacher", icon: "teacher", label: "教师视角", disabled: session.status !== "completed" });
  }
  const activeId = screen.startsWith("build")
    ? screen === "buildBriefing" ? "briefing" : screen === "buildReport" || screen === "buildCompleted" ? "report" : ""
    : screen.startsWith("speaking")
      ? screen === "speakingBriefing" ? "briefing" : screen === "speakingReport" || screen === "speakingCompleted" ? "report" : ""
    : screen;
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">L</span><div><strong>ListenUp</strong><small>词汇听辨训练</small></div></div>
      <nav className="side-nav">
        {items.map((item) => (
          <button key={item.id} className={activeId === item.id ? "active" : ""} disabled={item.disabled} onClick={() => setScreen(item.target)}>
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
        <b>{mastered} / {total} 词</b>
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

function TasksScreen({ session, metrics, buildSession, buildMetrics, speakingSession, speakingMetrics, onOpen, onReport, onRestart }) {
  return (
    <main className="main">
      <PageHeader title="英语学习任务" subtitle="选择一种练习方式，通过听、拼、说把英语真正用起来。" />
      <section className="task-grid">
        <TaskCard
          task={TASK}
          description="听发音，选择正确中文意思。错题会立即带你重新掌握。"
          tags={["10 个单词", TASK.duration, "听音辨义"]}
          session={session}
          mastered={metrics.mastered}
          total={WORDS.length}
          masteryRate={metrics.masteryRate}
          onOpen={() => onOpen("meaning")}
          onReport={() => onReport("meaning")}
          onRestart={() => onRestart("meaning")}
        />
        <TaskCard
          task={BUILD_TASK}
          description="先根据读音完成构词或拼写，再选择与该词相关的中文释义。"
          tags={["10 个单词", BUILD_TASK.duration, "构词 + 拼写"]}
          session={buildSession}
          mastered={buildMetrics.completed}
          total={BUILD_WORDS.length}
          masteryRate={buildMetrics.masteryRate}
          onOpen={() => onOpen("build")}
          onReport={() => onReport("build")}
          onRestart={() => onRestart("build")}
        />
        <TaskCard
          task={SPEAKING_TASK}
          description="先练单词发音，再做整句影子跟读；录下自己的声音，对照标准音复练。"
          tags={[`${SPEAKING_WORDS.length} 个单词`, `${SHADOW_SENTENCES.length} 个句子`, "发音 + 跟读"]}
          session={speakingSession}
          mastered={speakingMetrics.totalCompleted}
          total={speakingMetrics.totalItems}
          masteryRate={speakingMetrics.completionRate}
          onOpen={() => onOpen("speaking")}
          onReport={() => onReport("speaking")}
          onRestart={() => onRestart("speaking")}
        />
      </section>
      <section className="learning-prompt">
        <h3>今天的学习建议</h3>
        <p>找一个安静环境，先专注听音，再选择适合自己的练习。新任务会帮助你把声音、拼写结构、中文意思和口头表达连接起来。</p>
      </section>
    </main>
  );
}

function TaskCard({ task, description, tags, session, mastered, total, masteryRate, onOpen, onReport, onRestart }) {
  const completed = session.status === "completed";
  const inProgress = session.status === "in_progress";
  return (
    <article className="task-card">
      <div className="task-card-top">
        <div>
          <h2>{task.name}</h2>
          <p>{description}</p>
        </div>
        <div className="task-state">
          <span>{completed ? "已完成" : inProgress ? "进行中" : "待开始"}</span>
          {inProgress ? <strong>{mastered} / {total}</strong> : null}
          {completed ? <strong>{masteryRate}% 完成</strong> : null}
        </div>
      </div>
      <div className="meta-list">
        {tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="task-actions">
        {!completed ? <button className="button primary large" onClick={onOpen}>{inProgress ? "继续练习" : "开始练习"}</button> : null}
        {completed ? <button className="button primary large" onClick={onReport}>查看报告</button> : null}
        {completed ? <button className="button secondary large" onClick={onRestart}>再次练习</button> : null}
      </div>
    </article>
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
          <p><Icon name="check" /> 没有首遍答对的词会在本轮末尾自动再次出现，最多练习三遍。</p>
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
  const entry = session.queue[index];
  const word = WORDS.find((item) => item.id === entry.wordId);
  const result = session.results[word.id];
  const [choice, setChoice] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [audioStatus, setAudioStatus] = useState("ready");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const audioKey = useRef("");
  const options = useMemo(() => (entry.round > 1 ? rotateOptions(word.options, entry.round - 1) : word.options), [entry.round, word]);

  useEffect(() => {
    const key = `${word.id}-${entry.round}`;
    if (audioKey.current !== key) {
      audioKey.current = key;
      speakWord(word, setAudioStatus);
    }
    setChoice(null);
    setFeedback(null);
  }, [entry.round, word]);

  const replay = () => {
    if (audioStatus === "error") setAudioStatus("ready");
    speakWord(word, setAudioStatus);
    setSession((current) => {
      const currentResult = current.results[word.id];
      const field = entry.round === 1 && !feedback ? "firstReplays" : "reviewReplays";
      return { ...current, results: { ...current.results, [word.id]: { ...currentResult, [field]: currentResult[field] + 1 } } };
    });
  };

  const submit = () => {
    if (!choice || audioStatus === "error") return;
    const correct = choice === word.meaning;
    setSession((current) => {
      const currentResult = current.results[word.id];
      return {
        ...current,
        queue: enqueueMeaningReview(current.queue, entry, correct),
        results: {
          ...current.results,
          [word.id]: {
            ...currentResult,
            firstChoice: entry.round === 1 ? choice : currentResult.firstChoice,
            firstCorrect: entry.round === 1 ? correct : currentResult.firstCorrect,
            reviewAttempts: entry.round > 1 ? currentResult.reviewAttempts + 1 : currentResult.reviewAttempts,
            mastered: correct,
            studyRounds: [...currentResult.studyRounds, { round: entry.round, correct, choice }],
          },
        },
      };
    });
    setFeedback(correct ? "correct" : "incorrect");
    if (!correct) speakWord(word, setAudioStatus);
  };

  const next = () => {
    if (index === session.queue.length - 1) {
      setSession((current) => ({ ...current, status: "completed", completedAt: new Date().toISOString() }));
      onCompleted();
      return;
    }
    setSession((current) => ({ ...current, currentIndex: index + 1 }));
    setChoice(null);
    setFeedback(null);
    audioKey.current = "";
  };

  return (
    <main className="practice-layout">
      <section className="practice-stage">
        <div className="practice-top">
          <button className="quiet-button" onClick={() => setLeaveOpen(true)}><Icon name="back" />暂离</button>
          <div className="progress-area">
            <span>{index + 1} / {session.queue.length}</span>
            <div className="progress"><i style={{ width: `${((index + 1) / session.queue.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="question-panel">
          {entry.round > 1 ? <p className="mode-label">循环巩固 · 第 {entry.round} 遍</p> : null}
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
          {!feedback ? <button className="button primary submit" disabled={!choice || audioStatus === "error"} onClick={submit}>确认</button> : null}
          {feedback ? <QuestionFeedback word={word} result={session.results[word.id]} correct={feedback === "correct"} round={entry.round} onReplay={replay} onContinue={next} /> : null}
        </div>
      </section>
      <PracticeAside round={entry.round} result={result} />
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

function PracticeAside({ round, result }) {
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
        <p>{round > 1 ? `正在进行第 ${round} 遍巩固` : "正在首次作答"}</p>
        <span>主动重听 {result.firstReplays + result.reviewReplays} 次</span>
      </div>
    </aside>
  );
}

function QuestionFeedback({ word, result, correct, round, onReplay, onContinue }) {
  const label = correct ? LABELS[getLabel(result)] : null;
  return (
    <div className={`feedback ${correct ? "positive" : "negative"}`}>
      <h2>{correct ? (round > 1 ? "已重新掌握这个词" : "正确，你听出了这个单词。") : `这个词的意思是：${word.meaning}`}</h2>
      <div className="word-reveal">
        <strong>{word.word}</strong><WordMeta word={word} /><b>{word.meaning}</b>
      </div>
      {!correct ? <p>{word.tip} {round < 3 ? "这个词会在本轮后面再次出现。" : "本轮已达到三遍练习上限。"}</p> : null}
      {label ? <span className={`tag ${label.tone}`}>{label.text}</span> : null}
      <div className="feedback-actions">
        <button className="button secondary" onClick={onReplay}><Icon name="volume" />再听一次</button>
        <button className="button primary" onClick={onContinue}>下一题</button>
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
        <p>你通过练习和复习，完成了今天的听音辨义任务。</p>
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
      <p className="report-message">{metrics.mastered === WORDS.length ? "你通过本轮练习掌握了全部单词。" : `本轮结束后仍有 ${WORDS.length - metrics.mastered} 个词需要继续巩固。`}{metrics.reviewed ? ` 有 ${metrics.reviewed} 个单词是在循环复习后掌握的。` : " 本次首答状态稳定，继续保持。"}</p>
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

function WordMeta({ word }) {
  return (
    <>
      <span>{word.phonetic}</span>
      <em>{word.partOfSpeech}</em>
    </>
  );
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
            <div className="word-identity"><strong>{word.word}</strong><WordMeta word={word} /></div>
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
            <p>{word.word} {word.phonetic} {word.partOfSpeech} · {word.tip}</p>
            <button className="button primary" onClick={continueFocused}>{feedback === "correct" ? (position + 1 === ids.length ? "完成巩固" : "下一个词") : "重新选择"}</button>
          </div>
        )}
      </section>
    </main>
  );
}

function BuildBriefingScreen({ buildSession, onBack, onStart }) {
  const [audioStatus, setAudioStatus] = useState("idle");
  const testAudio = () => speakWord(BUILD_WORDS[0], setAudioStatus);
  return (
    <main className="main briefing">
      <button className="text-back" onClick={onBack}><Icon name="back" />返回任务</button>
      <section className="brief-card build-brief">
        <h1>{BUILD_TASK.name}</h1>
        <p className="brief-lead">听音还原英文，再选择对应中文释义</p>
        <div className="brief-stats">
          <div><strong>10</strong><span>题目总数</span></div>
          <div><strong>2</strong><span>作答阶段</span></div>
          <div><strong>不限</strong><span>重听次数</span></div>
        </div>
        <div className="rules">
          <h3>练习规则</h3>
          <p><Icon name="check" /> 可拆词会提供词根与词缀模块，按构词顺序组合。</p>
          <p><Icon name="check" /> 不适合拆解的词直接键盘拼写，输满后自动判断。</p>
          <p><Icon name="check" /> 任一步出现错误的词会排到本轮末尾再练，最多出现三遍。</p>
        </div>
        <button className="audio-check" onClick={testAudio}><Icon name="volume" />试听发音 {audioStatus === "playing" ? "播放中..." : ""}</button>
        {audioStatus === "error" ? <p className="error-note">无法播放发音，请检查浏览器音频权限后重试。</p> : null}
        <button className="button primary block" onClick={onStart}>{buildSession.status === "in_progress" ? "继续练习" : "开始"}</button>
      </section>
    </main>
  );
}

function BuildPracticeScreen({ session, setSession, onExit, onCompleted }) {
  const index = session.currentIndex;
  const entry = session.queue[index];
  const word = BUILD_WORDS.find((item) => item.id === entry.wordId);
  const result = session.results[word.id];
  const [selectedParts, setSelectedParts] = useState([]);
  const [wrongIndexes, setWrongIndexes] = useState([]);
  const [spelling, setSpelling] = useState("");
  const [spellingError, setSpellingError] = useState(false);
  const [formed, setFormed] = useState(false);
  const [wordCompleted, setWordCompleted] = useState(false);
  const [roundHadError, setRoundHadError] = useState(false);
  const [audioStatus, setAudioStatus] = useState("ready");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const audioKey = useRef("");
  const spellingRef = useRef(null);

  useEffect(() => {
    setSelectedParts([]);
    setWrongIndexes([]);
    setSpelling("");
    setSpellingError(false);
    setFormed(false);
    setWordCompleted(false);
    setRoundHadError(false);
  }, [entry.round, word]);

  useEffect(() => {
    const phase = wordCompleted ? "completed" : formed ? "meaning" : "formation";
    const key = `${word.id}-${entry.round}-${phase}`;
    if (audioKey.current !== key) {
      audioKey.current = key;
      speakWord(word, setAudioStatus);
    }
  }, [entry.round, formed, word, wordCompleted]);

  useEffect(() => {
    if (!formed && word.responseMode === "spell") {
      spellingRef.current?.focus();
    }
  }, [formed, word.responseMode]);

  const replay = () => {
    speakWord(word, setAudioStatus);
    if (!formed && word.responseMode === "spell") {
      requestAnimationFrame(() => {
        spellingRef.current?.focus();
        if (spellingError) spellingRef.current?.select();
      });
    }
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        [word.id]: { ...current.results[word.id], replays: current.results[word.id].replays + 1 },
      },
    }));
  };

  const saveFormationAttempt = (correct, wrongSpelling = null) => {
    setSession((current) => {
      const currentResult = current.results[word.id];
      return {
        ...current,
        results: {
          ...current.results,
          [word.id]: {
            ...currentResult,
            formationAttempts: currentResult.formationAttempts + 1,
            formationFirstCorrect: entry.round === 1 && currentResult.formationFirstCorrect === null ? correct : currentResult.formationFirstCorrect,
            wrongSpellings: wrongSpelling ? [...currentResult.wrongSpellings, wrongSpelling] : currentResult.wrongSpellings,
          },
        },
      };
    });
  };

  const choosePart = (part) => {
    if (!wrongIndexes.length && (selectedParts.includes(part) || selectedParts.length === word.parts.length)) return;
    const next = wrongIndexes.length ? [part] : [...selectedParts, part];
    if (wrongIndexes.length) setWrongIndexes([]);
    setSelectedParts(next);
    if (next.length !== word.parts.length) return;
    const incorrect = next.flatMap((selected, position) => selected === word.parts[position] ? [] : [position]);
    if (incorrect.length) {
      setWrongIndexes(incorrect);
      setRoundHadError(true);
      saveFormationAttempt(false);
      return;
    }
    saveFormationAttempt(true);
    setFormed(true);
  };

  const changeSpelling = (event) => {
    const value = event.target.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, word.word.length);
    setSpelling(value);
    setSpellingError(false);
    if (value.length !== word.word.length) return;
    if (value === word.word) {
      saveFormationAttempt(true);
      setFormed(true);
      return;
    }
    saveFormationAttempt(false, value);
    setRoundHadError(true);
    setSpellingError(true);
    requestAnimationFrame(() => {
      spellingRef.current?.focus();
      spellingRef.current?.select();
    });
  };

  const submitMeaning = (choice) => {
    const correct = choice === word.meaning;
    const needsReview = roundHadError || !correct;
    setSession((current) => {
      const currentResult = current.results[word.id];
      const willReview = needsReview && entry.round < 3;
      return {
        ...current,
        queue: correct ? enqueueBuildReview(current.queue, entry, needsReview) : current.queue,
        results: {
          ...current.results,
          [word.id]: {
            ...currentResult,
            meaningAttempts: currentResult.meaningAttempts + 1,
            meaningFirstCorrect: entry.round === 1 && currentResult.meaningFirstCorrect === null ? correct : currentResult.meaningFirstCorrect,
            wrongMeanings: correct || currentResult.wrongMeanings.includes(choice)
              ? currentResult.wrongMeanings
              : [...currentResult.wrongMeanings, choice],
            completed: correct && !willReview,
            studyRounds: correct
              ? [...currentResult.studyRounds, { round: entry.round, hadError: needsReview }]
              : currentResult.studyRounds,
          },
        },
      };
    });
    if (!correct) {
      setRoundHadError(true);
      speakWord(word, setAudioStatus);
      return;
    }
    setWordCompleted(true);
  };

  const next = () => {
    if (index === session.queue.length - 1) {
      setSession((current) => ({ ...current, status: "completed", completedAt: new Date().toISOString() }));
      onCompleted();
      return;
    }
    setSession((current) => ({ ...current, currentIndex: index + 1 }));
    audioKey.current = "";
  };

  return (
    <main className="practice-layout build-practice">
      <section className="practice-stage">
        <div className="practice-top">
          <button className="quiet-button" onClick={() => setLeaveOpen(true)}><Icon name="back" />暂离</button>
          <div className="progress-area">
            <span>{index + 1} / {session.queue.length}</span>
            <div className="progress"><i style={{ width: `${((index + 1) / session.queue.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="question-panel build-panel">
          <p className="mode-label">{wordCompleted ? "本词完成" : entry.round > 1 ? `循环巩固 · 第 ${entry.round} 遍` : formed ? "第 2 步：理解词义" : "第 1 步：还原英文"}</p>
          <h1>{wordCompleted ? "跟随发音，再记一次这个单词" : formed ? "选择与这个单词对应的中文释义" : word.responseMode === "build" ? "听发音，按构词顺序组合单词" : "听发音，输入完整拼写"}</h1>
          <button className={`play-circle ${audioStatus === "playing" ? "speaking" : ""}`} onClick={replay} aria-label="播放单词发音">
            <Icon name="volume" />
          </button>
          <button className="replay-link" onClick={replay}>再听一次</button>
          {audioStatus === "error" ? <div className="audio-error">发音加载失败，请重新加载后再作答。<button onClick={replay}>重新加载</button></div> : null}
          {!formed && word.responseMode === "build" ? (
            <BuildFormationQuestion
              word={word}
              selectedParts={selectedParts}
              wrongIndexes={wrongIndexes}
              onChoose={choosePart}
              onUndo={() => setSelectedParts((current) => current.slice(0, -1))}
            />
          ) : null}
          {!formed && word.responseMode === "spell" ? (
            <SpellingQuestion
              word={word}
              value={spelling}
              inputRef={spellingRef}
              wrongSpellings={result.wrongSpellings}
              showError={spellingError}
              onChange={changeSpelling}
            />
          ) : null}
          {formed && !wordCompleted ? (
            <MeaningQuestion word={word} result={result} onChoose={submitMeaning} />
          ) : null}
          {wordCompleted ? <BuildWordFeedback word={word} result={result} round={entry.round} needsReview={roundHadError} onReplay={replay} onContinue={next} /> : null}
        </div>
      </section>
      <BuildPracticeAside word={word} result={result} round={entry.round} formed={formed} />
      {leaveOpen ? <ExitDialog onStay={() => setLeaveOpen(false)} onLeave={onExit} /> : null}
    </main>
  );
}

function BuildFormationQuestion({ word, selectedParts, wrongIndexes, onChoose, onUndo }) {
  const canUndoFromSlot = !wrongIndexes.length && selectedParts.length > 0 && selectedParts.length < word.parts.length;
  return (
    <div className="formation-question">
      <div className="assembly-slots" aria-label="已选择的构词模块">
        {word.parts.map((part, index) => {
          const selectedPart = selectedParts[index];
          const stateClass = `${selectedPart ? "filled" : ""} ${wrongIndexes.length ? (wrongIndexes.includes(index) ? "incorrect" : "correct") : ""}`;
          return selectedPart && canUndoFromSlot ? (
            <button key={`${part}-${index}`} className={stateClass} onClick={onUndo} aria-label={`撤回已选择的 ${selectedPart}`}>
              {selectedPart}
            </button>
          ) : (
            <span key={`${part}-${index}`} className={stateClass}>{selectedPart || ""}</span>
          );
        })}
      </div>
      <p className="formation-guide">从下面选择前缀、词根或后缀，按顺序放入。</p>
      <div className="tile-bank">
        {word.tiles.map((part) => (
          <button key={part} disabled={!wrongIndexes.length && selectedParts.includes(part)} className={!wrongIndexes.length && selectedParts.includes(part) ? "used" : ""} onClick={() => onChoose(part)}>{part}</button>
        ))}
      </div>
      {!wrongIndexes.length ? <div className="formation-actions"><button className="button secondary" disabled={!selectedParts.length} onClick={onUndo}>撤回上一步</button></div> : null}
    </div>
  );
}

function SpellingQuestion({ word, value, inputRef, wrongSpellings, showError, onChange }) {
  const earlierAttempts = showError ? wrongSpellings.slice(0, -1) : wrongSpellings;
  const showAnswer = wrongSpellings.length >= 2;
  const firstMismatch = showError ? Array.from(value).findIndex((letter, index) => letter !== word.word[index]) : -1;
  return (
    <div className="spelling-question">
      <label className="spelling-slots">
        <span className="sr-only">输入听到的英文单词</span>
        <input ref={inputRef} value={value} onChange={onChange} maxLength={word.word.length} autoComplete="off" spellCheck="false" aria-label="输入听到的英文单词" />
        <span className={`letter-slots ${showError ? "failed" : ""}`} aria-hidden="true">
          {Array.from({ length: word.word.length }, (_, index) => (
            <i key={index} className={showError ? index < firstMismatch ? "correct-prefix" : "incorrect-suffix" : ""}>
              {value[index] || ""}
            </i>
          ))}
        </span>
      </label>
      <p className={`spelling-guide ${showError ? "error" : ""}`}>{showError ? "这次拼写不正确，直接重新输入即可。" : "使用键盘输入；字母输满后自动判断。"}</p>
      {showAnswer ? <p className="spelling-answer">正确拼写：<strong>{word.word}</strong></p> : null}
      {earlierAttempts.length ? (
        <div className="spelling-history">
          <small>已尝试</small>
          {earlierAttempts.map((attempt, index) => <span key={`${attempt}-${index}`}>{attempt}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function MeaningQuestion({ word, result, onChoose }) {
  return (
    <div className="build-meaning-question">
      <div className="formed-word"><strong>{word.word}</strong><WordMeta word={word} /></div>
      <div className="options">
        {word.meaningOptions.map((option) => {
          const wrong = result.wrongMeanings.includes(option);
          return (
            <button key={option} disabled={wrong} className={`option ${wrong ? "wrong tried" : ""}`} onClick={() => onChoose(option)}>
              {option}
            </button>
          );
        })}
      </div>
      {result.wrongMeanings.length ? <p className="meaning-retry">这个释义不匹配，请再听一次并重新选择。</p> : null}
    </div>
  );
}

function BuildWordFeedback({ word, result, round, needsReview, onReplay, onContinue }) {
  return (
    <div className="feedback positive build-feedback">
      <h2>完成：你已经连接了读音、拼写和词义</h2>
      <div className="word-reveal">
        <strong>{word.word}</strong><WordMeta word={word} /><b>{word.meaning}</b>
      </div>
      {word.responseMode === "build" ? (
        <div className="morphology-reveal">
          {word.morphology.map((piece) => <span key={piece.part}><strong>{piece.part}</strong>{piece.meaning}</span>)}
        </div>
      ) : <p>{word.spellingTip}</p>}
      <span className={`tag ${result.formationFirstCorrect && result.meaningFirstCorrect ? "success" : "primary"}`}>
        {result.formationFirstCorrect && result.meaningFirstCorrect ? "两步首答正确" : "已通过练习掌握"}
      </span>
      {needsReview ? <p className="cycle-note">{round < 3 ? "本次出现过错误，这个词会在本轮后面再次出现。" : "本词已完成最多三遍练习。"}</p> : null}
      <div className="feedback-actions">
        <button className="button secondary" onClick={onReplay}><Icon name="volume" />再听一次</button>
        <button className="button primary" onClick={onContinue}>下一题</button>
      </div>
    </div>
  );
}

function BuildPracticeAside({ word, result, round, formed }) {
  return (
    <aside className="practice-aside">
      <h2>本次目标</h2>
      <p>先听出英文结构或拼写，再把声音与中文含义连接起来。</p>
      <div className="tip-card">
        <h3>{word.responseMode === "build" ? "构词提示" : "拼写提示"}</h3>
        <p>{word.responseMode === "build" ? "优先辨认前缀、词根和后缀，不会提前展示正确组合。" : "根据完整读音输入，错误尝试会保留供你比较。"}</p>
      </div>
      <div className="status-card">
        <h3>当前单词</h3>
        <p>{formed ? "正在辨认中文释义" : word.responseMode === "build" ? "正在组合构词模块" : "正在键盘拼写"}</p>
        {round > 1 ? <span>循环巩固第 {round} 遍 · </span> : null}
        <span>主动重听 {result.replays} 次</span>
      </div>
    </aside>
  );
}

function BuildCompletedScreen({ metrics, onReport }) {
  return (
    <main className="main completion">
      <section className="completion-card">
        <div className="completion-check"><Icon name="check" /></div>
        <h1>构词与释义练习完成</h1>
        <p>你已经完成 10 个单词的听音还原和中文释义练习。</p>
        <div className="completion-stats">
          <div><strong>{BUILD_WORDS.length}</strong><span>学习题数</span></div>
          <div><strong>{metrics.formationRate}%</strong><span>英文首答</span></div>
          <div><strong>{metrics.meaningRate}%</strong><span>释义首答</span></div>
          <div><strong>{metrics.focus.length}</strong><span>建议巩固</span></div>
        </div>
        <button className="button primary large" onClick={onReport}>查看学习报告</button>
      </section>
    </main>
  );
}

function BuildReport({ session, metrics, onRestart }) {
  return (
    <main className="main report build-report">
      <PageHeader title={`${BUILD_TASK.name} · 学习报告`} subtitle="分别查看英文还原与中文释义的掌握情况。" />
      <section className="summary-grid">
        <Metric value={`${metrics.completed}/${BUILD_WORDS.length}`} label="最终完成" tone="success" />
        <Metric value={`${metrics.formationRate}%`} label="英文还原首答" />
        <Metric value={`${metrics.meaningRate}%`} label="中文释义首答" />
        <Metric value={`${metrics.focus.length} 词`} label="建议巩固" tone="warning" />
      </section>
      <p className="report-message">
        {metrics.focus.length
          ? `有 ${metrics.focus.length} 个词在构词、拼写或释义环节经过重试后掌握，建议再次听写巩固。`
          : "你在英文还原和中文释义两步都表现稳定。"}
      </p>
      <section className="build-word-list">
        {BUILD_WORDS.map((word) => {
          const result = session.results[word.id];
          return (
            <article className="build-word-row" key={word.id}>
              <div className="word-identity"><strong>{word.word}</strong><WordMeta word={word} /></div>
              <span className="mode-chip">{word.responseMode === "build" ? "构词组合" : "整体拼写"}</span>
              <span className={result.formationFirstCorrect ? "answer-good" : "answer-bad"}>英文{result.formationFirstCorrect ? "首答正确" : "经重试"}</span>
              <span className={result.meaningFirstCorrect ? "answer-good" : "answer-bad"}>释义{result.meaningFirstCorrect ? "首答正确" : "经重试"}</span>
              <button className="row-audio" onClick={() => speakWord(word, () => {})}><Icon name="volume" /></button>
              {word.responseMode === "build" ? (
                <div className="row-morphology">{word.morphology.map((piece) => <small key={piece.part}>{piece.part} {piece.meaning}</small>)}</div>
              ) : <small className="row-morphology">{word.spellingTip}</small>}
            </article>
          );
        })}
      </section>
      <div className="report-actions">
        <button className="button primary large" onClick={onRestart}>重新练习全部单词</button>
      </div>
    </main>
  );
}

function SpeakingBriefingScreen({ session, metrics, onBack, onStart, onReport }) {
  const [audioStatus, setAudioStatus] = useState("idle");
  const sampleSentence = SHADOW_SENTENCES[0];
  const hasReport = session.status === "completed";
  return (
    <main className="main briefing">
      <button className="text-back" onClick={onBack}><Icon name="back" />返回任务</button>
      <section className="speaking-brief">
        <div className="speaking-brief-copy">
          <h1>{SPEAKING_TASK.name}</h1>
          <p>先把单词读准，再把整句跟上。这个任务会记录录音次数、标准音播放和需要复练的内容。</p>
          <div className="brief-stats speaking-stats">
            <div><strong>{SPEAKING_WORDS.length}</strong><span>发音词</span></div>
            <div><strong>{SHADOW_SENTENCES.length}</strong><span>跟读句</span></div>
            <div><strong>{metrics.averageRecordings}</strong><span>平均录音</span></div>
          </div>
          <button className="audio-check" onClick={() => speakText(sampleSentence.sentence, setAudioStatus, { rate: 0.82 })}>
            <Icon name="headphones" />试听整句 {audioStatus === "playing" ? "播放中..." : ""}
          </button>
          {audioStatus === "error" ? <p className="error-note">无法播放标准音，请检查浏览器音频权限后重试。</p> : null}
          {hasReport ? <button className="button secondary block" onClick={onReport}>查看已有报告</button> : null}
        </div>
        <div className="speaking-mode-grid">
          <SpeakingModeCard
            icon="mic"
            title="单词发音练习"
            body="听标准音，观察音节和重音，录下自己的读音并回放对照。"
            meta={`${metrics.wordCompleted} / ${SPEAKING_WORDS.length} 完成`}
            onClick={() => onStart("word", false)}
          />
          <SpeakingModeCard
            icon="headphones"
            title="整句影子跟读"
            body="先听整句，再按意群跟读，最后录完整句训练节奏和表达。"
            meta={`${metrics.sentenceCompleted} / ${SHADOW_SENTENCES.length} 完成`}
            onClick={() => onStart("shadow", false)}
          />
        </div>
      </section>
    </main>
  );
}

function SpeakingModeCard({ icon, title, body, meta, onClick }) {
  return (
    <button className="speaking-mode-card" onClick={onClick}>
      <span className="mode-icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      <p>{body}</p>
      <small>{meta}</small>
    </button>
  );
}

function SpeakingWordPracticeScreen({ session, setSession, onExit, onCompleted }) {
  const index = Math.min(session.currentWordIndex, SPEAKING_WORDS.length - 1);
  const word = SPEAKING_WORDS[index];
  const result = session.results.words[word.id];
  const [audioStatus, setAudioStatus] = useState("ready");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const recorder = useRecorder();

  useEffect(() => {
    recorder.clear();
  }, [word.id]);

  const playStandard = () => {
    speakWord(word, setAudioStatus);
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        words: {
          ...current.results.words,
          [word.id]: { ...current.results.words[word.id], standardPlays: current.results.words[word.id].standardPlays + 1 },
        },
      },
    }));
  };

  const startRecording = async () => {
    const started = await recorder.start();
    if (!started) return;
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        words: {
          ...current.results.words,
          [word.id]: { ...current.results.words[word.id], recordings: current.results.words[word.id].recordings + 1 },
        },
      },
    }));
  };

  const finishWord = (selfRating) => {
    const needsReview = selfRating === "review";
    setSession((current) => {
      const words = {
        ...current.results.words,
        [word.id]: {
          ...current.results.words[word.id],
          completed: true,
          needsReview,
          selfRating,
          completedAt: new Date().toISOString(),
        },
      };
      const completedWords = Object.values(words).filter((item) => item.completed).length;
      const allDone = completedWords === SPEAKING_WORDS.length && getSpeakingMetrics({ ...current, results: { ...current.results, words } }).sentenceCompleted === SHADOW_SENTENCES.length;
      return {
        ...current,
        status: allDone ? "completed" : current.status,
        completedAt: allDone ? new Date().toISOString() : current.completedAt,
        results: { ...current.results, words },
      };
    });
    if (index === SPEAKING_WORDS.length - 1) onCompleted();
    else setSession((current) => ({ ...current, currentWordIndex: index + 1 }));
  };

  return (
    <main className="practice-layout speaking-practice">
      <section className="practice-stage">
        <div className="practice-top">
          <button className="quiet-button" onClick={() => setLeaveOpen(true)}><Icon name="back" />暂离</button>
          <div className="progress-area">
            <span>{index + 1} / {SPEAKING_WORDS.length}</span>
            <div className="progress"><i style={{ width: `${((index + 1) / SPEAKING_WORDS.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="question-panel speaking-panel">
          <p className="mode-label">单词发音</p>
          <h1>听标准音，录下自己的发音</h1>
          <div className="speaking-word-main">
            <strong>{word.word}</strong>
            <WordMeta word={word} />
            <b>{word.meaning}</b>
          </div>
          <SyllableStrip syllables={word.syllables} stress={word.stress} />
          <div className="speaking-controls">
            <button className={`play-circle ${audioStatus === "playing" ? "speaking" : ""}`} onClick={playStandard} aria-label="播放标准发音"><Icon name="volume" /></button>
            <RecorderControl recorder={recorder} onStart={startRecording} />
          </div>
          <RecordingPlayback recorder={recorder} />
          <div className="pronunciation-tips">
            {word.pronunciationTips.map((tip) => <span key={tip}>{tip}</span>)}
          </div>
          {recorder.error ? <p className="error-note">{recorder.error}</p> : null}
          {audioStatus === "error" ? <p className="error-note">标准音播放失败，请重新加载后再试。</p> : null}
          <div className="speaking-actions">
            <button className="button secondary" disabled={!recorder.audioUrl} onClick={() => recorder.clear()}>再录一次</button>
            <button className="button secondary" disabled={!recorder.audioUrl} onClick={() => finishWord("review")}>加入复练</button>
            <button className="button primary" disabled={!recorder.audioUrl} onClick={() => finishWord("mastered")}>标记已掌握</button>
          </div>
        </div>
      </section>
      <SpeakingPracticeAside title="本次目标" body="把标准音、自己的录音和音节重音放在一起比较。" result={result} />
      {leaveOpen ? <ExitDialog onStay={() => setLeaveOpen(false)} onLeave={onExit} /> : null}
    </main>
  );
}

function SyllableStrip({ syllables, stress }) {
  return (
    <div className="pronunciation-chunks">
      <small>发音分块</small>
      <div className="syllable-strip">
        {syllables.map((syllable) => <span key={syllable} className={syllable === stress ? "stressed" : ""}>{syllable}</span>)}
      </div>
    </div>
  );
}

function RecorderControl({ recorder, onStart }) {
  if (recorder.status === "recording") {
    return <button className="record-circle recording" onClick={recorder.stop} aria-label="停止录音"><Icon name="stop" /></button>;
  }
  return <button className="record-circle" onClick={onStart} aria-label="开始录音"><Icon name="mic" /></button>;
}

function RecordingPlayback({ recorder }) {
  return (
    <div className={`recording-playback ${recorder.audioUrl ? "ready" : ""}`}>
      <span>{recorder.status === "recording" ? "正在录音..." : recorder.audioUrl ? "已录好，可以回放对照" : "点击麦克风录下你的声音"}</span>
      {recorder.audioUrl ? <audio src={recorder.audioUrl} controls /> : null}
    </div>
  );
}

function SpeakingShadowPracticeScreen({ session, setSession, onExit, onCompleted }) {
  const index = Math.min(session.currentSentenceIndex, SHADOW_SENTENCES.length - 1);
  const sentence = SHADOW_SENTENCES[index];
  const result = session.results.sentences[sentence.id];
  const [audioStatus, setAudioStatus] = useState("ready");
  const [speedId, setSpeedId] = useState("normal");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const recorder = useRecorder();
  const speed = SPEECH_SPEEDS.find((item) => item.id === speedId) || SPEECH_SPEEDS[1];

  useEffect(() => {
    recorder.clear();
  }, [sentence.id]);

  const playStandard = () => {
    const text = sentence.sentence;
    speakText(text, setAudioStatus, {
      rate: speed.rate,
    });
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        sentences: {
          ...current.results.sentences,
          [sentence.id]: { ...current.results.sentences[sentence.id], standardPlays: current.results.sentences[sentence.id].standardPlays + 1 },
        },
      },
    }));
  };

  const startRecording = async () => {
    const started = await recorder.start();
    if (!started) return;
    setSession((current) => ({
      ...current,
      results: {
        ...current.results,
        sentences: {
          ...current.results.sentences,
          [sentence.id]: { ...current.results.sentences[sentence.id], recordings: current.results.sentences[sentence.id].recordings + 1 },
        },
      },
    }));
  };

  const finishSentence = (selfRating) => {
    const needsReview = selfRating === "review";
    setSession((current) => {
      const sentences = {
        ...current.results.sentences,
        [sentence.id]: {
          ...current.results.sentences[sentence.id],
          completed: true,
          needsReview,
          selfRating,
          completedAt: new Date().toISOString(),
        },
      };
      const completedSentences = Object.values(sentences).filter((item) => item.completed).length;
      const allDone = completedSentences === SHADOW_SENTENCES.length && getSpeakingMetrics({ ...current, results: { ...current.results, sentences } }).wordCompleted === SPEAKING_WORDS.length;
      return {
        ...current,
        status: allDone ? "completed" : current.status,
        completedAt: allDone ? new Date().toISOString() : current.completedAt,
        results: { ...current.results, sentences },
      };
    });
    if (index === SHADOW_SENTENCES.length - 1) onCompleted();
    else setSession((current) => ({ ...current, currentSentenceIndex: index + 1 }));
  };

  return (
    <main className="practice-layout speaking-practice">
      <section className="practice-stage">
        <div className="practice-top">
          <button className="quiet-button" onClick={() => setLeaveOpen(true)}><Icon name="back" />暂离</button>
          <div className="progress-area">
            <span>{index + 1} / {SHADOW_SENTENCES.length}</span>
            <div className="progress"><i style={{ width: `${((index + 1) / SHADOW_SENTENCES.length) * 100}%` }} /></div>
          </div>
        </div>
        <div className="question-panel speaking-panel shadow-panel">
          <p className="mode-label">影子跟读</p>
          <h1>先听整句，再跟读录音</h1>
          <SpeedControl value={speedId} onChange={setSpeedId} />
          <div className="shadow-sentence">
            <div className="shadow-line">
              {sentence.chunks.map((chunk, chunkIndex) => (
                <span key={chunk.text} className={`shadow-chunk tone-${chunkIndex % 3}`}>
                  <strong>{chunk.text}{chunkIndex === sentence.chunks.length - 1 ? "." : ""}</strong>
                  <small>{chunk.cue}</small>
                </span>
              ))}
            </div>
            <span>{sentence.translation}</span>
          </div>
          <p className="shadow-tip">{sentence.shadowTip}</p>
          <div className="speaking-controls">
            <button className={`play-circle ${audioStatus === "playing" ? "speaking" : ""}`} onClick={() => playStandard()} aria-label="播放整句"><Icon name="volume" /></button>
            <RecorderControl recorder={recorder} onStart={startRecording} />
          </div>
          <RecordingPlayback recorder={recorder} />
          {recorder.error ? <p className="error-note">{recorder.error}</p> : null}
          {audioStatus === "error" ? <p className="error-note">标准音播放失败，请重新加载后再试。</p> : null}
          <div className="speaking-actions">
            <button className="button secondary" disabled={!recorder.audioUrl} onClick={() => recorder.clear()}>再录一次</button>
            <button className="button secondary" disabled={!recorder.audioUrl} onClick={() => finishSentence("review")}>加入复练</button>
            <button className="button primary" disabled={!recorder.audioUrl} onClick={() => finishSentence("mastered")}>完成本句</button>
          </div>
        </div>
      </section>
      <SpeakingPracticeAside title="跟读提示" body="看色块停顿，先听整句，再按色块跟读。速度不够稳时先用慢速。" result={result} />
      {leaveOpen ? <ExitDialog onStay={() => setLeaveOpen(false)} onLeave={onExit} /> : null}
    </main>
  );
}

function SpeedControl({ value, onChange }) {
  return (
    <div className="speed-control" aria-label="语速选择">
      {SPEECH_SPEEDS.map((speed) => (
        <button key={speed.id} className={value === speed.id ? "active" : ""} onClick={() => onChange(speed.id)}>
          {speed.label}
        </button>
      ))}
    </div>
  );
}

function SpeakingPracticeAside({ title, body, result }) {
  return (
    <aside className="practice-aside">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="tip-card">
        <h3>练习证据</h3>
        <p>标准音播放 {result.standardPlays} 次，已录音 {result.recordings} 次。</p>
      </div>
      <div className="status-card">
        <h3>当前状态</h3>
        <p>{result.completed ? "已完成" : "正在练习"}</p>
        <span>{result.needsReview ? "已加入复练" : "完成后可自行标记是否复练"}</span>
      </div>
    </aside>
  );
}

function SpeakingCompletedScreen({ metrics, onReport, onContinue }) {
  const allDone = metrics.totalCompleted === metrics.totalItems;
  return (
    <main className="main completion">
      <section className="completion-card">
        <div className="completion-check"><Icon name="check" /></div>
        <h1>{allDone ? "口语表达任务完成" : "本组口语练习完成"}</h1>
        <p>{allDone ? "你已经完成单词发音和整句跟读。" : "可以继续完成另一个口语模式，形成完整练习记录。"}</p>
        <div className="completion-stats">
          <div><strong>{metrics.wordCompleted}</strong><span>发音词</span></div>
          <div><strong>{metrics.sentenceCompleted}</strong><span>跟读句</span></div>
          <div><strong>{metrics.averageRecordings}</strong><span>平均录音</span></div>
          <div><strong>{metrics.review.length}</strong><span>复练项</span></div>
        </div>
        <button className="button primary large" onClick={allDone ? onReport : onContinue}>{allDone ? "查看学习报告" : "继续口语模式"}</button>
        <button className="button secondary large" onClick={onReport}>查看当前报告</button>
      </section>
    </main>
  );
}

function SpeakingReport({ session, metrics, onRestart, onPractice }) {
  return (
    <main className="main report speaking-report">
      <PageHeader title={`${SPEAKING_TASK.name} · 学习报告`} subtitle="报告只记录练习证据和自评复练，不做虚假的精准发音评分。" />
      <section className="summary-grid">
        <Metric value={`${metrics.totalCompleted}/${metrics.totalItems}`} label="完成进度" tone="success" />
        <Metric value={`${metrics.wordCompleted}/${SPEAKING_WORDS.length}`} label="单词发音" />
        <Metric value={`${metrics.sentenceCompleted}/${SHADOW_SENTENCES.length}`} label="影子跟读" />
        <Metric value={`${metrics.review.length} 项`} label="建议复练" tone="warning" />
      </section>
      <p className="report-message">
        本次共播放标准音 {metrics.plays} 次，录音 {metrics.recordings} 次，平均每个已完成项目录音 {metrics.averageRecordings} 次。
      </p>
      <section className="speaking-report-list">
        <SpeakingReportGroup title="单词发音" items={SPEAKING_WORDS} results={session.results.words} type="word" />
        <SpeakingReportGroup title="影子跟读" items={SHADOW_SENTENCES} results={session.results.sentences} type="sentence" />
      </section>
      <div className="report-actions">
        <button className="button primary large" onClick={() => onPractice("word", false)}>继续单词发音</button>
        <button className="button primary large" onClick={() => onPractice("shadow", false)}>继续影子跟读</button>
        <button className="button secondary large" onClick={onRestart}>重新练习全部口语</button>
      </div>
    </main>
  );
}

function SpeakingReportGroup({ title, items, results, type }) {
  return (
    <div className="word-group speaking-group">
      <header><h2>{title}</h2><p>{type === "word" ? "发音、重音和音节练习记录" : "整句听力输入与表达练习记录"}</p></header>
      {items.map((item) => {
        const result = results[item.id];
        return (
          <div className="speaking-report-row" key={item.id}>
            <div className="word-identity">
              <strong>{type === "word" ? item.word : item.sentence}</strong>
              {type === "word" ? <WordMeta word={item} /> : null}
            </div>
            <span className={`tag ${result.completed ? "success" : "warning"}`}>{result.completed ? "已完成" : "未完成"}</span>
            <span>{result.recordings} 次录音</span>
            <span>{result.standardPlays} 次标准音</span>
            <span className={`tag ${result.needsReview ? "warning" : "primary"}`}>{result.needsReview ? "建议复练" : result.completed ? "自评掌握" : "待练习"}</span>
          </div>
        );
      })}
    </div>
  );
}

export default App;
