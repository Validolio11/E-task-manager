import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, RefreshCw, RotateCcw, X } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "downloading"; update: Update; progress: number; downloaded: number; total: number }
  | { kind: "installing"; update: Update }
  | { kind: "restarting"; update: Update }
  | { kind: "error"; message: string };

const isDesktop = () => "__TAURI_INTERNALS__" in window;

function formatBytes(value: number) {
  if (!value) return "";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

export function UpdateControl() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [modalOpen, setModalOpen] = useState(false);

  const checkNow = useCallback(async (showResult = true) => {
    if (!isDesktop()) {
      if (showResult) {
        setState({ kind: "error", message: "Перевірка оновлень доступна у Windows-застосунку." });
        setModalOpen(true);
      }
      return;
    }

    setState({ kind: "checking" });
    if (showResult) setModalOpen(true);
    try {
      const update = await check();
      if (update) {
        setState({ kind: "available", update });
        setModalOpen(true);
      } else {
        setState({ kind: "current" });
      }
    } catch (error) {
      if (showResult) {
        setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
        setModalOpen(true);
      } else {
        setState({ kind: "idle" });
      }
    }
  }, []);

  useEffect(() => {
    if (!isDesktop()) return;
    const timer = window.setTimeout(() => void checkNow(false), 1800);
    return () => window.clearTimeout(timer);
  }, [checkNow]);

  async function install() {
    if (state.kind !== "available") return;
    const update = state.update;
    let downloaded = 0;
    let total = 0;
    setState({ kind: "downloading", update, progress: 0, downloaded, total });

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setState({ kind: "downloading", update, progress: 0, downloaded, total });
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress = total ? Math.min(99, Math.round((downloaded / total) * 100)) : 0;
          setState({ kind: "downloading", update, progress, downloaded, total });
        }
        if (event.event === "Finished") setState({ kind: "installing", update });
      });
      setState({ kind: "restarting", update });
      await relaunch();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const busy = state.kind === "checking" || state.kind === "downloading" || state.kind === "installing" || state.kind === "restarting";
  const label = state.kind === "idle" ? "Перевірити оновлення"
    : state.kind === "checking" ? "Перевіряємо…"
    : state.kind === "current" ? "Версія актуальна"
    : state.kind === "available" ? `Доступна ${state.update.version}`
    : state.kind === "downloading" ? `Оновлення ${state.progress}%`
    : state.kind === "installing" ? "Встановлення…"
    : state.kind === "restarting" ? "Перезапуск…"
    : "Перевірити ще раз";

  const Icon = state.kind === "available" || state.kind === "downloading" ? Download
    : state.kind === "current" ? CheckCircle2
    : state.kind === "error" ? AlertCircle
    : RefreshCw;

  function handleButtonClick() {
    if (state.kind === "available" || busy) setModalOpen(true);
    else void checkNow(true);
  }

  return <>
    <div className="update-control">
      <button
        className={`update-button ${state.kind}`}
        onClick={handleButtonClick}
        title="Оновлення надходять автоматично через GitHub Releases"
      >
        <Icon className={state.kind === "checking" ? "spin" : ""} size={16}/><span>{label}</span>
      </button>
      {state.kind === "downloading" && <span className="update-progress" style={{ width: `${state.progress}%` }}/>}
    </div>

    {modalOpen && <UpdateModal
      state={state}
      busy={busy}
      onClose={() => !busy && setModalOpen(false)}
      onInstall={() => void install()}
      onRetry={() => void checkNow(true)}
    />}
  </>;
}

function UpdateModal({ state, busy, onClose, onInstall, onRetry }: {
  state: State;
  busy: boolean;
  onClose: () => void;
  onInstall: () => void;
  onRetry: () => void;
}) {
  const update = "update" in state ? state.update : null;
  const progress = state.kind === "downloading" ? state.progress : state.kind === "installing" || state.kind === "restarting" ? 100 : 0;
  const title = state.kind === "checking" ? "Шукаємо оновлення"
    : state.kind === "current" ? "Усе актуально"
    : state.kind === "available" ? "Доступне нове оновлення"
    : state.kind === "downloading" ? "Завантажуємо оновлення"
    : state.kind === "installing" ? "Встановлюємо оновлення"
    : state.kind === "restarting" ? "Оновлення готове"
    : state.kind === "error" ? "Не вдалося оновити"
    : "Оновлення E-task";
  const subtitle = state.kind === "checking" ? "Перевіряємо останній реліз E-task на GitHub."
    : state.kind === "current" ? "У тебе вже встановлена найновіша версія E-task."
    : state.kind === "available" ? "E-task завантажить і встановить її автоматично."
    : state.kind === "downloading" ? "Можна залишатися в цьому вікні — ми покажемо весь прогрес."
    : state.kind === "installing" ? "Файли завантажено. Застосунок безпечно готує нову версію."
    : state.kind === "restarting" ? "Зараз E-task перезапуститься вже в новій версії."
    : state.kind === "error" ? "Дані задач не пошкоджено. Перевір інтернет і спробуй ще раз."
    : "";

  return <div className="update-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`update-modal update-${state.kind}`} role="dialog" aria-modal="true" aria-labelledby="update-title">
      {!busy && <button className="update-modal-close" onClick={onClose} aria-label="Закрити"><X size={19}/></button>}

      <div className="update-animation" style={{ "--update-progress": `${progress * 3.6}deg` } as React.CSSProperties}>
        <span className="update-ring"/>
        <span className="update-ring update-ring-secondary"/>
        <span className="update-animation-icon">
          {state.kind === "current" ? <CheckCircle2 size={32}/>
            : state.kind === "error" ? <AlertCircle size={32}/>
            : state.kind === "available" ? <Download size={30}/>
            : state.kind === "restarting" ? <RotateCcw size={30}/>
            : <RefreshCw className="spin" size={30}/>}
        </span>
        <i/><i/><i/>
      </div>

      <div className="update-modal-copy">
        {update && <span className="update-version">E-task {update.version}</span>}
        <h2 id="update-title">{title}</h2>
        <p>{subtitle}</p>
      </div>

      {(state.kind === "downloading" || state.kind === "installing" || state.kind === "restarting") && <div className="update-download-status">
        <div className="update-download-meta">
          <span>{state.kind === "downloading" ? "Завантаження" : state.kind === "installing" ? "Встановлення" : "Перезапуск"}</span>
          <strong>{state.kind === "downloading" ? `${state.progress}%` : "100%"}</strong>
        </div>
        <div className={`update-download-track ${state.kind === "downloading" && !state.total ? "indeterminate" : ""}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }}/>
        </div>
        {state.kind === "downloading" && <small>{state.total ? `${formatBytes(state.downloaded)} із ${formatBytes(state.total)}` : "Отримуємо пакет із GitHub…"}</small>}
      </div>}

      {state.kind === "available" && update?.body && <p className="update-notes">{update.body}</p>}
      {state.kind === "error" && <p className="update-error-detail">{state.message}</p>}

      <div className="update-modal-actions">
        {state.kind === "available" && <><button onClick={onClose}>Пізніше</button><button className="primary" onClick={onInstall}><Download size={17}/> Оновити зараз</button></>}
        {state.kind === "current" && <button className="primary" onClick={onClose}><CheckCircle2 size={17}/> Готово</button>}
        {state.kind === "error" && <><button onClick={onClose}>Закрити</button><button className="primary" onClick={onRetry}><RotateCcw size={17}/> Спробувати ще</button></>}
      </div>

      {(state.kind === "downloading" || state.kind === "installing" || state.kind === "restarting") && <p className="update-safe-note">Не вимикай E-task під час встановлення</p>}
    </section>
  </div>;
}
