import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LoaderCircle, ShieldCheck, Trash2, Wifi } from "lucide-react";
import { AiProvider, AppSettings } from "../../domain";
import { AiKeyStatus, deleteAiApiKey, getAiKeyStatus, saveAiApiKey, testAiConnection } from "./ai";

interface Props {
  settings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const providers: { id: AiProvider; title: string; company: string; placeholder: string; modelKey: "openaiModel" | "geminiModel"; models: { value: string; label: string }[] }[] = [
  { id: "openai", title: "GPT", company: "OpenAI", placeholder: "sk-…", modelKey: "openaiModel", models: [{ value: "gpt-5-mini", label: "GPT-5 mini · швидше й дешевше" }, { value: "gpt-5.6", label: "GPT-5.6 · найсильніший аналіз" }] },
  { id: "gemini", title: "Gemini", company: "Google", placeholder: "AIza…", modelKey: "geminiModel", models: [{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash · стабільна" }, { value: "gemini-3-flash-preview", label: "Gemini 3 Flash · preview" }] },
];

export function AiSettings({ settings, updateSettings }: Props) {
  const [status, setStatus] = useState<AiKeyStatus>({ openai: false, gemini: false });
  const [keys, setKeys] = useState<Record<AiProvider, string>>({ openai: "", gemini: "" });
  const [busy, setBusy] = useState<AiProvider | null>(null);
  const [verified, setVerified] = useState<Record<AiProvider, boolean>>({ openai: false, gemini: false });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getAiKeyStatus()
      .then((value) => active && setStatus(value))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { active = false; };
  }, []);

  const saveKey = async (provider: AiProvider) => {
    const value = keys[provider].trim();
    if (!value) {
      setError("Встав API-ключ перед збереженням.");
      return;
    }
    setBusy(provider);
    setError(null);
    setMessage(null);
    try {
      await saveAiApiKey(provider, value);
      setStatus((current) => ({ ...current, [provider]: true }));
      setVerified((current) => ({ ...current, [provider]: false }));
      setKeys((current) => ({ ...current, [provider]: "" }));
      setMessage(`${provider === "openai" ? "OpenAI" : "Gemini"} API-ключ безпечно збережено.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const testConnection = async (provider: AiProvider) => {
    const config = providers.find((item) => item.id === provider)!;
    setBusy(provider);
    setError(null);
    setMessage(null);
    try {
      const result = await testAiConnection(provider, settings[config.modelKey]);
      setVerified((current) => ({ ...current, [provider]: true }));
      setMessage(result);
    } catch (reason) {
      setVerified((current) => ({ ...current, [provider]: false }));
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  const deleteKey = async (provider: AiProvider) => {
    if (!window.confirm(`Видалити збережений ${provider === "openai" ? "OpenAI" : "Gemini"} API-ключ?`)) return;
    setBusy(provider);
    setError(null);
    setMessage(null);
    try {
      await deleteAiApiKey(provider);
      setStatus((current) => ({ ...current, [provider]: false }));
      setVerified((current) => ({ ...current, [provider]: false }));
      setMessage("API-ключ видалено із захищеного сховища Windows.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(null);
    }
  };

  return <article className="card settings-card settings-wide ai-provider-settings">
    <div className="ai-settings-copy">
      <span className="ai-settings-icon"><KeyRound size={20}/></span>
      <div><h2>AI-помічник</h2><p>Обери GPT або Gemini. Ключі зберігаються окремо в захищеному сховищі Windows і не входять у резервну копію.</p></div>
    </div>
    <div className="ai-provider-settings-content">
      <div className="ai-provider-choice" aria-label="Активний AI-провайдер">
        {providers.map((provider) => <button key={provider.id} className={settings.aiProvider === provider.id ? "active" : ""} onClick={() => updateSettings({ aiProvider: provider.id })}>
          <strong>{provider.title}</strong><span>{provider.company}</span>{status[provider.id] && <CheckCircle2 size={15}/>} 
        </button>)}
      </div>

      {providers.map((provider) => {
        const active = settings.aiProvider === provider.id;
        return <section className={`ai-credential-panel ${active ? "active" : ""}`} key={provider.id}>
          <div className="ai-credential-head"><div><strong>{provider.title}</strong><span>{active ? "Активний у чаті" : "Доступний для перемикання"}</span></div><small className={status[provider.id] ? "saved" : ""}>{verified[provider.id] ? "Підключення працює" : status[provider.id] ? "Ключ збережено" : "Ключ не додано"}</small></div>
          <label>Модель<select value={settings[provider.modelKey]} onChange={(event) => { updateSettings({ [provider.modelKey]: event.target.value } as Partial<AppSettings>); setVerified((current) => ({ ...current, [provider.id]: false })); }}>{provider.models.map((model) => <option value={model.value} key={model.value}>{model.label}</option>)}</select></label>
          <label>API-ключ<div className="ai-key-input"><KeyRound size={15}/><input type="password" autoComplete="off" value={keys[provider.id]} onChange={(event) => setKeys((current) => ({ ...current, [provider.id]: event.target.value }))} placeholder={status[provider.id] ? "Введи новий ключ, щоб замінити" : provider.placeholder}/></div></label>
          <div className="ai-credential-actions"><button className="primary" onClick={() => void saveKey(provider.id)} disabled={busy !== null || !keys[provider.id].trim()}>{busy === provider.id ? <LoaderCircle className="spin" size={15}/> : <ShieldCheck size={15}/>} {status[provider.id] ? "Замінити ключ" : "Зберегти ключ"}</button>{status[provider.id] && <button onClick={() => void testConnection(provider.id)} disabled={busy !== null}><Wifi size={15}/> Перевірити</button>}{status[provider.id] && <button className="remove" onClick={() => void deleteKey(provider.id)} disabled={busy !== null}><Trash2 size={15}/> Видалити</button>}</div>
        </section>;
      })}
      <section className="ai-data-settings">
        <div><ShieldCheck size={18}/><span><strong>Які дані бачить AI</strong><small>Назви й статуси проєктів та задач, підсумки часу і до 8 останніх повідомлень. Ключ ніколи не передається в інтерфейс.</small></span></div>
        <div className="ai-data-controls"><label className="switch-row"><span>Передавати історію фокус-сесій</span><input type="checkbox" checked={settings.aiIncludeSessionHistory} onChange={(event) => updateSettings({ aiIncludeSessionHistory: event.target.checked })}/><i/></label>{settings.aiConsentAccepted && <button onClick={() => updateSettings({ aiConsentAccepted: false })}>Скасувати дозвіл</button>}</div>
      </section>
      {message && <div className="ai-settings-message success"><CheckCircle2 size={16}/>{message}</div>}
      {error && <div className="ai-settings-message error">{error}</div>}
    </div>
  </article>;
}
