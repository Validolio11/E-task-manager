import { Eye, EyeOff, KeyRound, Server } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Dialog } from "../../shared/Dialog";
import { prepareAiSettings, type AiSettings } from "./ai-settings";

export function AiSettingsDialog({ initial, onClose, onSave }: { initial: AiSettings; onClose: () => void; onSave: (settings: AiSettings) => void }) {
  const [draft, setDraft] = useState(initial);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      onSave(prepareAiSettings(draft));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Перевірте налаштування.");
    }
  };

  return <Dialog title="Налаштування AI" description="Оберіть локальну підказку або підключіть сумісний AI API." onClose={onClose} className="ai-settings-dialog">
    <form className="ai-settings-form" onSubmit={submit}>
      <div className="ai-mode" role="group" aria-label="Режим AI">
        <button className={draft.mode === "local" ? "selected" : ""} type="button" onClick={() => { setDraft({ ...draft, mode: "local" }); setError(""); }}><KeyRound/>Локальний</button>
        <button className={draft.mode === "api" ? "selected" : ""} type="button" onClick={() => { setDraft({ ...draft, mode: "api" }); setError(""); }}><Server/>API</button>
      </div>
      {draft.mode === "api" && <div className="ai-api-fields">
        <label>Адреса API<input type="url" value={draft.baseUrl} onChange={(event) => { setDraft({ ...draft, baseUrl: event.target.value }); setError(""); }} placeholder="https://…/v1" autoCapitalize="none" spellCheck={false}/></label>
        <label>Модель<input value={draft.model} onChange={(event) => { setDraft({ ...draft, model: event.target.value }); setError(""); }} placeholder="Назва моделі у провайдера" autoCapitalize="none" spellCheck={false}/></label>
        <label>API-ключ <small>якщо потрібен</small><span className="ai-key-field"><input type={showKey ? "text" : "password"} value={draft.apiKey} onChange={(event) => { setDraft({ ...draft, apiKey: event.target.value }); setError(""); }} placeholder="Вставте ключ" autoComplete="off" autoCapitalize="none" spellCheck={false}/><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Приховати ключ" : "Показати ключ"}>{showKey ? <EyeOff/> : <Eye/>}</button></span></label>
        <label className="remember-key"><input type="checkbox" checked={draft.rememberKey} onChange={(event) => setDraft({ ...draft, rememberKey: event.target.checked })}/><span>Зберігати ключ на цьому пристрої</span></label>
        <p className="ai-security-note">Ключ використовується лише для запитів до вказаного API. Якщо зберігати його, він залишиться локально в даних застосунку. У браузерній версії провайдер має дозволяти CORS.</p>
      </div>}
      {error && <p className="ai-settings-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">Зберегти</button></div>
    </form>
  </Dialog>;
}
