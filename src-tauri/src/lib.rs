use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use keyring_core::Entry;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tokio::sync::oneshot;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiRequest {
    request_id: String,
    provider: String,
    model: String,
    prompt: String,
}

#[derive(Default)]
struct AiRequestState(Mutex<HashMap<String, oneshot::Sender<()>>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AiKeyStatus {
    openai: bool,
    gemini: bool,
}

const AI_CREDENTIAL_SERVICE: &str = "com.melychyn.etask.ai";

fn configure_credential_store() -> keyring_core::Result<()> {
    #[cfg(target_os = "windows")]
    keyring_core::set_default_store(windows_native_keyring_store::Store::new()?);

    Ok(())
}

fn provider_credential_name(provider: &str) -> Result<&'static str, String> {
    match provider {
        "openai" => Ok("openai"),
        "gemini" => Ok("gemini"),
        _ => Err("Невідомий AI-провайдер.".into()),
    }
}

fn validate_model(model: &str) -> Result<&str, String> {
    let model = model.trim();
    if model.is_empty() {
        return Err("Обери модель AI у Налаштуваннях.".into());
    }
    if model.len() > 100 || !model.chars().all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')) {
        return Err("Назва моделі AI містить недопустимі символи.".into());
    }
    Ok(model)
}

fn credential_entry(provider: &str) -> Result<Entry, String> {
    let credential_name = provider_credential_name(provider)?;
    Entry::new(AI_CREDENTIAL_SERVICE, credential_name)
        .map_err(|error| format!("Не вдалося відкрити захищене сховище Windows: {error}"))
}

fn load_api_key(provider: &str) -> Result<String, String> {
    let key = credential_entry(provider)?
        .get_password()
        .map_err(|_| "API-ключ для вибраного провайдера ще не збережено в Налаштуваннях.".to_string())?;
    if key.trim().is_empty() {
        return Err("API-ключ для вибраного провайдера ще не збережено в Налаштуваннях.".into());
    }
    Ok(key)
}

fn has_api_key(provider: &str) -> bool {
    credential_entry(provider)
        .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
        .map(|key| !key.trim().is_empty())
        .unwrap_or(false)
}

#[tauri::command]
fn ai_key_status() -> AiKeyStatus {
    AiKeyStatus {
        openai: has_api_key("openai"),
        gemini: has_api_key("gemini"),
    }
}

#[tauri::command]
fn ai_save_api_key(provider: String, api_key: String) -> Result<(), String> {
    let key = api_key.trim();
    if key.is_empty() {
        return Err("API-ключ не може бути порожнім.".into());
    }
    credential_entry(&provider)?
        .set_password(key)
        .map_err(|error| format!("Не вдалося зберегти API-ключ у захищеному сховищі Windows: {error}"))
}

#[tauri::command]
fn ai_delete_api_key(provider: String) -> Result<(), String> {
    let entry = credential_entry(&provider)?;
    if entry.get_password().is_err() {
        return Ok(());
    }
    entry
        .delete_credential()
        .map_err(|error| format!("Не вдалося видалити API-ключ із захищеного сховища Windows: {error}"))
}

#[tauri::command]
async fn ai_test_connection(provider: String, model: String) -> Result<String, String> {
    let model = validate_model(&model)?;
    let api_key = load_api_key(&provider)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|_| "Не вдалося підготувати мережеве підключення.".to_string())?;
    let response = match provider.as_str() {
        "openai" => client
            .get(format!("https://api.openai.com/v1/models/{model}"))
            .bearer_auth(&api_key)
            .send()
            .await
            .map_err(|error| network_error("OpenAI", &error))?,
        "gemini" => client
            .get(format!("https://generativelanguage.googleapis.com/v1beta/models/{model}"))
            .header("x-goog-api-key", &api_key)
            .send()
            .await
            .map_err(|error| network_error("Gemini", &error))?,
        _ => return Err("Невідомий AI-провайдер.".into()),
    };
    let status = response.status();
    let body = response_body(response).await;
    if !status.is_success() {
        return Err(api_error(&provider, status.as_u16(), &body));
    }
    Ok(format!("{} підключено. Модель {model} доступна.", if provider == "openai" { "OpenAI" } else { "Gemini" }))
}

#[tauri::command]
fn ai_cancel_request(request_id: String, state: State<'_, AiRequestState>) -> Result<(), String> {
    let sender = state.0.lock().map_err(|_| "Не вдалося зупинити AI-запит.".to_string())?.remove(&request_id);
    if let Some(sender) = sender {
        let _ = sender.send(());
    }
    Ok(())
}

#[tauri::command]
async fn ai_request(request: AiRequest, state: State<'_, AiRequestState>) -> Result<String, String> {
    validate_model(&request.model)?;
    let api_key = load_api_key(&request.provider)?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|_| "Не вдалося підготувати мережеве підключення.".to_string())?;

    let (cancel_sender, cancel_receiver) = oneshot::channel();
    state.0.lock().map_err(|_| "Не вдалося запустити AI-запит.".to_string())?.insert(request.request_id.clone(), cancel_sender);
    let result = tokio::select! {
        _ = cancel_receiver => Err("Запит зупинено.".into()),
        response = async {
            match request.provider.as_str() {
                "openai" => request_openai(&client, &request, &api_key).await,
                "gemini" => request_gemini(&client, &request, &api_key).await,
                _ => Err("Невідомий AI-провайдер.".into()),
            }
        } => response,
    };
    if let Ok(mut requests) = state.0.lock() {
        requests.remove(&request.request_id);
    }
    result
}

fn assistant_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "message": { "type": "string" },
            "actions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "type": { "type": "string", "enum": ["create_project", "create_task", "update_task", "complete_task"] },
                        "title": { "type": ["string", "null"] },
                        "taskId": { "type": ["string", "null"] },
                        "projectId": { "type": ["string", "null"] },
                        "projectTitle": { "type": ["string", "null"] },
                        "description": { "type": ["string", "null"] },
                        "skill": { "type": ["string", "null"] },
                        "targetMinutes": { "type": ["integer", "null"] },
                        "iconKey": {
                            "type": ["string", "null"],
                            "enum": ["list-todo", "code", "design", "writing", "research", "learning", "communication", "planning", "document", "analysis", "marketing", "build", "health", "fitness", "creative", "video", null]
                        }
                    },
                    "required": ["type", "title", "taskId", "projectId", "projectTitle", "description", "skill", "targetMinutes", "iconKey"],
                    "additionalProperties": false
                }
            }
        },
        "required": ["message", "actions"],
        "additionalProperties": false
    })
}

async fn request_openai(client: &reqwest::Client, request: &AiRequest, api_key: &str) -> Result<String, String> {
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&openai_request_body(request))
        .send()
        .await
        .map_err(|error| network_error("OpenAI", &error))?;

    let status = response.status();
    let body = response_body(response).await;
    if !status.is_success() {
        return Err(api_error("OpenAI", status.as_u16(), &body));
    }

    body.get("output")
        .and_then(Value::as_array)
        .and_then(|output| output.iter().find(|item| item.get("type").and_then(Value::as_str) == Some("message")))
        .and_then(|message| message.get("content"))
        .and_then(Value::as_array)
        .and_then(|content| content.iter().find(|item| item.get("type").and_then(Value::as_str) == Some("output_text")))
        .and_then(|item| item.get("text"))
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "OpenAI не повернув текстову відповідь.".into())
}

fn openai_request_body(request: &AiRequest) -> Value {
    json!({
        "model": request.model.trim(),
        "input": request.prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "etask_assistant",
                "strict": true,
                "schema": assistant_schema()
            }
        }
    })
}

async fn request_gemini(client: &reqwest::Client, request: &AiRequest, api_key: &str) -> Result<String, String> {
    validate_model(&request.model)?;
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        request.model.trim()
    );
    let response = client
        .post(url)
        .header("x-goog-api-key", api_key)
        .json(&json!({
            "contents": [{ "role": "user", "parts": [{ "text": request.prompt }] }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": assistant_schema()
            }
        }))
        .send()
        .await
        .map_err(|error| network_error("Gemini", &error))?;

    let status = response.status();
    let body = response_body(response).await;
    if !status.is_success() {
        return Err(api_error("Gemini", status.as_u16(), &body));
    }

    body.pointer("/candidates/0/content/parts/0/text")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "Gemini не повернув текстову відповідь.".into())
}

async fn response_body(response: reqwest::Response) -> Value {
    let text = response.text().await.unwrap_or_default();
    serde_json::from_str(&text).unwrap_or_else(|_| json!({}))
}

fn network_error(provider: &str, error: &reqwest::Error) -> String {
    if error.is_timeout() {
        return format!("{provider} не відповів вчасно. Перевір інтернет і повтори запит.");
    }
    format!("Не вдалося підключитися до {provider}. Перевір інтернет-з’єднання.")
}

fn api_error(provider: &str, status: u16, body: &Value) -> String {
    let provider = if provider.eq_ignore_ascii_case("openai") { "OpenAI" } else { "Gemini" };
    let message = body.pointer("/error/message").and_then(Value::as_str).unwrap_or("провайдер відхилив запит");
    let parameter = body.pointer("/error/param").and_then(Value::as_str).unwrap_or_default();
    let normalized_message = message.to_ascii_lowercase();

    if provider == "OpenAI"
        && status == 400
        && (parameter.eq_ignore_ascii_case("prompt_cache_retention")
            || normalized_message.contains("prompt_cache_retention"))
    {
        return "OpenAI: ця модель не підтримує застаріле кешування. Онови E-task до останньої версії та повтори запит.".into();
    }

    if provider == "OpenAI" && status == 400 && normalized_message.contains("not supported on this model") {
        return "OpenAI: вибрана модель не підтримує цей формат запиту. Обери іншу модель у Налаштуваннях.".into();
    }

    match status {
        401 | 403 => format!("{provider}: API-ключ недійсний або не має доступу до цієї моделі."),
        402 => format!("{provider}: для API потрібно поповнити баланс."),
        404 => format!("{provider}: вибрана модель недоступна. Обери іншу модель у Налаштуваннях."),
        408 => format!("{provider}: запит тривав надто довго. Спробуй ще раз."),
        429 => format!("{provider}: перевищено ліміт запитів або закінчився доступний баланс."),
        500..=599 => format!("{provider} тимчасово недоступний. Повтори запит трохи пізніше."),
        _ => format!("{provider}: {message}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn openai_request(model: &str) -> AiRequest {
        AiRequest {
            request_id: "test-request".into(),
            provider: "openai".into(),
            model: model.into(),
            prompt: "Допоможи спланувати день".into(),
        }
    }

    #[test]
    fn openai_request_uses_only_supported_top_level_fields() {
        for model in ["gpt-5-mini", "gpt-5.6"] {
            let body = openai_request_body(&openai_request(model));
            let mut keys = body
                .as_object()
                .expect("OpenAI request body must be an object")
                .keys()
                .map(String::as_str)
                .collect::<Vec<_>>();
            keys.sort_unstable();

            assert_eq!(keys, ["input", "model", "text"]);
            assert_eq!(body.get("model").and_then(Value::as_str), Some(model));
            assert!(body.get("prompt_cache_retention").is_none());
        }
    }

    #[test]
    fn explains_deprecated_prompt_cache_parameter_in_ukrainian() {
        let body = json!({
            "error": {
                "message": "prompt_cache_retention is not supported on this model",
                "param": "prompt_cache_retention"
            }
        });

        assert_eq!(
            api_error("OpenAI", 400, &body),
            "OpenAI: ця модель не підтримує застаріле кешування. Онови E-task до останньої версії та повтори запит."
        );
    }

    #[test]
    fn keeps_rate_limit_message_even_if_body_mentions_cache_parameter() {
        let body = json!({
            "error": {
                "message": "Rate limit reached while handling prompt_cache_retention"
            }
        });

        assert_eq!(
            api_error("OpenAI", 429, &body),
            "OpenAI: перевищено ліміт запитів або закінчився доступний баланс."
        );
    }

    #[test]
    fn assistant_schema_restricts_task_icons_to_the_local_catalog() {
        let schema = assistant_schema();
        let icon_values = schema
            .pointer("/properties/actions/items/properties/iconKey/enum")
            .and_then(Value::as_array)
            .expect("iconKey enum must exist");
        let required = schema
            .pointer("/properties/actions/items/required")
            .and_then(Value::as_array)
            .expect("action required fields must exist");

        assert!(icon_values.iter().any(|value| value.as_str() == Some("video")));
        assert!(icon_values.iter().any(Value::is_null));
        assert!(!icon_values.iter().any(|value| value.as_str() == Some("remote-icon-url")));
        assert!(required.iter().any(|value| value.as_str() == Some("iconKey")));
    }
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create core E-task tables",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add task icon key",
            sql: include_str!("../migrations/0002_add_task_icon.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(AiRequestState::default())
        .invoke_handler(tauri::generate_handler![ai_request, ai_cancel_request, ai_test_connection, ai_key_status, ai_save_api_key, ai_delete_api_key])
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:etask.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            configure_credential_store()?;
            let open = MenuItem::with_id(app, "open", "Відкрити E-task", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Вийти", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("application icon is missing").clone())
                .tooltip("E-task — фокус і задачі")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running E-task");
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
