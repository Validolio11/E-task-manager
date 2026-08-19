import { AlertTriangle, Check, X } from "lucide-react";
import { useEffect, useRef } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
}

export type RequestConfirmation = (options: ConfirmOptions) => void;

export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButton.current?.focus();
    const listener = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  const confirm = async () => {
    await options.onConfirm();
    onClose();
  };

  return <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <button className="modal-close" onClick={onClose} aria-label="Закрити"><X size={19}/></button>
      <span className={`confirm-icon ${options.tone === "danger" ? "danger" : ""}`}>
        {options.tone === "danger" ? <AlertTriangle size={23}/> : <Check size={23}/>}
      </span>
      <h2 id="confirm-title">{options.title}</h2>
      <p id="confirm-description">{options.message}</p>
      <div className="confirm-actions">
        <button onClick={onClose}>Скасувати</button>
        <button ref={confirmButton} className={options.tone === "danger" ? "danger" : "primary"} onClick={() => void confirm()}>{options.confirmLabel ?? "Підтвердити"}</button>
      </div>
    </section>
  </div>;
}
