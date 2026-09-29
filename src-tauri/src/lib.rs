use serde::Deserialize;
use std::time::Duration;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:biliupmonitor.db", crate::migrations::migrations())
                .build(),
        )
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![fetch_bili])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod migrations;
