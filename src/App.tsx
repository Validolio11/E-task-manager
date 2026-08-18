import {
  BarChart3,
  BriefcaseBusiness,
  Check,
  CirclePlay,
  Clock3,
  Home,
  Pause,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
} from "lucide-react";
import { UpdateControl } from "./features/updater/UpdateControl";

const navItems = [
  { label: "Home", icon: Home, active: true },
  { label: "Projects", icon: BriefcaseBusiness },
  { label: "Analytics", icon: BarChart3 },
  { label: "Skills", icon: Trophy },
  { label: "Settings", icon: Settings },
];

const nextTasks = [
  { title: "Find background music", project: "Portfolio", target: "5 min" },
  { title: "Scene 04 animation", project: "Portfolio", target: "10 min" },
  { title: "Render preview", project: "Portfolio", target: "5 min" },
];

const stats = [
  ["Today", "2h 34m", "+12%"],
  ["This week", "18h 42m", "+8%"],
  ["This month", "78h 16m", "+15%"],
  ["This year", "642h 22m", "+18%"],
  ["All time", "1,248h 37m", ""],
];

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/app-icon.svg" alt="" />
          <div>
            <strong>E-task</strong>
            <span>Focus. Time. Progress.</span>
          </div>
        </div>

        <nav className="nav-pill" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon, active }) => (
            <button className={`nav-item ${active ? "active" : ""}`} key={label} title={label}>
              <Icon size={19} strokeWidth={2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <UpdateControl />
          <button className="quick-add"><Sparkles size={17} /> Quick add</button>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="card current-task-card">
          <div className="eyebrow">CURRENT TASK · PORTFOLIO</div>
          <div className="current-task-content">
            <div>
              <h1>Animate pricing cards</h1>
              <p className="muted-on-dark">Target 5:00 · After Effects</p>
              <div className="timer">08:42</div>
              <div className="stage-label">FLOW · +03:42 after target</div>
            </div>

            <div className="gauge" aria-label="176 percent of target">
              <div className="gauge-inner">
                <strong>176%</strong>
                <span>of target</span>
              </div>
            </div>
          </div>

          <div className="stage-track">
            <span className="start" />
            <span className="focus" />
            <span className="flow" />
            <span className="deep" />
          </div>
          <div className="stage-scale"><span>0</span><span>5 min</span><span>15 min</span><span>30 min</span><span>+</span></div>

          <div className="task-actions">
            <button className="action secondary"><Pause size={17} /> Stop</button>
            <button className="action primary"><Check size={17} /> Completed</button>
            <button className="action icon" aria-label="Delete task"><Trash2 size={17} /></button>
          </div>
        </article>

        <article className="card resume-card">
          <div className="card-heading"><span>RESUME</span><span className="status-pill">In Progress</span></div>
          <h2>Animate pricing cards</h2>
          <p className="subtle">Portfolio · After Effects</p>
          <div className="metric-large">37 min</div>
          <p className="subtle">Total time spent</p>
          <button className="wide-primary">Resume 5 min <CirclePlay size={16} /></button>
        </article>

        <article className="card next-card">
          <div className="card-heading"><span>NEXT TASKS</span><span className="count-pill">3</span></div>
          <div className="task-list">
            {nextTasks.map((task) => (
              <button className="task-row" key={task.title}>
                <span className="task-dot" />
                <span className="task-copy">
                  <strong>{task.title}</strong>
                  <small>{task.project} · {task.target}</small>
                </span>
                <CirclePlay size={18} />
              </button>
            ))}
          </div>
          <button className="text-button">View all tasks</button>
        </article>

        <section className="stats-row">
          {stats.map(([label, value, delta]) => (
            <article className="card stat-card" key={label}>
              <span className="eyebrow-dark">{label.toUpperCase()}</span>
              <strong>{value}</strong>
              {delta && <small>{delta} vs previous</small>}
            </article>
          ))}
        </section>

        <article className="card analytics-card">
          <div className="card-heading"><span>WEEKLY FOCUS</span><span className="count-pill">18h 42m</span></div>
          <div className="bars" aria-label="Weekly focus hours">
            {[42, 66, 52, 75, 84, 58, 46].map((height, index) => (
              <div className="bar-col" key={index}>
                <div className="bar-track"><div className="bar-fill" style={{ height: `${height}%` }} /></div>
                <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="card project-card">
          <div className="card-heading"><span>PROJECT PROGRESS</span><span>68%</span></div>
          <h3>Portfolio</h3>
          <div className="progress"><span style={{ width: "68%" }} /></div>
          <div className="project-meta"><span>23 / 34 tasks</span><span>16h 42m</span></div>
          <div className="mini-tasks">
            <span><Check size={14} /> Collect references</span>
            <span><Check size={14} /> Import to After Effects</span>
            <span className="current"><Clock3 size={14} /> Animate pricing cards</span>
          </div>
        </article>

        <article className="card skills-card">
          <div className="card-heading"><span>SKILLS & EXPERIENCE</span><span>Level 8</span></div>
          {[
            ["After Effects", "482h", 78],
            ["Figma", "116h", 52],
            ["Blender", "38h", 29],
          ].map(([name, hours, percent]) => (
            <div className="skill-row" key={name as string}>
              <div><strong>{name}</strong><small>{hours}</small></div>
              <div className="skill-progress"><span style={{ width: `${percent}%` }} /></div>
            </div>
          ))}
        </article>
      </section>
    </main>
  );
}

export default App;
