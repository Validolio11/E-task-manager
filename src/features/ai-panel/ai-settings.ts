export type AiSettings = {
  mode: "local" | "api";
  baseUrl: string;
  model: string;
  apiKey: string;
  rememberKey: boolean;
};

const AI_SETTINGS_KEY = "etask.ai-settings.v1";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  mode: "local",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  apiKey: "",
  rememberKey: true,
};

export function loadAiSettings(): AiSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) ?? "null") as Partial<AiSettings> | null;
    if (!parsed) return DEFAULT_AI_SETTINGS;
    return {
      mode: parsed.mode === "api" ? "api" : "local",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_AI_SETTINGS.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : "",
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      rememberKey: parsed.rememberKey !== false,
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function prepareAiSettings(settings: AiSettings): AiSettings {
  if (settings.mode === "local") return { ...settings };
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, "");
  const model = settings.model.trim();
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Вкажіть коректну адресу API.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("API має використовувати HTTP або HTTPS.");
  if (!model) throw new Error("Вкажіть назву моделі.");
  if (url.hostname === "api.openai.com" && !settings.apiKey.trim()) throw new Error("Для OpenAI потрібно додати API-ключ.");
  return { ...settings, baseUrl, model, apiKey: settings.apiKey.trim() };
}

export function saveAiSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({
    ...settings,
    apiKey: settings.rememberKey ? settings.apiKey : "",
  }));
}
