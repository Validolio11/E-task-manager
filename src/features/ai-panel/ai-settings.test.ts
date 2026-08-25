import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AI_SETTINGS, GEMINI_OPENAI_PRESET, loadAiSettings, prepareAiSettings, saveAiSettings, validateAiEndpoint, type AiSettings } from "./ai-settings";

const memory = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => memory.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { memory.set(key, value); }),
};

beforeEach(() => {
  memory.clear();
  vi.stubGlobal("localStorage", localStorageMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("AI settings security", () => {
  const apiSettings: AiSettings = { ...DEFAULT_AI_SETTINGS, mode: "api", model: "model", apiKey: "secret", shareTaskContext: true };

  it("allows HTTPS and loopback HTTP but blocks remote HTTP and URL credentials", () => {
    expect(validateAiEndpoint("https://example.com/v1").protocol).toBe("https:");
    expect(validateAiEndpoint("http://localhost:11434/v1").protocol).toBe("http:");
    expect(validateAiEndpoint("http://127.0.0.1:11434/v1").protocol).toBe("http:");
    expect(() => validateAiEndpoint("http://example.com/v1")).toThrow("лише для локального API");
    expect(() => validateAiEndpoint("https://user:secret@example.com/v1")).toThrow("логін або пароль");
  });

  it("blocks literal private, LAN and link-local endpoints while preserving loopback", () => {
    expect(() => validateAiEndpoint("https://10.0.0.1/v1")).toThrow("IP-адреси не дозволені");
    expect(() => validateAiEndpoint("https://192.168.31.1/v1")).toThrow("IP-адреси не дозволені");
    expect(() => validateAiEndpoint("https://169.254.169.254/latest/meta-data")).toThrow("IP-адреси не дозволені");
    expect(() => validateAiEndpoint("https://[fd00::1]/v1")).toThrow("IP-адреси не дозволені");
    expect(() => validateAiEndpoint("https://[fe80::1]/v1")).toThrow("IP-адреси не дозволені");
    expect(validateAiEndpoint("https://8.8.8.8/v1").hostname).toBe("8.8.8.8");
    expect(validateAiEndpoint("http://[::1]:11434/v1").protocol).toBe("http:");
  });

  it("never persists the API key in plaintext", () => {
    saveAiSettings(apiSettings);
    const stored = [...memory.values()][0];
    expect(stored).not.toContain("secret");
    expect(loadAiSettings()).toMatchObject({ apiKey: "", rememberKey: false, shareTaskContext: true });
  });

  it("removes plaintext keys left by older versions", () => {
    memory.set("etask.ai-settings.v1", JSON.stringify({ ...apiSettings, rememberKey: true }));
    expect(loadAiSettings().apiKey).toBe("");
    expect(memory.get("etask.ai-settings.v1")).not.toContain("secret");
  });

  it("normalizes settings and disables key persistence", () => {
    expect(prepareAiSettings(apiSettings)).toMatchObject({ baseUrl: "https://api.openai.com/v1", model: "model", apiKey: "secret", rememberKey: false });
  });

  it("provides a working Gemini preset and requires its API key", () => {
    expect(GEMINI_OPENAI_PRESET).toEqual({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
      model: "gemini-3.7-flash",
    });
    expect(() => prepareAiSettings({ ...apiSettings, ...GEMINI_OPENAI_PRESET, apiKey: "" })).toThrow("Google Gemini потрібно додати API-ключ");
    expect(prepareAiSettings({ ...apiSettings, ...GEMINI_OPENAI_PRESET })).toMatchObject(GEMINI_OPENAI_PRESET);
  });
});
