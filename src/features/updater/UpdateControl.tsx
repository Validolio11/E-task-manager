import { useState } from "react";
import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "current" }
  | { kind: "available"; update: Update }
  | { kind: "installing"; update: Update; progress: number }
  | { kind: "error"; message: string };

const isDesktop = () => "__TAURI_INTERNALS__" in window;

export function UpdateControl() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function checkNow() {
    if (!isDesktop()) {
      setState({ kind: "error", message: "Update checks are available in the Windows app." });
      return;
    }

    setState({ kind: "checking" });
    try {
      const update = await check();
      setState(update ? { kind: "available", update } : { kind: "current" });
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function install() {
    if (state.kind !== "available") return;
    const update = state.update;
    let downloaded = 0;
    let total = 0;
    setState({ kind: "installing", update, progress: 0 });

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          const progress = total ? Math.round((downloaded / total) * 100) : 0;
          setState({ kind: "installing", update, progress });
        }
        if (event.event === "Finished") setState({ kind: "installing", update, progress: 100 });
      });
      await relaunch();
    } catch (error) {
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }

  const label = state.kind === "idle" ? "Check updates"
    : state.kind === "checking" ? "Checking…"
    : state.kind === "current" ? "Up to date"
    : state.kind === "available" ? `Update to ${state.update.version}`
    : state.kind === "installing" ? `Installing ${state.progress}%`
    : "Try update again";

  const Icon = state.kind === "available" ? Download : state.kind === "current" ? CheckCircle2 : RefreshCw;
  return <div className="update-control">
    <button
      className={`update-button ${state.kind}`}
      onClick={state.kind === "available" ? install : checkNow}
      disabled={state.kind === "checking" || state.kind === "installing"}
      title={state.kind === "error" ? state.message : "Updates are delivered through GitHub Releases"}
    >
      <Icon size={16}/><span>{label}</span>
    </button>
    {state.kind === "installing" && <span className="update-progress" style={{ width: `${state.progress}%` }}/>} 
  </div>;
}
