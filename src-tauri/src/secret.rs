//! Local secret storage for the Bilibili login cookie.
//!
//! The cookie is encrypted with Windows DPAPI (CryptProtectData) so only the
//! current Windows user account can decrypt it, and it is written to the app
//! data directory as an opaque blob. It never leaves this machine and is never
//! written to logs.

use std::ffi::c_void;
use std::path::PathBuf;

#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}

#[cfg(windows)]
#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        p_data_in: *const DataBlob,
        sz_data_descr: *const u16,
        p_optional_entropy: *const DataBlob,
        pv_reserved: *const c_void,
        p_prompt_struct: *const c_void,
        dw_flags: u32,
        p_data_out: *mut DataBlob,
    ) -> i32;

    fn CryptUnprotectData(
        p_data_in: *const DataBlob,
        ppsz_data_descr: *mut *mut u16,
        p_optional_entropy: *const DataBlob,
        pv_reserved: *const c_void,
        p_prompt_struct: *const c_void,
        dw_flags: u32,
        p_data_out: *mut DataBlob,
    ) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
}

#[cfg(windows)]
fn protect(plain: &[u8]) -> Result<Vec<u8>, String> {
    unsafe {
        let input = DataBlob {
            cb_data: plain.len() as u32,
            pb_data: plain.as_ptr() as *mut u8,
        };
        let mut output = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut output,
        );
        if ok == 0 || output.pb_data.is_null() {
            return Err("无法加密登录凭据 (DPAPI)".to_string());
        }
        let out = std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec();
        LocalFree(output.pb_data as *mut c_void);
        Ok(out)
    }
}

#[cfg(windows)]
fn unprotect(blob: &[u8]) -> Result<Vec<u8>, String> {
    unsafe {
        let input = DataBlob {
            cb_data: blob.len() as u32,
            pb_data: blob.as_ptr() as *mut u8,
        };
        let mut output = DataBlob {
            cb_data: 0,
            pb_data: std::ptr::null_mut(),
        };
        let ok = CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            0,
            &mut output,
        );
        if ok == 0 || output.pb_data.is_null() {
            return Err("无法解密登录凭据 (DPAPI)".to_string());
        }
        let out = std::slice::from_raw_parts(output.pb_data, output.cb_data as usize).to_vec();
        LocalFree(output.pb_data as *mut c_void);
        Ok(out)
    }
}

#[cfg(not(windows))]
fn protect(_plain: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台不支持安全凭据存储".to_string())
}

#[cfg(not(windows))]
fn unprotect(_blob: &[u8]) -> Result<Vec<u8>, String> {
    Err("当前平台不支持安全凭据存储".to_string())
}

fn secret_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("credentials.bin"))
}

#[tauri::command]
pub fn save_credential(app: tauri::AppHandle, secret: String) -> Result<(), String> {
    let path = secret_path(&app)?;
    let blob = protect(secret.as_bytes())?;
    std::fs::write(&path, blob).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_credential(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = secret_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let blob = std::fs::read(&path).map_err(|e| e.to_string())?;
    if blob.is_empty() {
        return Ok(None);
    }
    let plain = unprotect(&blob).map_err(|_| "凭据已失效，请重新登录".to_string())?;
    Ok(Some(String::from_utf8_lossy(&plain).to_string()))
}

#[tauri::command]
pub fn delete_credential(app: tauri::AppHandle) -> Result<(), String> {
    let path = secret_path(&app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
