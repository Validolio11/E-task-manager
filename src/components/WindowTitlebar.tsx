import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const isDesktop = "__TAURI_INTERNALS__" in window;

export function WindowTitlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    const appWindow = getCurrentWindow();
    const sync = () => void appWindow.isMaximized().then(setMaximized).catch(() => undefined);
    sync();
    const unlisten = appWindow.onResized(sync);
    return () => { void unlisten.then((dispose) => dispose()); };
  }, []);

  const run = (action: "minimize" | "maximize" | "close") => {
    if (!isDesktop) return;
    const appWindow = getCurrentWindow();
    if (action === "minimize") void appWindow.minimize();
    if (action === "maximize") void appWindow.toggleMaximize();
    if (action === "close") void appWindow.close();
  };

  return (
    <header className="window-titlebar" data-tauri-drag-region>
      <div className="window-titlebar-brand" data-tauri-drag-region>
        <img src="/app-icon.svg" alt="" draggable={false} />
        <strong data-tauri-drag-region>E-task</strong>
        <span data-tauri-drag-region>Фокус без зайвого шуму</span>
      </div>
      <div className="window-controls" aria-label="Керування вікном">
        <button onClick={() => run("minimize")} title="Згорнути" aria-label="Згорнути"><Minus size={16}/></button>
        <button onClick={() => run("maximize")} title={maximized ? "Відновити" : "Розгорнути"} aria-label={maximized ? "Відновити" : "Розгорнути"}>
          {maximized ? <Copy size={14}/> : <Square size={14}/>} 
        </button>
        <button className="window-close" onClick={() => run("close")} title="Закрити у трей" aria-label="Закрити у трей"><X size={17}/></button>
      </div>
    </header>
  );
}
