use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Deserialize, Serialize)]
struct AiApiMessage {
  role: String,
  content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiChatRequest {
  endpoint: String,
  model: String,
  api_key: String,
  messages: Vec<AiApiMessage>,
}

#[derive(Serialize)]
struct AiRequestBody<'a> {
  model: &'a str,
  messages: &'a [AiApiMessage],
}

#[tauri::command]
async fn ai_chat(request: AiChatRequest) -> Result<String, String> {
  let endpoint = reqwest::Url::parse(&request.endpoint).map_err(|_| "Некоректна адреса AI API.".to_string())?;
  if endpoint.scheme() != "https" && endpoint.scheme() != "http" {
    return Err("AI API має використовувати HTTP або HTTPS.".to_string());
  }
  if request.model.trim().is_empty() {
    return Err("Не вказано модель AI.".to_string());
  }

  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(45))
    .build()
    .map_err(|_| "Не вдалося підготувати підключення до AI.".to_string())?;
  let mut call = client.post(endpoint).json(&AiRequestBody {
    model: request.model.trim(),
    messages: &request.messages,
  });
  if !request.api_key.trim().is_empty() {
    call = call.bearer_auth(request.api_key.trim());
  }
  let response = call.send().await.map_err(|error| {
    if error.is_timeout() { "AI не відповів протягом 45 секунд.".to_string() }
    else { "Не вдалося підключитися до AI API.".to_string() }
  })?;
  let status = response.status();
  let payload: serde_json::Value = response.json().await.map_err(|_| "AI API повернув некоректну відповідь.".to_string())?;
  if !status.is_success() {
    if status.as_u16() == 401 || status.as_u16() == 403 { return Err("API відхилив ключ. Перевірте ключ і доступ до моделі.".to_string()); }
    if status.as_u16() == 429 { return Err("Ліміт API вичерпано або забагато запитів. Спробуйте пізніше.".to_string()); }
    let message = payload.pointer("/error/message").and_then(|value| value.as_str()).unwrap_or("");
    return Err(if !message.is_empty() && message.chars().count() < 240 { message.to_string() } else { format!("AI API повернув помилку {}.", status.as_u16()) });
  }
  payload.pointer("/choices/0/message/content")
    .and_then(|value| value.as_str())
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(str::to_string)
    .ok_or_else(|| "AI API не повернув текстову відповідь.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![ai_chat])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
