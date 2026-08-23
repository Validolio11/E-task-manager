import { RefObject, useLayoutEffect, useRef } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function visibleFocusables(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(focusableSelector)]
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
}

export function useDialogFocus(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
  explicitReturnFocusRef?: RefObject<HTMLElement | null>,
) {
  const closeRef = useRef(onClose);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (explicitReturnFocusRef?.current) {
      returnFocusRef.current = explicitReturnFocusRef.current;
    } else if (document.activeElement instanceof HTMLElement && !container.contains(document.activeElement)) {
      returnFocusRef.current = document.activeElement;
    }
    const focusables = visibleFocusables(container);
    const autofocus = container.querySelector<HTMLElement>("[autofocus], .modal-form input:not([type='checkbox']):not([type='radio']), .modal-form textarea, .modal-form select");
    const initial = initialFocusRef?.current ?? autofocus ?? focusables[0] ?? container;
    initial.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      if (dialogs[dialogs.length - 1] !== container) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const currentFocusables = visibleFocusables(container);
      if (!currentFocusables.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const returnFocus = returnFocusRef.current;
      if (returnFocus?.isConnected && !returnFocus.matches(":disabled")) returnFocus.focus();
      else document.querySelector<HTMLElement>(".app-shell")?.focus();
    };
  }, [containerRef, explicitReturnFocusRef, initialFocusRef]);
}
