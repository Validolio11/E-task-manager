export type AiSettings = {
  mode: "local" | "api";
  baseUrl: string;
  model: string;
  apiKey: string;
  /** Kept for backwards compatibility. API keys are never persisted in web storage. */
  rememberKey: boolean;
  shareTaskContext: boolean;
};

const AI_SETTINGS_KEY = "etask.ai-settings.v1";
const MAX_URL_LENGTH = 2_048;
const MAX_MODEL_LENGTH = 160;
const MAX_API_KEY_LENGTH = 8_192;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  mode: "local",
  baseUrl: "https://api.openai.com/v1",
  model: "",
  apiKey: "",
  rememberKey: false,
  shareTaskContext: false,
};

export function isLoopbackHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "0:0:0:0:0:0:0:1" || /^127(?:\.\d{1,3}){0,3}$/.test(host);
}

function ipv4Octets(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

export function isBlockedIpLiteral(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isLoopbackHostname(host)) return false;
  const ipv4 = ipv4Octets(host);
  if (ipv4) {
    const [first, second] = ipv4;
    return first === 0
      || first === 10
      || (first === 100 && second >= 64 && second <= 127)
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || first >= 224;
  }
  if (!host.includes(":")) return false;
  if (host === "::") return true;
  const firstGroup = Number.parseInt(host.split(":")[0] || "0", 16);
  if ((firstGroup & 0xfe00) === 0xfc00 || (firstGroup & 0xffc0) === 0xfe80 || (firstGroup & 0xffc0) === 0xfec0 || (firstGroup & 0xff00) === 0xff00) return true;
  if (host.startsWith("::ffff:")) {
    const suffix = host.slice(7);
    const dotted = ipv4Octets(suffix);
    if (dotted) return isBlockedIpLiteral(dotted.join("."));
    const groups = suffix.split(":");
    if (groups.length === 2 && groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) {
      const high = Number.parseInt(groups[0], 16);
      const low = Number.parseInt(groups[1], 16);
      return isBlockedIpLiteral(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }
  }
  return false;
}

export function validateAiEndpoint(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) throw new Error("Вкажіть коректну адресу API.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Вкажіть коректну адресу API.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("AI API має використовувати HTTPS.");
  if (!url.hostname || url.username || url.password) throw new Error("Адреса API не може містити логін або пароль.");
  if (isBlockedIpLiteral(url.hostname)) throw new Error("Приватні, локальні та службові IP-адреси не дозволені для AI API.");
  if (url.protocol === "http:" && !isLoopbackHostname(url.hostname)) {
    throw new Error("Незахищений HTTP дозволений лише для локального API на цьому пристрої.");
  }
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

export function loadAiSettings(): AiSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_SETTINGS_KEY) ?? "null") as Partial<AiSettings> | null;
    if (!parsed) return { ...DEFAULT_AI_SETTINGS };
    const settings: AiSettings = {
      mode: parsed.mode === "api" ? "api" : "local",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_AI_SETTINGS.baseUrl,
      model: typeof parsed.model === "string" ? parsed.model : "",
      apiKey: "",
      rememberKey: false,
      shareTaskContext: parsed.shareTaskContext === true,
    };
    // Remove plaintext keys saved by older versions as soon as they are detected.
    if (typeof parsed.apiKey === "string" && parsed.apiKey) saveAiSettings(settings);
    return settings;
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function prepareAiSettings(settings: AiSettings): AiSettings {
  if (settings.mode === "local") return { ...settings, apiKey: "", rememberKey: false, shareTaskContext: false };
  const url = validateAiEndpoint(settings.baseUrl);
  const model = settings.model.trim();
  const apiKey = settings.apiKey.trim();
  if (!model) throw new Error("Вкажіть назву моделі.");
  if (model.length > MAX_MODEL_LENGTH || /[\r\n\0]/.test(model)) throw new Error("Назва моделі надто довга або містить недопустимі символи.");
  if (apiKey.length > MAX_API_KEY_LENGTH || /[\r\n\0]/.test(apiKey)) throw new Error("API-ключ надто довгий або має недопустимий формат.");
  if (url.hostname === "api.openai.com" && !apiKey) throw new Error("Для OpenAI потрібно додати API-ключ.");
  return {
    ...settings,
    baseUrl: url.toString().replace(/\/$/, ""),
    model,
    apiKey,
    rememberKey: false,
    shareTaskContext: settings.shareTaskContext === true,
  };
}

export function saveAiSettings(settings: AiSettings) {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({
      mode: settings.mode,
      baseUrl: settings.baseUrl,
      model: settings.model,
      shareTaskContext: settings.shareTaskContext,
      rememberKey: false,
    }));
  } catch {
    throw new Error("Не вдалося зберегти налаштування AI на цьому пристрої.");
  }
}
