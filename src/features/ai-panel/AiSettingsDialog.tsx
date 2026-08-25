import { BadgeCheck, Eye, EyeOff, KeyRound, LoaderCircle, Server, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Dialog } from "../../shared/Dialog";
import { requestAiReply } from "./ai-client";
import { GEMINI_OPENAI_PRESET, isGeminiHostname, isLoopbackHostname, prepareAiSettings, type AiSettings } from "./ai-settings";

export function AiSettingsDialog({ initial, onClose, onSave }: { initial: AiSettings; onClose: () => void; onSave: (settings: AiSettings) => void }) {
  const [draft, setDraft] = useState(initial);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"" | "testing" | "success">("");
  let usesLocalHttp = false;
  let usesGemini = false;
  try {
    const url = new URL(draft.baseUrl);
    usesLocalHttp = url.protocol === "http:" && isLoopbackHostname(url.hostname);
    usesGemini = isGeminiHostname(url.hostname);
  } catch { /* Validation is shown on submit. */ }
  const updateDraft = (changes: Partial<AiSettings>) => {
    setDraft((current) => ({ ...current, ...changes }));
    setError("");
    setConnectionStatus("");
  };
  const applyGeminiPreset = () => updateDraft({ mode: "api", ...GEMINI_OPENAI_PRESET });
  const testConnection = async () => {
    setError("");
    setConnectionStatus("testing");
    try {
      const settings = prepareAiSettings(draft);
      await requestAiReply(settings, [{ id: "settings-test", role: "user", content: "Відповідай одним словом: Готово.", createdAt: new Date().toISOString() }], [], null);
      setConnectionStatus("success");
    } catch (reason) {
      setConnectionStatus("");
      setError(reason instanceof Error ? reason.message : "Не вдалося перевірити підключення.");
    }
  };
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
        <button className={draft.mode === "local" ? "selected" : ""} type="button" onClick={() => updateDraft({ mode: "local" })}><KeyRound/>Локальний</button>
        <button className={draft.mode === "api" ? "selected" : ""} type="button" onClick={() => updateDraft({ mode: "api" })}><Server/>API</button>
      </div>
      {draft.mode === "api" && <div className="ai-api-fields">
        <div className="ai-gemini-preset"><span><Sparkles/><span><strong>Google Gemini</strong><small>Правильна адреса та рекомендована модель</small></span></span><button type="button" onClick={applyGeminiPreset}>Заповнити</button></div>
        <label>Адреса API<input type="url" value={draft.baseUrl} onChange={(event) => updateDraft({ baseUrl: event.target.value })} placeholder="https://…/v1" autoComplete="url" autoCapitalize="none" spellCheck={false}/></label>
        <label>Модель {usesGemini && <small>рекомендовано: {GEMINI_OPENAI_PRESET.model}</small>}<input value={draft.model} onChange={(event) => updateDraft({ model: event.target.value })} placeholder="Назва моделі у провайдера" autoCapitalize="none" spellCheck={false}/></label>
        <label>API-ключ <small>{usesGemini ? "обов’язковий для Gemini" : "якщо потрібен"}</small><span className="ai-key-field"><input type={showKey ? "text" : "password"} value={draft.apiKey} onChange={(event) => updateDraft({ apiKey: event.target.value })} placeholder="Вставте ключ" autoComplete="off" autoCapitalize="none" spellCheck={false}/><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "Приховати ключ" : "Показати ключ"}>{showKey ? <EyeOff/> : <Eye/>}</button></span></label>
        {usesLocalHttp && <p className="ai-http-warning" role="status">HTTP не шифрує запит. Він дозволений лише для локального API на цьому пристрої.</p>}
        <label className="share-context"><input type="checkbox" checked={draft.shareTaskContext} onChange={(event) => updateDraft({ shareTaskContext: event.target.checked })}/><span><strong>Передавати контекст задач</strong><small>До 5 активних задач: назва, проєкт, тривалість і вибір.</small></span></label>
        <div className="ai-connection-check"><button type="button" onClick={testConnection} disabled={connectionStatus === "testing"}>{connectionStatus === "testing" ? <LoaderCircle className="spin"/> : <Server/>}{connectionStatus === "testing" ? "Перевіряю…" : "Перевірити підключення"}</button>{connectionStatus === "success" && <span role="status"><BadgeCheck/>Підключення працює</span>}</div>
        <p className="ai-security-note">Текст повідомлення надсилається вказаному AI-провайдеру. API-ключ використовується лише для запиту й не зберігається у браузерному сховищі. Після перезавантаження його потрібно ввести знову. Провайдер також має дозволяти CORS.</p>
      </div>}
      {error && <p className="ai-settings-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" onClick={onClose}>Скасувати</button><button className="primary" type="submit">Зберегти</button></div>
    </form>
  </Dialog>;
}
