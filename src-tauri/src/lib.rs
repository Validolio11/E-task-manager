use serde::{Deserialize, Serialize};
use std::{collections::HashMap, net::IpAddr, sync::OnceLock, time::Duration};
use tokio::sync::{oneshot, Mutex};

const MAX_ENDPOINT_BYTES: usize = 2_048;
const MAX_MODEL_CHARS: usize = 160;
const MAX_KEY_CHARS: usize = 8_192;
const MAX_MESSAGES: usize = 13;
const MAX_MESSAGE_CHARS: usize = 8_000;
const MAX_TOTAL_MESSAGE_BYTES: usize = 96_000;
const MAX_RESPONSE_BYTES: usize = 1_000_000;
const MAX_RESPONSE_CHARS: usize = 12_000;

type CancellationMap = Mutex<HashMap<String, oneshot::Sender<()>>>;
static AI_CANCELLATIONS: OnceLock<CancellationMap> = OnceLock::new();

fn cancellations() -> &'static CancellationMap {
  AI_CANCELLATIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Deserialize, Serialize)]
struct AiApiMessage {
  role: String,
  content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiChatRequest {
  request_id: String,
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

fn is_loopback(host: &str) -> bool {
  let normalized = host.trim_matches(|character| character == '[' || character == ']');
  normalized.eq_ignore_ascii_case("localhost")
    || normalized.to_ascii_lowercase().ends_with(".localhost")
    || normalized.parse::<IpAddr>().is_ok_and(|address| address.is_loopback())
}

fn is_blocked_ip_literal(host: &str) -> bool {
  let normalized = host.trim_matches(|character| character == '[' || character == ']');
  let Ok(address) = normalized.parse::<IpAddr>() else { return false };
  if address.is_loopback() { return false; }
  match address {
    IpAddr::V4(address) => {
      let [first, second, _, _] = address.octets();
      address.is_private()
        || address.is_link_local()
        || address.is_unspecified()
        || address.is_multicast()
        || address.is_broadcast()
        || (first == 100 && (64..=127).contains(&second))
        || first >= 240
    }
    IpAddr::V6(address) => {
      let first = address.segments()[0];
      address.is_unique_local()
        || address.is_unicast_link_local()
        || address.is_unspecified()
        || address.is_multicast()
        || (first & 0xffc0) == 0xfec0
        || address.to_ipv4_mapped().is_some_and(|mapped| is_blocked_ip_literal(&mapped.to_string()))
    }
  }
}

fn validate_request(request: &AiChatRequest) -> Result<reqwest::Url, String> {
  if request.endpoint.len() > MAX_ENDPOINT_BYTES {
    return Err("Адреса AI API надто довга.".to_string());
  }
  let mut endpoint = reqwest::Url::parse(&request.endpoint).map_err(|_| "Некоректна адреса AI API.".to_string())?;
  if !endpoint.username().is_empty() || endpoint.password().is_some() {
    return Err("Адреса AI API не може містити логін або пароль.".to_string());
  }
  if endpoint.host_str().is_some_and(is_blocked_ip_literal) {
    return Err("Приватні, локальні та службові IP-адреси не дозволені для AI API.".to_string());
  }
  match endpoint.scheme() {
    "https" => {}
    "http" if endpoint.host_str().is_some_and(is_loopback) => {}
    "http" => return Err("Незахищений HTTP дозволений лише для локального AI API.".to_string()),
    _ => return Err("AI API має використовувати HTTPS.".to_string()),
  }
  endpoint.set_fragment(None);

  let model = request.model.trim();
  if model.is_empty() {
    return Err("Не вказано модель AI.".to_string());
  }
  if model.chars().count() > MAX_MODEL_CHARS || model.chars().any(char::is_control) {
    return Err("Назва моделі надто довга або має недопустимий формат.".to_string());
  }
  let key = request.api_key.trim();
  if key.chars().count() > MAX_KEY_CHARS || key.chars().any(char::is_control) {
    return Err("API-ключ надто довгий або має недопустимий формат.".to_string());
  }
  if request.request_id.is_empty() || request.request_id.len() > 80 || !request.request_id.is_ascii() {
    return Err("Некоректний ідентифікатор AI-запиту.".to_string());
  }
  if request.messages.is_empty() || request.messages.len() > MAX_MESSAGES {
    return Err("Історія AI-запиту надто велика.".to_string());
  }
  let mut total_bytes = 0usize;
  for message in &request.messages {
    if message.role != "system" && message.role != "user" && message.role != "assistant" {
      return Err("AI-запит містить некоректну роль повідомлення.".to_string());
    }
    if message.content.chars().count() > MAX_MESSAGE_CHARS {
      return Err("Одне з AI-повідомлень надто довге.".to_string());
    }
    total_bytes = total_bytes.saturating_add(message.content.len());
  }
  if total_bytes > MAX_TOTAL_MESSAGE_BYTES {
    return Err("AI-запит надто великий.".to_string());
  }
  Ok(endpoint)
}

async fn execute_ai_request(request: &AiChatRequest, endpoint: reqwest::Url) -> Result<String, String> {
  let client = reqwest::Client::builder()
    .timeout(Duration::from_secs(45))
    .redirect(reqwest::redirect::Policy::none())
    .build()
    .map_err(|_| "Не вдалося підготувати підключення до AI.".to_string())?;
  let mut call = client.post(endpoint).json(&AiRequestBody {
    model: request.model.trim(),
    messages: &request.messages,
  });
  if !request.api_key.trim().is_empty() {
    call = call.bearer_auth(request.api_key.trim());
  }
  let mut response = call.send().await.map_err(|error| {
    if error.is_timeout() { "AI не відповів протягом 45 секунд.".to_string() }
    else { "Не вдалося підключитися до AI API. Перевірте адресу та мережу.".to_string() }
  })?;
  let status = response.status();
  if response.content_length().is_some_and(|length| length > MAX_RESPONSE_BYTES as u64) {
    return Err("Відповідь AI надто велика.".to_string());
  }
  let mut response_bytes = Vec::new();
  while let Some(chunk) = response.chunk().await.map_err(|_| "Не вдалося прочитати відповідь AI API.".to_string())? {
    if response_bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
      return Err("Відповідь AI надто велика.".to_string());
    }
    response_bytes.extend_from_slice(&chunk);
  }
  let payload: serde_json::Value = serde_json::from_slice(&response_bytes).map_err(|_| "AI API повернув некоректну відповідь.".to_string())?;
  if !status.is_success() {
    if status.as_u16() == 401 || status.as_u16() == 403 { return Err("API відхилив ключ. Перевірте ключ і доступ до моделі.".to_string()); }
    if status.as_u16() == 429 { return Err("Ліміт API вичерпано або забагато запитів. Спробуйте пізніше.".to_string()); }
    let message = payload.pointer("/error/message").and_then(|value| value.as_str()).unwrap_or("");
    return Err(if !message.is_empty() && message.chars().count() < 240 { message.to_string() } else { format!("AI API повернув помилку {}.", status.as_u16()) });
  }
  let content = payload.pointer("/choices/0/message/content")
    .and_then(|value| value.as_str())
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .ok_or_else(|| "AI API не повернув текстову відповідь.".to_string())?;
  if content.chars().count() > MAX_RESPONSE_CHARS {
    return Err("Відповідь AI надто довга. Попросіть коротшу відповідь.".to_string());
  }
  Ok(content.to_string())
}

#[tauri::command]
async fn cancel_ai_chat(request_id: String) -> bool {
  cancellations().lock().await.remove(&request_id).is_some_and(|sender| sender.send(()).is_ok())
}

#[tauri::command]
async fn ai_chat(request: AiChatRequest) -> Result<String, String> {
  let endpoint = validate_request(&request)?;
  let request_id = request.request_id.clone();
  let (cancel_sender, cancel_receiver) = oneshot::channel();
  cancellations().lock().await.insert(request_id.clone(), cancel_sender);
  let result = tokio::select! {
    result = execute_ai_request(&request, endpoint) => result,
    _ = cancel_receiver => Err("Запит до AI скасовано.".to_string()),
  };
  cancellations().lock().await.remove(&request_id);
  result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![ai_chat, cancel_ai_chat])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  fn request(endpoint: &str) -> AiChatRequest {
    AiChatRequest {
      request_id: "test-request".to_string(),
      endpoint: endpoint.to_string(),
      model: "test-model".to_string(),
      api_key: String::new(),
      messages: vec![AiApiMessage { role: "user".to_string(), content: "Привіт".to_string() }],
    }
  }

  #[test]
  fn permits_https_and_local_http() {
    assert!(validate_request(&request("https://example.com/v1/chat/completions")).is_ok());
    assert!(validate_request(&request("http://127.0.0.1:11434/v1/chat/completions")).is_ok());
    assert!(validate_request(&request("http://[::1]:11434/v1/chat/completions")).is_ok());
  }

  #[test]
  fn blocks_remote_http_and_credentials() {
    assert!(validate_request(&request("http://example.com/v1/chat/completions")).is_err());
    assert!(validate_request(&request("https://user:secret@example.com/v1/chat/completions")).is_err());
  }

  #[test]
  fn blocks_private_and_link_local_ip_literals() {
    assert!(validate_request(&request("https://10.0.0.1/v1/chat/completions")).is_err());
    assert!(validate_request(&request("https://192.168.31.1/v1/chat/completions")).is_err());
    assert!(validate_request(&request("https://169.254.169.254/latest/meta-data")).is_err());
    assert!(validate_request(&request("https://[fd00::1]/v1/chat/completions")).is_err());
    assert!(validate_request(&request("https://[fe80::1]/v1/chat/completions")).is_err());
    assert!(validate_request(&request("https://8.8.8.8/v1/chat/completions")).is_ok());
    assert!(validate_request(&request("http://127.0.0.1:11434/v1/chat/completions")).is_ok());
  }

  #[test]
  fn limits_message_size_and_roles() {
    let mut oversized = request("https://example.com/v1/chat/completions");
    oversized.messages[0].content = "x".repeat(MAX_MESSAGE_CHARS + 1);
    assert!(validate_request(&oversized).is_err());
    let mut invalid_role = request("https://example.com/v1/chat/completions");
    invalid_role.messages[0].role = "tool".to_string();
    assert!(validate_request(&invalid_role).is_err());
  }
}
