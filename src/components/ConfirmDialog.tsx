import { AlertTriangle, Check, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  onConfirm: () => void | Promise<void>;
}

export type RequestConfirmation = (options: ConfirmOptions) => void;

export function ConfirmDialog({ options, onClose, returnFocusRef }: { options: ConfirmOptions; onClose: () => void; returnFocusRef?: React.RefObject<HTMLElement | null> }) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const pendingRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const close = () => { if (!pending) onClose(); };
  useDialogFocus(dialogRef, close, cancelButton, returnFocusRef);

  const confirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await options.onConfirm();
      onClose();
    } catch {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <section ref={dialogRef} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} tabIndex={-1}>
      <button className="modal-close" onClick={close} aria-label="Закрити" disabled={pending}><X size={19}/></button>
      <span className={`confirm-icon ${options.tone === "danger" ? "danger" : ""}`} aria-hidden="true">
        {options.tone === "danger" ? <AlertTriangle size={23}/> : <Check size={23}/>}
      </span>
      <h2 id={titleId}>{options.title}</h2>
      <p id={descriptionId}>{options.message}</p>
      <div className="confirm-actions">
        <button ref={cancelButton} onClick={close} disabled={pending}>Скасувати</button>
        <button className={options.tone === "danger" ? "danger" : "primary"} disabled={pending} onClick={() => void confirm()}>{pending ? "Виконуємо…" : options.confirmLabel ?? "Підтвердити"}</button>
      </div>
    </section>
  </div>;
}
