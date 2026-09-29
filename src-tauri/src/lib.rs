use serde::Deserialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

/// A Bilibili HTTP request proxied through the Rust layer.
/// This lets us set Referer / User-Agent headers and optional Cookie
/// without being blocked by WebView CORS or forbidden headers.
#[derive(Deserialize)]
struct BiliFetchRequest {
    url: String,
    #[serde(default)]
    method: String,
    #[serde(default)]
    params: Vec<(String, String)>,
    #[serde(default)]
    cookie: Option<String>,
}

#[derive(serde::Serialize)]
struct BiliFetchResponse {
    status: u16,
    body: String,
}

/// Performs an HTTP GET/POST against Bilibili and returns status + raw body.
/// All parsing / normalizing happens on the TypeScript side (the Adapter).
#[tauri::command]
async fn fetch_bili(req: BiliFetchRequest) -> Result<BiliFetchResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
        .build()
        .map_err(|e| e.to_string())?;

    let mut builder = if req.method.eq_ignore_ascii_case("post") {
        client.post(&req.url).form(&req.params)
    } else {
        client.get(&req.url).query(&req.params)
    };

    builder = builder
        .header("Referer", "https://www.bilibili.com/")
        .header("Origin", "https://www.bilibili.com")
        .header("Accept", "application/json, text/plain, */*");

    if let Some(cookie) = req.cookie.as_ref() {
        if !cookie.trim().is_empty() {
            builder = builder.header("Cookie", cookie.trim());
        }
    }

    let resp = builder.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let body = resp.text().await.map_err(|e| e.to_string())?;
    Ok(BiliFetchResponse { status, body })
}

/// Close-button behavior: true = hide to tray (default), false = quit app.
struct CloseBehavior(Mutex<bool>);

#[tauri::command]
fn set_close_behavior(state: tauri::State<CloseBehavior>, to_tray: bool) {
    *state.0.lock().unwrap() = to_tray;
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
        let _ = w.emit("window-shown", ());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:biliupmonitor.db", crate::migrations::migrations())
                .build(),
        )
        .manage(CloseBehavior(Mutex::new(true)))
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "显示 Bili Monitor", true, None::<&str>)?;
            let refresh_i = MenuItem::with_id(app, "refresh", "立即刷新", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &refresh_i, &quit_i])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("missing window icon")?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Bili Monitor")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "refresh" => {
                        show_main_window(app);
                        let _ = app.emit("tray-refresh", ());
                    }
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
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.state::<CloseBehavior>();
                if *state.0.lock().unwrap() {
                    api.prevent_close();
                    let _ = window.hide();
                    let _ = window.emit("window-hidden", ());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![fetch_bili, set_close_behavior])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod migrations;
