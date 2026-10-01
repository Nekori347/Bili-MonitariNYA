use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
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
    /// Set by the login flow: return the raw `Set-Cookie` headers.
    #[serde(default)]
    want_cookies: bool,
}

#[derive(serde::Serialize)]
struct BiliFetchResponse {
    status: u16,
    body: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    cookies: Vec<String>,
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
    // Only the login flow asks for these; they carry the session cookie.
    let cookies = if req.want_cookies {
        resp.headers()
            .get_all(reqwest::header::SET_COOKIE)
            .iter()
            .filter_map(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .collect()
    } else {
        Vec::new()
    };
    let body = resp.text().await.map_err(|e| e.to_string())?;
    Ok(BiliFetchResponse { status, body, cookies })
}

/// Follow a login redirect chain by hand so every `Set-Cookie` hop is captured.
///
/// After a successful QR poll Bilibili hands out a `crossDomain?ticket=...` URL
/// instead of putting the session cookies on the poll response; the cookies are
/// only issued while following that redirect. reqwest drops intermediate headers
/// when it follows redirects itself, so we disable auto-redirect and walk the
/// chain, accumulating cookies. Cookie values are returned to the caller and
/// never logged.
#[tauri::command]
async fn login_follow(url: String, cookie: Option<String>) -> Result<BiliFetchResponse, String> {
    const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                      (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent(UA)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let mut cookies: Vec<String> = Vec::new();
    let mut current = url;
    let mut status = 0u16;

    for _ in 0..10 {
        let mut req = client
            .get(&current)
            .header("Referer", "https://www.bilibili.com/")
            .header("Origin", "https://www.bilibili.com")
            .header("Accept", "application/json, text/plain, */*");
        if let Some(c) = cookie.as_ref() {
            if !c.trim().is_empty() {
                req = req.header("Cookie", c.trim());
            }
        }

        let resp = req.send().await.map_err(|e| e.to_string())?;

        status = resp.status().as_u16();
        for v in resp.headers().get_all(reqwest::header::SET_COOKIE).iter() {
            if let Ok(s) = v.to_str() {
                cookies.push(s.to_string());
            }
        }

        let location = resp
            .headers()
            .get(reqwest::header::LOCATION)
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        match location {
            Some(loc) if resp.status().is_redirection() => {
                current = if loc.starts_with("http") {
                    loc
                } else if let Ok(base) = reqwest::Url::parse(&current) {
                    base.join(&loc).map(|u| u.to_string()).unwrap_or(loc)
                } else {
                    loc
                };
            }
            _ => break,
        }
    }

    Ok(BiliFetchResponse {
        status,
        body: String::new(),
        cookies,
    })
}

/// Close-button behavior: true = hide to tray (default), false = quit app.
struct CloseBehavior(Mutex<bool>);

/* ------------------------------------------------------------------ *
 * Partial click-through (鼠标穿透)
 *
 * The window keeps its titlebar interactive while the main content passes
 * mouse input through to whatever is behind it. A whole-window
 * `set_ignore_cursor_events(true)` would NOT work: the titlebar would stop
 * receiving clicks too, and the same button could never switch the mode off.
 *
 * Instead a small watcher thread polls the global cursor position and flips
 * the window's input transparency depending on whether the cursor is inside
 * the titlebar band. Any measurement failure resolves to "interactive", so the
 * worst case is that pass-through simply does not engage — never a window the
 * user cannot click.
 * ------------------------------------------------------------------ */

/// Height of the always-interactive strip at the top, in CSS pixels.
const TITLEBAR_BAND_CSS: f64 = 44.0;

struct ClickThrough {
    enabled: AtomicBool,
    /// Last value actually pushed to the window.
    applied: AtomicBool,
    band_css: Mutex<f64>,
}

impl ClickThrough {
    fn new() -> Self {
        Self {
            enabled: AtomicBool::new(false),
            applied: AtomicBool::new(false),
            band_css: Mutex::new(TITLEBAR_BAND_CSS),
        }
    }
    fn band(&self) -> f64 {
        *self.band_css.lock().unwrap()
    }
    fn set_band(&self, v: f64) {
        if v.is_finite() && v > 0.0 {
            *self.band_css.lock().unwrap() = v;
        }
    }
}

#[cfg(windows)]
fn cursor_screen_pos() -> Option<(i32, i32)> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
    unsafe {
        let mut pt = POINT::default();
        GetCursorPos(&mut pt).ok()?;
        Some((pt.x, pt.y))
    }
}

#[cfg(not(windows))]
fn cursor_screen_pos() -> Option<(i32, i32)> {
    None
}

/// `Some(true)` = cursor is over the titlebar band, `Some(false)` = it is over
/// the content, `None` = the position could not be determined.
fn cursor_over_titlebar(win: &tauri::WebviewWindow, band_css: f64) -> Option<bool> {
    let pos = win.outer_position().ok()?;
    let size = win.outer_size().ok()?;
    let scale = win.scale_factor().ok()?;
    let (cx, cy) = cursor_screen_pos()?;
    let band = (band_css * scale).round() as i32;
    let rel_x = cx - pos.x;
    let rel_y = cy - pos.y;
    if rel_x < 0 || rel_y < 0 || rel_x >= size.width as i32 || rel_y >= size.height as i32 {
        return Some(false); // outside the window: content rules apply
    }
    Some(rel_y < band)
}

/// Watch the cursor while pass-through is on and keep the window's input
/// transparency in sync. Runs for the life of the app; the check is a no-op
/// (and costs one atomic load) whenever the mode is off.
fn spawn_clickthrough_watch(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(40));
        let Some(win) = app.get_webview_window("main") else {
            continue;
        };
        let state = app.state::<ClickThrough>();

        if !state.enabled.load(Ordering::Relaxed) {
            if state.applied.swap(false, Ordering::Relaxed) {
                let _ = win.set_ignore_cursor_events(false);
            }
            continue;
        }

        let interactive = cursor_over_titlebar(&win, state.band()).unwrap_or(true);
        let should_ignore = !interactive;
        if should_ignore != state.applied.load(Ordering::Relaxed)
            && win.set_ignore_cursor_events(should_ignore).is_ok()
        {
            state.applied.store(should_ignore, Ordering::Relaxed);
        }
    });
}

/// Turn partial click-through on or off. `band` is the titlebar height in CSS
/// pixels; the frontend sends the real measured height of its titlebar.
#[tauri::command]
fn set_click_through(
    state: tauri::State<ClickThrough>,
    enabled: bool,
    band: f64,
) -> Result<(), String> {
    state.set_band(band);
    state.enabled.store(enabled, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn set_close_behavior(state: tauri::State<CloseBehavior>, to_tray: bool) {
    *state.0.lock().unwrap() = to_tray;
}

/// Remove a user's cached asset directory (called after a subscription is deleted).
#[tauri::command]
fn clear_user_cache(app: tauri::AppHandle, mid: String) -> Result<(), String> {
    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let user_dir = cache_dir.join("users").join(&mid);
    if user_dir.exists() {
        std::fs::remove_dir_all(&user_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Download a remote asset (banner/avatar/pendant/...) into the app cache dir.
/// Returns the local file path. Reuses existing files when the URL is unchanged.
#[tauri::command]
async fn download_asset(app: tauri::AppHandle, url: String, key: String) -> Result<String, String> {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    url.hash(&mut h);
    let url_hash = h.finish();

    let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    // key is like "users/{mid}/banner" -> files land in cache/users/{mid}/.
    let assets_dir = cache_dir.join(&key);
    std::fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    // Reuse existing file for this key if present (same key = same asset slot).
    if let Ok(entries) = std::fs::read_dir(&assets_dir) {
        for e in entries.flatten() {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with(&format!("{}", url_hash)) {
                return Ok(e.path().to_string_lossy().to_string());
            }
        }
    }

    let ext = url
        .rsplit('/')
        .next()
        .unwrap_or("img")
        .split('?')
        .next()
        .unwrap_or("img")
        .split('.')
        .last()
        .unwrap_or("png");
    let ext = if ext.len() > 4 { "png" } else { ext };
    let file_path = assets_dir.join(format!("{}.{}", url_hash, ext));

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get(&url)
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Verify the response is a real image. Without this an error page would be
    // written to disk and cached as the asset.
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    // Atomic replace: write to tmp, verify, then rename over the old file.
    // A failed download never destroys an existing good cache file.
    if bytes.is_empty() {
        return Err("empty response".to_string());
    }
    let tmp_path = file_path.with_extension(format!("{}tmp", ext));
    std::fs::write(&tmp_path, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp_path, &file_path).map_err(|e| e.to_string())?;
    Ok(file_path.to_string_lossy().to_string())
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:biliupmonitor.db", crate::migrations::migrations())
                .build(),
        )
        .manage(CloseBehavior(Mutex::new(true)))
        .manage(ClickThrough::new())
        .setup(|app| {
            spawn_clickthrough_watch(app.handle().clone());
            let show_i = MenuItem::with_id(app, "show", "显示 Bili 监视姬", true, None::<&str>)?;
            let refresh_i = MenuItem::with_id(app, "refresh", "立即刷新", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &refresh_i, &quit_i])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .ok_or("missing window icon")?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .tooltip("Bili-MonitariNYA")
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
        .invoke_handler(tauri::generate_handler![
            fetch_bili,
            login_follow,
            set_close_behavior,
            download_asset,
            clear_user_cache,
            set_click_through,
            secret::save_credential,
            secret::load_credential,
            secret::delete_credential
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod migrations;
mod secret;
