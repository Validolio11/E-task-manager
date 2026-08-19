import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Clock3,
  Download,
  Edit3,
  FolderPlus,
  Home,
  Pause,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  addCalendarDays,
  AppSettings,
  experienceForHours,
  focusStage,
  formatDuration,
  formatTimer,
  INBOX_PROJECT_ID,
  Project,
  sessionDuration,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  Task,
  totalInside,
  ViewKey,
} from "./domain";
import { UpdateControl } from "./features/updater/UpdateControl";
import { AiAssistant } from "./features/ai/AiAssistant";
import { AiSettings } from "./features/ai/AiSettings";
import { WindowTitlebar } from "./components/WindowTitlebar";
import { ConfirmDialog, ConfirmOptions, RequestConfirmation } from "./components/ConfirmDialog";
import { useFocusStore } from "./useFocusStore";

const navItems: { key: ViewKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Головна", icon: Home },
  { key: "projects", label: "Проєкти", icon: BriefcaseBusiness },
  { key: "analytics", label: "Аналітика", icon: BarChart3 },
  { key: "skills", label: "Навички", icon: Trophy },
  { key: "ai", label: "AI-помічник", icon: Bot },
  { key: "settings", label: "Налаштування", icon: Settings },
];

const skillSuggestions = ["After Effects", "Figma", "Blender", "Cinema 4D", "Illustrator", "Монтаж", "Інше"];
const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

type Store = ReturnType<typeof useFocusStore>;
type ModalState =
  | { kind: "project"; project?: Project }
  | { kind: "task"; task?: Task; projectId?: string }
  | null;

function projectOf(task: Task | null | undefined, projects: Project[]) {
  return task ? projects.find((project) => project.id === task.projectId) ?? null : null;
}

function App() {
  const store = useFocusStore();
  const [view, setView] = useState<ViewKey>("home");
  const [modal, setModal] = useState<ModalState>(null);
  const [confirmation, setConfirmation] = useState<ConfirmOptions | null>(null);
  const requestConfirmation: RequestConfirmation = (options) => setConfirmation(options);

  useEffect(() => {
    document.documentElement.dataset.theme = store.data.settings.theme;
    document.documentElement.dataset.accent = store.data.settings.accent;
    document.documentElement.dataset.compact = String(store.data.settings.compact);
  }, [store.data.settings]);

  const openQuickAdd = () => setModal({ kind: "task" });

  if (store.loading) {
    return <div className="app-window"><WindowTitlebar/><main className="loading-screen"><img src="/app-icon.svg" alt=""/><strong>E-task</strong><span>Відкриваємо локальні дані…</span></main></div>;
  }

  return (
    <div className="app-window">
    <WindowTitlebar/>
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Відкрити головну">
          <img className="brand-mark" src="/app-icon.svg" alt="" />
          <span className="brand-copy"><strong>E-task</strong><small>Фокус. Час. Прогрес.</small></span>
        </button>

        <nav className="nav-pill" aria-label="Головна навігація">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button className={`nav-item ${view === key ? "active" : ""}`} key={key} onClick={() => setView(key)} title={label} data-label={label} aria-label={label} aria-current={view === key ? "page" : undefined}>
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className="quick-add" onClick={openQuickAdd}><Plus size={18} strokeWidth={2.6}/> <span>Додати задачу</span></button>
        </div>
      </header>

      <div className="app-content">
        {view === "home" && <HomePage store={store} setView={setView} openModal={setModal} requestConfirmation={requestConfirmation} />}
        {view === "projects" && <ProjectsPage store={store} openModal={setModal} requestConfirmation={requestConfirmation} />}
        {view === "analytics" && <AnalyticsPage store={store} />}
        {view === "skills" && <SkillsPage store={store} />}
        {view === "ai" && <AiAssistant data={store.data} now={store.now} createProject={store.createProject} createTask={store.createTask} updateTask={store.updateTask} completeTask={store.completeTask} updateSettings={store.updateSettings} onOpenSettings={() => setView("settings")} requestConfirmation={requestConfirmation}/>}
        {view === "settings" && <SettingsPage store={store} requestConfirmation={requestConfirmation} />}
      </div>

      {modal?.kind === "project" && (
        <ProjectModal
          project={modal.project}
          onClose={() => setModal(null)}
          onSave={(input) => {
            if (modal.project) store.updateProject(modal.project.id, input);
            else store.createProject(input);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "task" && (
        <TaskModal
          task={modal.task}
          initialProjectId={modal.projectId}
          projects={store.data.projects.filter((project) => project.status === "active")}
          presets={store.data.settings.focusPresets}
          onClose={() => setModal(null)}
          onSave={(input, startAfterSave) => {
            const id = modal.task ? modal.task.id : store.createTask(input);
            if (modal.task) store.updateTask(modal.task.id, input);
            if (startAfterSave) store.startTask(id, input.targetMinutes);
            setModal(null);
          }}
        />
      )}
      {confirmation && <ConfirmDialog options={confirmation} onClose={() => setConfirmation(null)}/>}
      {store.notice && <div className="toast" role="status"><CheckCircle2 size={18}/><span>{store.notice}</span></div>}
    </main>
    </div>
  );
}

function HomePage({ store, setView, openModal, requestConfirmation }: { store: Store; setView: (view: ViewKey) => void; openModal: (modal: ModalState) => void; requestConfirmation: RequestConfirmation }) {
  const { data, activeTask, activeSession, now } = store;
  const activeProject = projectOf(activeTask, data.projects);
  const elapsed = activeSession ? sessionDuration(activeSession, now) : 0;
  const targetMs = (activeSession?.targetMinutes ?? activeTask?.targetMinutes ?? 5) * 60_000;
  const gaugePercent = targetMs ? Math.round((elapsed / targetMs) * 100) : 0;
  const resumeTask = data.tasks
    .filter((task) => task.status === "in_progress" && task.id !== activeTask?.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
  const nextTasks = data.tasks
    .filter((task) => task.status !== "completed" && task.id !== activeTask?.id && task.id !== resumeTask?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .slice(0, 3);
  const stats = buildStats(data.sessions, now);
  const weekly = buildWeek(data.sessions, now);
  const projectSummary = activeProject && activeProject.id !== INBOX_PROJECT_ID
    ? activeProject
    : data.projects.find((project) => project.status === "active" && project.id !== INBOX_PROJECT_ID) ?? null;
  const skillSummary = buildSkills(data, store.trackedMsByTask).slice(0, 3);

  return (
    <section className="dashboard-grid page-enter">
      <article className={`card current-task-card ${activeTask ? "" : "empty-current"}`}>
        {activeTask && activeSession ? (
          <>
            <div className="eyebrow">ПОТОЧНА ЗАДАЧА · {activeProject?.title.toUpperCase() ?? "БЕЗ ПРОЄКТУ"}</div>
            <div className="current-task-content">
              <div className="current-copy">
                <h1>{activeTask.title}</h1>
                <p className="muted-on-dark">Ціль {activeSession.targetMinutes} хв · {activeProject?.skill ?? "Інше"}</p>
                <div className="timer">{formatTimer(elapsed)}</div>
                <div className="stage-label">{focusStage(elapsed)}{elapsed > targetMs ? ` · +${formatTimer(elapsed - targetMs)} після цілі` : ""}</div>
              </div>
              <div className="gauge" style={{ background: `conic-gradient(var(--accent) 0deg ${Math.min(360, gaugePercent * 3.6)}deg, #44473e ${Math.min(360, gaugePercent * 3.6)}deg 360deg)` }} aria-label={`${gaugePercent} відсотків цілі`}>
                <div className="gauge-inner"><strong>{gaugePercent}%</strong><span>від цілі</span></div>
              </div>
            </div>
            <div className="stage-track"><span/><span/><span/><span/></div>
            <div className="stage-scale"><span>0</span><span>5 хв</span><span>15 хв</span><span>30 хв</span><span>+</span></div>
            <div className="task-actions">
              <button className="action secondary" onClick={store.stopActive}><Pause size={17}/> Зупинити</button>
              <button className="action primary" onClick={() => store.completeTask(activeTask.id)}><Check size={17}/> Завершити</button>
              <button className="action icon" aria-label="Видалити задачу" onClick={() => confirmDeleteTask(activeTask, store, requestConfirmation)}><Trash2 size={17}/></button>
            </div>
          </>
        ) : (
          <EmptyCurrent data={data} startTask={store.startTask} openModal={openModal} />
        )}
      </article>

      <article className="card resume-card">
        <div className="card-heading"><span>{activeTask ? "ЗАРАЗ" : "ПРОДОВЖИТИ"}</span><span className="status-pill">{activeTask ? "У фокусі" : resumeTask ? "В процесі" : "Вільно"}</span></div>
        {(activeTask ?? resumeTask) ? (() => {
          const task = activeTask ?? resumeTask!;
          const project = projectOf(task, data.projects);
          const tracked = store.trackedMsByTask.get(task.id) ?? 0;
          return <>
            <h2>{task.title}</h2>
            <p className="subtle">{project?.title ?? "Без проєкту"} · {project?.skill ?? "Інше"}</p>
            <div className="metric-large">{formatDuration(tracked)}</div>
            <p className="subtle">Усього часу в задачі</p>
            {activeTask
              ? <button className="wide-secondary" onClick={store.stopActive}>Зупинити поточну сесію</button>
              : <button className="wide-primary" onClick={() => store.startTask(task.id)}>Продовжити {task.targetMinutes} хв <CirclePlay size={16}/></button>}
          </>;
        })() : (
          <div className="small-empty"><Clock3 size={28}/><strong>Немає незавершених задач</strong><span>Додай наступний маленький крок — проєкт необов’язковий.</span><button onClick={() => openModal({ kind: "task" })}><Plus size={15}/> Додати задачу</button></div>
        )}
      </article>

      <article className="card next-card">
        <div className="card-heading"><span>НАСТУПНІ ЗАДАЧІ</span><span className="count-pill">{nextTasks.length}</span></div>
        {nextTasks.length ? <div className="task-list">
          {nextTasks.map((task) => {
            const project = projectOf(task, data.projects);
            return <button className="task-row" key={task.id} onClick={() => store.startTask(task.id)}>
              <span className="task-dot"/><span className="task-copy"><strong>{task.title}</strong><small>{project?.title} · {task.targetMinutes} хв</small></span><CirclePlay size={18}/>
            </button>;
          })}
        </div> : <div className="list-empty"><span>Черга порожня — це теж хороший стан.</span><button onClick={() => openModal({ kind: "task" })}><Plus size={15}/> Додати задачу</button></div>}
        <button className="text-button" onClick={() => setView("projects")}>Переглянути всі задачі <ChevronRight size={15}/></button>
      </article>

      <section className="stats-row">
        {stats.map((stat) => <StatCard key={stat.label} {...stat}/>) }
      </section>

      <article className="card analytics-card">
        <div className="card-heading"><span>ФОКУС ЗА ТИЖДЕНЬ</span><span className="count-pill">{formatDuration(weekly.reduce((sum, day) => sum + day.value, 0), true)}</span></div>
        <WeekBars days={weekly}/>
      </article>

      <article className="card project-card">
        <div className="card-heading"><span>ПРОГРЕС ПРОЄКТУ</span>{projectSummary && <span>{projectProgress(projectSummary.id, data.tasks)}%</span>}</div>
        {projectSummary ? <ProjectSummary project={projectSummary} data={data} trackedMsByTask={store.trackedMsByTask}/> : <div className="panel-empty"><FolderPlus size={30}/><strong>Створи перший проєкт</strong><button onClick={() => openModal({ kind: "project" })}>Створити</button></div>}
      </article>

      <article className="card skills-card">
        <div className="card-heading"><span>НАВИЧКИ ТА ПРАКТИКА</span><span>{skillSummary.length} активні</span></div>
        {skillSummary.length ? skillSummary.map((skill) => <SkillRow key={skill.name} skill={skill}/>) : <div className="panel-empty"><Trophy size={30}/><strong>Статистика з’явиться після першої сесії</strong></div>}
      </article>
    </section>
  );
}

function EmptyCurrent({ data, startTask, openModal }: { data: Store["data"]; startTask: Store["startTask"]; openModal: (modal: ModalState) => void }) {
  const candidate = data.tasks.find((task) => task.status !== "completed");
  return <div className="empty-current-content">
    <div className="eyebrow">ПОТОЧНА ЗАДАЧА</div>
    <div className="empty-current-icon"><CirclePlay size={32}/></div>
    <h1>{candidate ? "Готовий до наступного фокусу?" : "Почни з маленького кроку"}</h1>
    <p>{candidate ? `Наступна задача: ${candidate.title}` : "Додай першу коротку задачу. Проєкт можна вибрати зараз або створити пізніше."}</p>
    {candidate
      ? <button className="hero-start" onClick={() => startTask(candidate.id)}>Почати {candidate.targetMinutes} хв <CirclePlay size={17}/></button>
      : <div className="empty-current-actions"><button className="hero-start" onClick={() => openModal({ kind: "task" })}><Plus size={17}/> Додати задачу</button><button className="hero-secondary" onClick={() => openModal({ kind: "project" })}><FolderPlus size={17}/> Створити проєкт</button></div>}
  </div>;
}

function ProjectsPage({ store, openModal, requestConfirmation }: { store: Store; openModal: (modal: ModalState) => void; requestConfirmation: RequestConfirmation }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(store.data.projects[0]?.id ?? null);
  const selected = store.data.projects.find((project) => project.id === selectedProjectId) ?? store.data.projects[0] ?? null;
  const tasks = selected ? store.data.tasks.filter((task) => task.projectId === selected.id) : [];

  useEffect(() => {
    if (store.data.projects[0] && !store.data.projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(store.data.projects[0].id);
    }
    if (!store.data.projects.length && selectedProjectId) setSelectedProjectId(null);
  }, [selectedProjectId, store.data.projects]);

  return <section className="page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">РОБОЧИЙ ПРОСТІР</span><h1>Проєкти та задачі</h1><p>Один зрозумілий список замість хаосу.</p></div><button className="page-primary" onClick={() => openModal({ kind: "project" })}><FolderPlus size={17}/> Новий проєкт</button></div>
    {!store.data.projects.length ? <EmptyWorkspace onCreate={() => openModal({ kind: "project" })}/> : <div className="projects-layout">
      <aside className="card project-sidebar">
        <div className="card-heading"><span>ПРОЄКТИ</span><span className="count-pill">{store.data.projects.length}</span></div>
        <div className="project-nav-list">{store.data.projects.map((project) => {
          const projectTasks = store.data.tasks.filter((task) => task.projectId === project.id);
          return <button key={project.id} className={`project-nav-row ${selected?.id === project.id ? "active" : ""}`} onClick={() => setSelectedProjectId(project.id)}>
            <span className="project-avatar">{project.title.slice(0, 1).toUpperCase()}</span><span><strong>{project.title}</strong><small>{projectTasks.filter((task) => task.status !== "completed").length} активних · {project.skill}</small></span><ChevronRight size={16}/>
          </button>;
        })}</div>
      </aside>
      {selected && <section className="card project-detail">
        <div className="project-detail-head"><div><span className="skill-badge">{selected.id === INBOX_PROJECT_ID ? "Системний список" : selected.skill}</span><h2>{selected.title}</h2><p>{selected.description || "Без опису — можна додати пізніше."}</p></div>{selected.id !== INBOX_PROJECT_ID && <div className="inline-actions"><button title="Редагувати" aria-label="Редагувати проєкт" onClick={() => openModal({ kind: "project", project: selected })}><Edit3 size={17}/></button><button title="Видалити" aria-label="Видалити проєкт" onClick={() => confirmDeleteProject(selected, store, requestConfirmation)}><Trash2 size={17}/></button></div>}</div>
        <div className="project-kpis"><div><span>Прогрес</span><strong>{projectProgress(selected.id, store.data.tasks)}%</strong></div><div><span>Час</span><strong>{formatDuration(projectTime(selected.id, store.data.tasks, store.trackedMsByTask))}</strong></div><div><span>Виконано</span><strong>{tasks.filter((task) => task.status === "completed").length}/{tasks.length}</strong></div></div>
        <div className="section-heading"><div><strong>Задачі</strong><span>{tasks.length}</span></div><button onClick={() => openModal({ kind: "task", projectId: selected.id })}><Plus size={16}/> Додати задачу</button></div>
        {tasks.length ? <div className="full-task-list">{tasks.sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || a.sortOrder - b.sortOrder).map((task) => {
          const tracked = store.trackedMsByTask.get(task.id) ?? 0;
          const isActive = store.activeTask?.id === task.id;
          return <div className={`full-task-row ${task.status === "completed" ? "completed" : ""}`} key={task.id}>
            <button className={`status-check ${task.status === "completed" ? "checked" : ""}`} onClick={() => task.status === "completed" ? store.reopenTask(task.id) : store.completeTask(task.id)} aria-label={task.status === "completed" ? "Повернути задачу" : "Завершити задачу"}>{task.status === "completed" && <Check size={14}/>}</button>
            <div className="full-task-copy"><strong>{task.title}</strong><span>{task.targetMinutes} хв ціль · {formatDuration(tracked)} загалом</span></div>
            {isActive && <span className="live-pill">● {formatTimer(sessionDuration(store.activeSession!, store.now))}</span>}
            <div className="row-actions">
              {task.status !== "completed" && <button title={isActive ? "Зупинити" : "Почати"} onClick={() => isActive ? store.stopActive() : store.startTask(task.id)}>{isActive ? <Pause size={17}/> : <CirclePlay size={17}/>}</button>}
              <button title="Редагувати" onClick={() => openModal({ kind: "task", task })}><Edit3 size={16}/></button>
              <button title="Видалити" aria-label={`Видалити задачу ${task.title}`} onClick={() => confirmDeleteTask(task, store, requestConfirmation)}><Trash2 size={16}/></button>
            </div>
          </div>;
        })}</div> : <div className="task-empty"><Clock3 size={28}/><strong>У проєкті ще немає задач</strong><button onClick={() => openModal({ kind: "task", projectId: selected.id })}>Додати першу</button></div>}
      </section>}
    </div>}
  </section>;
}

function AnalyticsPage({ store }: { store: Store }) {
  const stats = buildStats(store.data.sessions, store.now);
  const weekly = buildWeek(store.data.sessions, store.now);
  const heatmap = buildHeatmap(store.data.sessions, store.now);
  const sessions = [...store.data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8);
  return <section className="page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">БЕЗ ОЦІНЮВАННЯ</span><h1>Аналітика фокусу</h1><p>Лише фактичний час і м’які тенденції.</p></div></div>
    <section className="stats-row analytics-stats">{stats.map((stat) => <StatCard key={stat.label} {...stat}/>)}</section>
    <div className="analytics-layout">
      <article className="card analytics-card analytics-large"><div className="card-heading"><span>ПОТОЧНИЙ ТИЖДЕНЬ</span><span>{formatDuration(weekly.reduce((sum, day) => sum + day.value, 0))}</span></div><WeekBars days={weekly}/></article>
      <article className="card heatmap-card"><div className="card-heading"><span>АКТИВНІСТЬ · 12 ТИЖНІВ</span><span>{heatmap.filter((day) => day.value > 0).length} активних днів</span></div><div className="heatmap" aria-label="Карта активності за 12 тижнів">{heatmap.map((day) => <span role="img" key={day.date} title={`${day.date}: ${formatDuration(day.value)}`} aria-label={`${day.date}: ${formatDuration(day.value)}`} data-level={day.level}/>)}</div><div className="heatmap-legend" aria-label="Інтенсивність активності"><span>0 хв</span><i data-level="0" aria-hidden="true"/><i data-level="1" aria-hidden="true"/><i data-level="2" aria-hidden="true"/><i data-level="3" aria-hidden="true"/><i data-level="4" aria-hidden="true"/><span>більше часу</span></div><p className="chart-help">Кожна клітинка — один день. Наведи курсор, щоб побачити точний час.</p></article>
      <article className="card history-card"><div className="card-heading"><span>ОСТАННІ СЕСІЇ</span><span>{store.data.sessions.length}</span></div>{sessions.length ? <div className="history-list">{sessions.map((session) => {
        const task = store.data.tasks.find((item) => item.id === session.taskId);
        const project = projectOf(task, store.data.projects);
        return <div key={session.id}><span className="history-icon"><Clock3 size={15}/></span><span><strong>{task?.title ?? "Видалена задача"}</strong><small>{project?.title ?? "Без проєкту"} · {new Date(session.startedAt).toLocaleDateString("uk-UA")}</small></span><b>{formatDuration(sessionDuration(session, store.now))}</b></div>;
      })}</div> : <div className="panel-empty"><BarChart3 size={30}/><strong>Завершені сесії з’являться тут</strong></div>}</article>
    </div>
  </section>;
}

function SkillsPage({ store }: { store: Store }) {
  const skills = buildSkills(store.data, store.trackedMsByTask);
  return <section className="page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">НАКОПИЧЕНА ПРАКТИКА</span><h1>Навички</h1><p>Рівні показують лише вкладений час, а не оцінюють професіоналізм.</p></div></div>
    {skills.length ? <div className="skills-grid">{skills.map((skill) => {
      const exp = experienceForHours(skill.hours);
      return <article className="card skill-card" key={skill.name}><div className="skill-card-top"><span className="skill-monogram">{skill.name.slice(0, 2).toUpperCase()}</span><span className="level-pill">Рівень {exp.level}</span></div><h2>{skill.name}</h2><p>{exp.name}</p><strong className="skill-hours">{formatDuration(skill.ms)}</strong><div className="skill-progress"><span style={{ width: `${exp.progress}%` }}/></div><small>{exp.level < 15 ? `До наступного рівня: ${Math.max(0, Math.ceil(exp.nextHours - skill.hours))} год` : "Найвищий рівень практики"}</small></article>;
    })}</div> : <EmptyWorkspace icon="skills" onCreate={() => undefined}/>}
  </section>;
}

function SettingsPage({ store, requestConfirmation }: { store: Store; requestConfirmation: RequestConfirmation }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [customPreset, setCustomPreset] = useState(25);
  const [section, setSection] = useState<"appearance" | "ai" | "data">("appearance");
  const [backupError, setBackupError] = useState<string | null>(null);
  const settings = store.data.settings;
  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(store.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `e-task-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const addPreset = () => {
    const value = Math.min(240, Math.max(1, Math.round(customPreset)));
    store.updateSettings({ focusPresets: [...new Set([...settings.focusPresets, value])].sort((a, b) => a - b) });
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      setBackupError(null);
      requestConfirmation({
        title: "Імпортувати резервну копію?",
        message: "Поточні проєкти, задачі, сесії та налаштування буде замінено даними з вибраного файла.",
        confirmLabel: "Імпортувати",
        onConfirm: () => store.importBackup(value),
      });
    }
    catch (error) { setBackupError(error instanceof Error ? error.message : String(error)); }
    if (fileInput.current) fileInput.current.value = "";
  };
  return <section className="page settings-page page-enter">
    <div className="page-title"><div><span className="eyebrow-dark">ПЕРСОНАЛІЗАЦІЯ</span><h1>Налаштування</h1><p>Вигляд, короткі цілі та локальні дані.</p></div></div>
    <nav className="settings-tabs" aria-label="Розділи налаштувань">
      {([["appearance", "Інтерфейс"], ["ai", "AI-помічник"], ["data", "Дані та оновлення"]] as const).map(([key, label]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)} aria-current={section === key ? "page" : undefined}>{label}</button>)}
    </nav>
    <div className="settings-grid" key={section}>
      {section === "appearance" && <>
        <SettingsCard title="Тема" description="Системна тема автоматично повторює Windows."><Segmented value={settings.theme} options={[["system","Системна"],["light","Світла"],["dark","Темна"]]} onChange={(value) => store.updateSettings({ theme: value as AppSettings["theme"] })}/></SettingsCard>
        <SettingsCard title="Акцент" description="Колір використовується лише для ключових дій."><div className="accent-picker">{(["lime","yellow","blue","violet"] as const).map((accent) => <button key={accent} className={settings.accent === accent ? "selected" : ""} data-accent-value={accent} onClick={() => store.updateSettings({ accent })} aria-label={`Акцент ${accent}`}/>)}</div></SettingsCard>
        <SettingsCard title="Вигляд панелі" description="Компактний режим зменшує відступи та висоту карток."><Segmented value={String(settings.compact)} options={[["false","Звичайний"],["true","Компактний"]]} onChange={(value) => store.updateSettings({ compact: value === "true" })}/></SettingsCard>
        <SettingsCard title="Звук цілі" description="Короткий сигнал не зупиняє таймер."><label className="switch-row"><span>{settings.soundEnabled ? "Увімкнено" : "Вимкнено"}</span><input type="checkbox" checked={settings.soundEnabled} onChange={(event) => store.updateSettings({ soundEnabled: event.target.checked })}/><i/></label></SettingsCard>
        <SettingsCard className="settings-wide" title="Швидкі цілі" description="Ціль — це орієнтир, таймер продовжить рахувати далі."><div className="preset-editor"><div>{settings.focusPresets.map((preset) => <span key={preset}>{preset} хв<button aria-label={`Видалити ${preset} хв`} onClick={() => settings.focusPresets.length > 1 && store.updateSettings({ focusPresets: settings.focusPresets.filter((item) => item !== preset) })}><X size={13}/></button></span>)}</div><label><input aria-label="Нова швидка ціль у хвилинах" type="number" min="1" max="240" value={customPreset} onChange={(event) => setCustomPreset(Number(event.target.value))}/><button onClick={addPreset}><Plus size={15}/> Додати</button></label></div></SettingsCard>
      </>}
      {section === "ai" && <AiSettings settings={settings} updateSettings={store.updateSettings} requestConfirmation={requestConfirmation}/>}
      {section === "data" && <>
        <SettingsCard className="settings-wide settings-update-card" title="Версія та оновлення" description="E-task перевіряє підписані оновлення через GitHub і встановлює їх без ручного завантаження."><UpdateControl/></SettingsCard>
        <SettingsCard className="settings-wide" title="Резервна копія" description="Дані зберігаються локально. Експорт корисно робити після важливих змін."><div className="backup-actions"><button onClick={exportBackup}><Download size={16}/> Експортувати JSON</button><button onClick={() => fileInput.current?.click()}><Upload size={16}/> Імпортувати</button><input ref={fileInput} type="file" accept="application/json" hidden onChange={(event) => void importFile(event.target.files?.[0])}/></div><div className="data-summary"><span>{store.data.projects.length} проєктів</span><span>{store.data.tasks.length} задач</span><span>{store.data.sessions.length} сесій</span></div>{backupError && <div className="settings-inline-error" role="alert">{backupError}</div>}</SettingsCard>
        <SettingsCard className="settings-wide danger-zone" title="Очистити локальні дані" description="Дія видалить усі проєкти, задачі та статистику на цьому комп’ютері."><button className="danger-button" onClick={() => requestConfirmation({ title: "Очистити всі локальні дані?", message: "Усі проєкти, задачі, фокус-сесії та статистику буде видалено без можливості відновлення.", confirmLabel: "Очистити все", tone: "danger", onConfirm: store.resetAll })}><RotateCcw size={16}/> Очистити все</button></SettingsCard>
      </>}
    </div>
  </section>;
}

function ProjectModal({ project, onClose, onSave }: { project?: Project; onClose: () => void; onSave: (input: Pick<Project, "title" | "description" | "skill">) => void }) {
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [skill, setSkill] = useState(project?.skill ?? "After Effects");
  const submit = (event: FormEvent) => { event.preventDefault(); if (title.trim()) onSave({ title, description, skill }); };
  return <Modal title={project ? "Редагувати проєкт" : "Новий проєкт"} subtitle="Проєкт об’єднує задачі й накопичений час." onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Назва<input autoFocus maxLength={80} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Наприклад, Портфоліо" required/></label><label>Опис<textarea rows={3} maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Необов’язковий короткий контекст"/></label><label>Основна навичка<input list="skills" value={skill} onChange={(event) => setSkill(event.target.value)} required/><datalist id="skills">{skillSuggestions.map((item) => <option value={item} key={item}/>)}</datalist></label><div className="modal-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">{project ? "Зберегти" : "Створити проєкт"}</button></div></form></Modal>;
}

function TaskModal({ task, initialProjectId, projects, presets, onClose, onSave }: { task?: Task; initialProjectId?: string; projects: Project[]; presets: number[]; onClose: () => void; onSave: (input: Pick<Task, "title" | "projectId" | "targetMinutes">, start: boolean) => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [projectId, setProjectId] = useState(task?.projectId === INBOX_PROJECT_ID ? "" : task?.projectId ?? initialProjectId ?? "");
  const [targetMinutes, setTargetMinutes] = useState(task?.targetMinutes ?? presets[0] ?? 5);
  const [start, setStart] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); if (title.trim()) onSave({ title, projectId, targetMinutes: Math.max(1, targetMinutes) }, start); };
  return <Modal title={task ? "Редагувати задачу" : "Нова задача"} subtitle="Сформулюй один конкретний наступний крок." onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Назва<input autoFocus maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Що саме потрібно зробити?" required/></label><label>Проєкт <small>необов’язково</small><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">Без проєкту</option>{projects.filter((project) => project.id !== INBOX_PROJECT_ID).map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label><fieldset><legend>Ціль фокусу</legend><div className="target-options">{presets.map((preset) => <button type="button" className={targetMinutes === preset ? "selected" : ""} onClick={() => setTargetMinutes(preset)} key={preset}>{preset} хв</button>)}<label><input type="number" min="1" max="240" value={targetMinutes} onChange={(event) => setTargetMinutes(Number(event.target.value))}/><span>хв</span></label></div></fieldset>{!task && <label className="check-row"><input type="checkbox" checked={start} onChange={(event) => setStart(event.target.checked)}/><span>Одразу почати фокус</span></label>}<div className="modal-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">{task ? "Зберегти" : start ? "Створити й почати" : "Додати задачу"}</button></div></form></Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => { const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose(); window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={onClose} aria-label="Закрити"><X size={19}/></button><div className="modal-heading"><span className="modal-icon"><Plus size={20}/></span><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div></div>{children}</section></div>;
}

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return <article className="card stat-card"><span className="eyebrow-dark">{label}</span><strong>{value}</strong><small className={delta.startsWith("−") ? "negative" : ""}>{delta || "Немає попереднього періоду"}</small></article>;
}

function WeekBars({ days }: { days: { label: string; value: number }[] }) {
  const max = Math.max(...days.map((day) => day.value), 1);
  return <div className="bars" aria-label="Час фокусу за тиждень">{days.map((day) => <div className="bar-col" key={day.label}><strong className="bar-value">{formatDuration(day.value, true)}</strong><div className="bar-track" title={`${day.label}: ${formatDuration(day.value)}`} aria-label={`${day.label}: ${formatDuration(day.value)}`}><div className="bar-fill" style={{ height: `${Math.max(day.value ? 8 : 0, (day.value / max) * 100)}%` }}/></div><small>{day.label}</small></div>)}</div>;
}

function ProjectSummary({ project, data, trackedMsByTask }: { project: Project; data: Store["data"]; trackedMsByTask: Map<string, number> }) {
  const tasks = data.tasks.filter((task) => task.projectId === project.id);
  const progress = projectProgress(project.id, data.tasks);
  return <><h3>{project.title}</h3><div className="progress"><span style={{ width: `${progress}%` }}/></div><div className="project-meta"><span>{tasks.filter((task) => task.status === "completed").length} / {tasks.length} задач</span><span>{formatDuration(projectTime(project.id, data.tasks, trackedMsByTask))}</span></div><div className="mini-tasks">{tasks.slice(0, 3).map((task) => <span className={task.status === "in_progress" ? "current" : ""} key={task.id}>{task.status === "completed" ? <Check size={14}/> : <Clock3 size={14}/>} {task.title}</span>)}</div></>;
}

function SkillRow({ skill }: { skill: ReturnType<typeof buildSkills>[number] }) {
  const exp = experienceForHours(skill.hours);
  return <div className="skill-row"><div><strong>{skill.name}</strong><small>{formatDuration(skill.ms)} · рівень {exp.level}</small></div><div className="skill-progress"><span style={{ width: `${exp.progress}%` }}/></div></div>;
}

function SettingsCard({ title, description, className = "", children }: { title: string; description: string; className?: string; children: React.ReactNode }) {
  return <article className={`card settings-card ${className}`}><div><h2>{title}</h2><p>{description}</p></div><div>{children}</div></article>;
}

function Segmented({ value, options, onChange }: { value: string; options: string[][]; onChange: (value: string) => void }) {
  return <div className="segmented">{options.map(([key, label]) => <button className={value === key ? "active" : ""} onClick={() => onChange(key)} key={key}>{label}</button>)}</div>;
}

function EmptyWorkspace({ onCreate, icon }: { onCreate: () => void; icon?: "skills" }) {
  return <article className="card workspace-empty">{icon === "skills" ? <Trophy size={38}/> : <FolderPlus size={38}/>}<h2>{icon === "skills" ? "Навички ще не мають часу" : "Почни з першого проєкту"}</h2><p>{icon === "skills" ? "Додай проєкт із навичкою та запусти задачу — статистика з’явиться автоматично." : "Створи простір для задач, які стосуються однієї роботи або напряму."}</p>{icon !== "skills" && <button className="page-primary" onClick={onCreate}><Plus size={16}/> Створити проєкт</button>}</article>;
}

function confirmDeleteTask(task: Task, store: Store, requestConfirmation: RequestConfirmation) {
  const tracked = store.trackedMsByTask.get(task.id) ?? 0;
  requestConfirmation({
    title: "Видалити задачу?",
    message: `«${task.title}» і ${formatDuration(tracked)} пов’язаної статистики буде видалено без можливості відновлення.`,
    confirmLabel: "Видалити задачу",
    tone: "danger",
    onConfirm: () => store.deleteTask(task.id),
  });
}

function confirmDeleteProject(project: Project, store: Store, requestConfirmation: RequestConfirmation) {
  const tasks = store.data.tasks.filter((task) => task.projectId === project.id);
  requestConfirmation({
    title: "Видалити проєкт?",
    message: `«${project.title}», ${tasks.length} задач і вся пов’язана статистика буде видалена без можливості відновлення.`,
    confirmLabel: "Видалити проєкт",
    tone: "danger",
    onConfirm: () => store.deleteProject(project.id),
  });
}

function projectProgress(projectId: string, tasks: Task[]) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  return projectTasks.length ? Math.round((projectTasks.filter((task) => task.status === "completed").length / projectTasks.length) * 100) : 0;
}

function projectTime(projectId: string, tasks: Task[], trackedMsByTask: Map<string, number>) {
  return tasks.reduce((sum, task) => task.projectId === projectId ? sum + (trackedMsByTask.get(task.id) ?? 0) : sum, 0);
}

function buildStats(sessions: Store["data"]["sessions"], now: number) {
  const date = new Date(now);
  const day = startOfDay(date);
  const week = startOfWeek(date);
  const month = startOfMonth(date);
  const year = startOfYear(date);
  const starts = [day, week, month, year, 0];
  const ends = [addCalendarDays(day, 1), addCalendarDays(week, 7), new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime(), new Date(date.getFullYear() + 1, 0, 1).getTime(), now + 1];
  const previousStarts = [addCalendarDays(day, -1), addCalendarDays(week, -7), new Date(date.getFullYear(), date.getMonth() - 1, 1).getTime(), new Date(date.getFullYear() - 1, 0, 1).getTime()];
  const labels = ["СЬОГОДНІ", "ЦЬОГО ТИЖНЯ", "ЦЬОГО МІСЯЦЯ", "ЦЬОГО РОКУ", "ЗА ВЕСЬ ЧАС"];
  return labels.map((label, index) => {
    const current = totalInside(sessions, starts[index], ends[index], now);
    if (index === 4) return { label, value: formatDuration(current, true), delta: "" };
    const previous = totalInside(sessions, previousStarts[index], starts[index], now);
    const percent = previous ? Math.round(((current - previous) / previous) * 100) : 0;
    return { label, value: formatDuration(current, true), delta: previous ? `${percent >= 0 ? "+" : "−"}${Math.abs(percent)}% до попереднього` : "Перший період" };
  });
}

function buildWeek(sessions: Store["data"]["sessions"], now: number) {
  const week = startOfWeek(new Date(now));
  return dayLabels.map((label, index) => ({ label, value: totalInside(sessions, addCalendarDays(week, index), addCalendarDays(week, index + 1), now) }));
}

function buildHeatmap(sessions: Store["data"]["sessions"], now: number) {
  const today = startOfDay(new Date(now));
  const first = addCalendarDays(today, -83);
  const values = Array.from({ length: 84 }, (_, index) => {
    const start = addCalendarDays(first, index);
    return { date: new Date(start).toLocaleDateString("uk-UA"), value: totalInside(sessions, start, addCalendarDays(start, 1), now), level: 0 };
  });
  const max = Math.max(...values.map((day) => day.value), 1);
  return values.map((day) => ({ ...day, level: day.value ? Math.max(1, Math.ceil((day.value / max) * 4)) : 0 }));
}

function buildSkills(data: Store["data"], trackedMsByTask: Map<string, number>) {
  const totals = new Map<string, number>();
  const projectsById = new Map(data.projects.map((project) => [project.id, project]));
  for (const task of data.tasks) {
    const project = projectsById.get(task.projectId);
    if (!project || project.id === INBOX_PROJECT_ID) continue;
    totals.set(project.skill, (totals.get(project.skill) ?? 0) + (trackedMsByTask.get(task.id) ?? 0));
  }
  return [...totals.entries()].map(([name, ms]) => ({ name, ms, hours: ms / 3_600_000 })).sort((a, b) => b.ms - a.ms);
}

export default App;
