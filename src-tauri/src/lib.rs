use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_sql::{Migration, MigrationKind};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiRequest {
    provider: String,
    api_key: String,
    model: String,
    prompt: String,
}

#[tauri::command]
async fn ai_request(request: AiRequest) -> Result<String, String> {
    if request.api_key.trim().is_empty() {
        return Err("Додай API-ключ у налаштуваннях AI.".into());
    }
    if request.model.trim().is_empty() {
        return Err("Вкажи модель AI.".into());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(90))
        .build()
        .map_err(|error| error.to_string())?;

    match request.provider.as_str() {
        "openai" => request_openai(&client, &request).await,
        "gemini" => request_gemini(&client, &request).await,
        _ => Err("Невідомий AI-провайдер.".into()),
    }
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
                        "description": { "type": ["string", "null"] },
                        "skill": { "type": ["string", "null"] },
                        "targetMinutes": { "type": ["integer", "null"] }
                    },
                    "required": ["type", "title", "taskId", "projectId", "description", "skill", "targetMinutes"],
                    "additionalProperties": false
                }
            }
        },
        "required": ["message", "actions"],
        "additionalProperties": false
    })
}

async fn request_openai(client: &reqwest::Client, request: &AiRequest) -> Result<String, String> {
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(request.api_key.trim())
        .json(&json!({
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
        }))
        .send()
        .await
        .map_err(|error| format!("Не вдалося підключитися до OpenAI: {error}"))?;

    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
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

async fn request_gemini(client: &reqwest::Client, request: &AiRequest) -> Result<String, String> {
    if !request.model.chars().all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.')) {
        return Err("Назва моделі Gemini містить недопустимі символи.".into());
    }
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent",
        request.model.trim()
    );
    let response = client
        .post(url)
        .header("x-goog-api-key", request.api_key.trim())
        .json(&json!({
            "contents": [{ "role": "user", "parts": [{ "text": request.prompt }] }],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": assistant_schema()
            }
        }))
        .send()
        .await
        .map_err(|error| format!("Не вдалося підключитися до Gemini: {error}"))?;

    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(api_error("Gemini", status.as_u16(), &body));
    }

    body.pointer("/candidates/0/content/parts/0/text")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "Gemini не повернув текстову відповідь.".into())
}

fn api_error(provider: &str, status: u16, body: &Value) -> String {
    let message = body.pointer("/error/message").and_then(Value::as_str).unwrap_or("невідома помилка API");
    format!("{provider} ({status}): {message}")
}

pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create core E-task tables",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ai_request])
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
