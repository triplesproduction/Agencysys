use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::PathBuf;
use serde_json::json;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use chrono::Utc;
use tokio::time::{sleep, Duration};
use sha2::{Sha256, Digest};
use tauri::Manager;

mod db;
mod monitor;
mod sync;

lazy_static::lazy_static! {
    static ref MONITOR_ACTIVE: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

// Configurable constants for idle detection (Bug 1)
const IDLE_DISCARD_CUTOFF_SECONDS: f64 = 300.0; // 5 minutes before throwing away a segment
const ACTIVITY_IDLE_THRESHOLD_SECONDS: f64 = 60.0; // Fully active cutoff: idle time <= 60s is 100% activity

pub struct AppState {
    pub db_path: PathBuf,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct EmployeeInfo {
    pub id: String,
    pub email: String,
    pub name: String,
    pub designation: String,
    pub policy_id: Option<String>,
    pub screenshot_interval: i32,
    pub screenshot_quality: i32,
    pub is_clocked_in: bool,
    pub is_on_break: bool,
    // ISO 8601 timestamp of when the current session started (None if not clocked in)
    pub session_start_time: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct RecoveryState {
    pub has_unfinished_session: bool,
    pub session_id: Option<String>,
}

fn get_battery_status() -> String {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("sh")
            .args(&["-c", "pmset -g batt | grep -o '[0-9]\\+%' | head -n 1"])
            .output();
        if let Ok(out) = output {
            let res = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !res.is_empty() {
                return res;
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        #[repr(C)]
        struct SYSTEM_POWER_STATUS {
            ac_line_status: u8,
            battery_flag: u8,
            battery_life_percent: u8,
            reserved1: u8,
            battery_life_time: u32,
            battery_full_life_time: u32,
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GetSystemPowerStatus(lpSystemPowerStatus: *mut SYSTEM_POWER_STATUS) -> i32;
        }

        let mut status = SYSTEM_POWER_STATUS {
            ac_line_status: 255,
            battery_flag: 255,
            battery_life_percent: 255,
            reserved1: 0,
            battery_life_time: 0xffffffff,
            battery_full_life_time: 0xffffffff,
        };

        unsafe {
            if GetSystemPowerStatus(&mut status) != 0 && status.battery_life_percent <= 100 {
                return format!("{}%", status.battery_life_percent);
            }
        }
    }

    "100%".to_string()
}

fn get_device_info() -> (String, String) {
    let os = if cfg!(target_os = "macos") {
        "macOS"
    } else if cfg!(target_os = "windows") {
        "Windows"
    } else {
        "Linux"
    };

    let hostname = std::env::var("USER")
        .map(|u| format!("{}'s Device", u))
        .unwrap_or_else(|_| "Unknown Device".to_string());

    (os.to_string(), hostname)
}

fn generate_device_fingerprint(device_id: &str, os: &str, hostname: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(format!("{}-{}-{}", device_id, os, hostname).as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
async fn login(
    email: String,
    password: String,
    state: tauri::State<'_, AppState>,
) -> Result<EmployeeInfo, String> {
    let client = reqwest::Client::new();
    
    let api_base = sync::API_BASE_URL.to_string();
    
    // Route login through the Next.js backend API — never call Supabase directly from the binary
    let auth_url = format!("{}/api/auth/agent-login", api_base);
    let auth_res = client
        .post(&auth_url)
        .header("Content-Type", "application/json")
        .json(&json!({
            "email": email,
            "password": password
        }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !auth_res.status().is_success() {
        return Err("Invalid email or password".to_string());
    }

    let auth_data: serde_json::Value = auth_res
        .json()
        .await
        .map_err(|e| format!("Failed to parse login response: {}", e))?;

    let access_token = auth_data["access_token"]
        .as_str()
        .ok_or("No token in response")?;
    let refresh_token = auth_data["refresh_token"]
        .as_str()
        .unwrap_or("");
    let user_id = auth_data["user"]["id"]
        .as_str()
        .ok_or("No user id in response")?;

    // Profile is returned as part of the agent-login response — no second request needed
    let profiles: Vec<serde_json::Value> = if let Some(arr) = auth_data["profile"].as_array() {
        arr.clone()
    } else if auth_data["profile"].is_object() {
        vec![auth_data["profile"].clone()]
    } else {
        vec![]
    };

    if profiles.is_empty() {
        return Err("Employee record not found in database".to_string());
    }

    let profile = &profiles[0];
    let status = profile["status"].as_str().unwrap_or("ACTIVE");
    if status != "ACTIVE" {
        return Err("Your account is suspended. Login access is disabled.".to_string());
    }

    let first_name = profile["firstName"].as_str().unwrap_or("Employee");
    let last_name = profile["lastName"].as_str().unwrap_or("");
    let name = format!("{} {}", first_name, last_name).trim().to_string();
    let designation = profile["designation"].as_str().unwrap_or("Staff").to_string();
    
    let mut screenshot_interval = 6;
    let mut screenshot_quality = 80;
    let mut policy_id = None;

    if let Some(policy) = profile["monitoring_policies"].as_object() {
        policy_id = policy.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
        screenshot_interval = policy.get("screenshotInterval").and_then(|v| v.as_i64()).unwrap_or(6) as i32;
        screenshot_quality = policy.get("screenshotQuality").and_then(|v| v.as_i64()).unwrap_or(80) as i32;
    }

    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    db::set_setting(&conn, "employee_id", user_id).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "access_token", access_token).map_err(|e| e.to_string())?;
    if !refresh_token.is_empty() {
        db::set_setting(&conn, "refresh_token", refresh_token).map_err(|e| e.to_string())?;
    }
    db::set_setting(&conn, "email", &email).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "name", &name).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "designation", &designation).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "policy_id", &policy_id.clone().unwrap_or_default()).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "screenshot_interval", &screenshot_interval.to_string()).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "screenshot_quality", &screenshot_quality.to_string()).map_err(|e| e.to_string())?;

    Ok(EmployeeInfo {
        id: user_id.to_string(),
        email,
        name,
        designation,
        policy_id,
        screenshot_interval,
        screenshot_quality,
        is_clocked_in: false,
        is_on_break: false,
        session_start_time: None,
    })
}

#[tauri::command]
fn get_current_employee(state: tauri::State<'_, AppState>) -> Result<Option<EmployeeInfo>, String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = match db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())? {
        Some(id) => id,
        None => return Ok(None),
    };

    let email = db::get_setting(&conn, "email").map_err(|e| e.to_string())?.unwrap_or_default();
    let name = db::get_setting(&conn, "name").map_err(|e| e.to_string())?.unwrap_or_default();
    let designation = db::get_setting(&conn, "designation").map_err(|e| e.to_string())?.unwrap_or_default();
    let policy_id = db::get_setting(&conn, "policy_id").map_err(|e| e.to_string())?;
    let screenshot_interval = db::get_setting(&conn, "screenshot_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "6".to_string())
        .parse::<i32>()
        .unwrap_or(6);
    let screenshot_quality = db::get_setting(&conn, "screenshot_quality")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "80".to_string())
        .parse::<i32>()
        .unwrap_or(80);
    
    let is_clocked_in = db::get_setting(&conn, "is_clocked_in")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "false".to_string()) == "true";

    let is_on_break = db::get_setting(&conn, "is_on_break")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "false".to_string()) == "true";

    let session_start_time = db::get_setting(&conn, "session_start_time").map_err(|e| e.to_string())?;

    Ok(Some(EmployeeInfo {
        id: employee_id,
        email,
        name,
        designation,
        policy_id,
        screenshot_interval,
        screenshot_quality,
        is_clocked_in,
        is_on_break,
        session_start_time,
    }))
}

#[tauri::command]
fn check_session_recovery(state: tauri::State<'_, AppState>) -> Result<RecoveryState, String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let is_clocked_in = db::get_setting(&conn, "is_clocked_in")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "false".to_string()) == "true";

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?;

    Ok(RecoveryState {
        has_unfinished_session: is_clocked_in && session_id.is_some(),
        session_id,
    })
}

fn start_monitoring_threads(db_path: PathBuf, employee_id: String, session_id: String, device_id: String, screenshot_interval: i32, screenshot_quality: i32) {
    MONITOR_ACTIVE.store(true, Ordering::SeqCst);

    #[cfg(target_os = "macos")]
    {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> bool;
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        unsafe {
            if !CGPreflightScreenCaptureAccess() {
                println!("Requesting macOS Screen Recording permissions...");
                let _ = CGRequestScreenCaptureAccess();
            }
        }
    }

    tokio::spawn(async move {
        let mut last_screenshot_time = Utc::now();
        let mut last_activity_time = Utc::now();
        let mut current_focused_app = monitor::get_active_app().await;

        while MONITOR_ACTIVE.load(Ordering::SeqCst) {
            let is_on_break = {
                if let Ok(c) = rusqlite::Connection::open(&db_path) {
                    db::get_setting(&c, "is_on_break").unwrap_or(None).unwrap_or_else(|| "false".to_string()) == "true"
                } else {
                    false
                }
            };

            if is_on_break {
                // If on break, send heartbeat with PAUSED status, skip screenshots & app usage
                if let Ok(c) = rusqlite::Connection::open(&db_path) {
                    let heartbeat_payload = json!({
                        "employeeId": employee_id,
                        "status": "PAUSED",
                        "activityPercentage": 0,
                        "batteryStatus": get_battery_status(),
                        "networkStatus": "online"
                    });
                    let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "HEARTBEAT", heartbeat_payload);
                }
                sync::run_sync_worker(&db_path).await;
                sleep(Duration::from_secs(60)).await;
                continue;
            }

            let _timestamp = Utc::now().to_rfc3339();
            
            // Bug 2: Wrap synchronous shelling out in spawn_blocking
            let idle_secs = tokio::task::spawn_blocking(|| monitor::get_idle_time_seconds())
                .await
                .unwrap_or(0.0);

            // Auto clock out if the user has been idle for >= 15 minutes (900 seconds)
            // (e.g. system is asleep, modern standby S0 active, or user walked away)
            const AUTO_CLOCKOUT_IDLE_TIMEOUT_SECONDS: f64 = 900.0;
            if idle_secs >= AUTO_CLOCKOUT_IDLE_TIMEOUT_SECONDS {
                println!("User has been idle for {:.1} minutes. Auto clocking out...", idle_secs / 60.0);
                MONITOR_ACTIVE.store(false, Ordering::SeqCst);

                if let Ok(c) = rusqlite::Connection::open(&db_path) {
                    // Set clock out time to exactly when the user became inactive/idle
                    let actual_clock_out_time = Utc::now() - chrono::Duration::seconds(idle_secs as i64);
                    let clock_out_payload = json!({
                        "endTime": actual_clock_out_time.to_rfc3339()
                    });
                    let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "CLOCK_OUT", clock_out_payload);
                    let _ = db::set_setting(&c, "is_clocked_in", "false");
                    let _ = db::clear_setting(&c, "session_id");
                    let _ = db::clear_setting(&c, "is_on_break");
                    let _ = db::clear_setting(&c, "session_start_time");
                }

                sync::run_sync_worker(&db_path).await;
                break;
            }

            // TODO: Bug 1 - Add a signal for active meetings/calls.
            // If feasible without new dependencies, check for audio input/output activity
            // or an active screen-share/meeting app in the foreground (e.g. Zoom, Google Meet).
            // For now, this is stubbed out. Future implementation might require a new crate
            // (e.g., coreaudio on mac, coreaudio-sys, or cpal) or platform-specific APIs.
            // let is_in_meeting = check_meeting_status();
            // if is_in_meeting { idle_secs = 0.0; }

            let is_fully_idle = idle_secs >= IDLE_DISCARD_CUTOFF_SECONDS;
            let activity_pct = if is_fully_idle { 
                0 
            } else if idle_secs <= ACTIVITY_IDLE_THRESHOLD_SECONDS {
                100
            } else {
                let range = IDLE_DISCARD_CUTOFF_SECONDS - ACTIVITY_IDLE_THRESHOLD_SECONDS;
                let overage = idle_secs - ACTIVITY_IDLE_THRESHOLD_SECONDS;
                ((1.0 - (overage / range)) * 100.0).clamp(0.0, 100.0) as i32 
            };

            // 1. Focused Application Tracking
            // Note: get_active_app() uses TokioCommand with a 2s timeout. Since get_idle_time_seconds 
            // and screenshot capture are now properly offloaded via spawn_blocking, this 2s timeout 
            // will not block or stall the tokio worker thread or other tasks.
            let focused_app = monitor::get_active_app().await;
            let now_time = Utc::now();
            let elapsed_secs = now_time.signed_duration_since(last_activity_time).num_seconds() as i32;

            if is_fully_idle {
                // Discard application usage for this period since the user was idle for the whole duration
                last_activity_time = now_time;
                current_focused_app = focused_app;
            } else {
                if focused_app != current_focused_app {
                    // App switched — save the completed segment for the previous app
                    if elapsed_secs > 0 {
                        if let Ok(c) = rusqlite::Connection::open(&db_path) {
                            let app_payload = json!({
                                "employeeId": employee_id,
                                "appName": current_focused_app,
                                "startTime": last_activity_time.to_rfc3339(),
                                "endTime": now_time.to_rfc3339(),
                                "durationSeconds": elapsed_secs,
                                "activityPercentage": activity_pct
                            });
                            let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "APPLICATION_USAGE", app_payload);
                        }
                    }
                    current_focused_app = focused_app;
                    last_activity_time = now_time;
                } else {
                    // App has NOT switched — flush the current app every 60s tick so it
                    // always gets recorded even if the user never switches apps.
                    if elapsed_secs > 0 {
                        if let Ok(c) = rusqlite::Connection::open(&db_path) {
                            let app_payload = json!({
                                "employeeId": employee_id,
                                "appName": current_focused_app,
                                "startTime": last_activity_time.to_rfc3339(),
                                "endTime": now_time.to_rfc3339(),
                                "durationSeconds": elapsed_secs,
                                "activityPercentage": activity_pct
                            });
                            let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "APPLICATION_USAGE", app_payload);
                        }
                        // Reset timer for next 60s window
                        last_activity_time = now_time;
                    }
                }
            }

            // 2. Heartbeats (Every 60s)
            let battery = get_battery_status();
            let network = "online".to_string();

            if let Ok(c) = rusqlite::Connection::open(&db_path) {
                let heartbeat_payload = json!({
                    "employeeId": employee_id,
                    "status": if is_fully_idle { "IDLE" } else { "ACTIVE" },
                    "activityPercentage": activity_pct,
                    "batteryStatus": battery,
                    "networkStatus": network
                });
                let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "HEARTBEAT", heartbeat_payload);
            }

            // 3. Screenshots (Every configured interval)
            let screenshot_interval_secs = (screenshot_interval as i64) * 60;
            let secs_since_last_screenshot = now_time.signed_duration_since(last_screenshot_time).num_seconds();

            if screenshot_interval > 0 && secs_since_last_screenshot >= screenshot_interval_secs {
                last_screenshot_time = now_time;
                let sq = screenshot_quality as u8;
                let sc_result = tokio::task::spawn_blocking(move || {
                    monitor::capture_compressed_screenshot(sq)
                }).await;

                match sc_result {
                    Ok(Some(sc)) => {
                        if let Ok(c) = rusqlite::Connection::open(&db_path) {
                            let sc_payload = json!({
                                "employeeId": employee_id,
                                "activityPercentage": activity_pct,
                                "sha256Hash": sc.sha256_hash,
                                "imageBase64": sc.base64_image
                            });
                            let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "SCREENSHOT", sc_payload);
                            println!("Screenshot queued at {} ({}s since last)", now_time.to_rfc3339(), secs_since_last_screenshot);
                        }
                    }
                    Ok(None) => { eprintln!("Screenshot capture returned None (permissions issue or no screen)"); }
                    Err(e) => { eprintln!("Screenshot task failed to join: {}", e); }
                }
            }

            // Sync Worker run
            sync::run_sync_worker(&db_path).await;

            let sleep_start = Utc::now();
            sleep(Duration::from_secs(60)).await;

            let elapsed = Utc::now().signed_duration_since(sleep_start).num_seconds();
            if elapsed > 120 {
                println!("System sleep/suspension detected (elapsed: {}s). Auto clocking out...", elapsed);
                MONITOR_ACTIVE.store(false, Ordering::SeqCst);

                if let Ok(c) = rusqlite::Connection::open(&db_path) {
                    let clock_out_payload = json!({
                        "endTime": sleep_start.to_rfc3339()
                    });
                    let _ = db::queue_event(&c, &employee_id, &session_id, &device_id, "CLOCK_OUT", clock_out_payload);
                    let _ = db::set_setting(&c, "is_clocked_in", "false");
                    let _ = db::clear_setting(&c, "session_id");
                    let _ = db::clear_setting(&c, "is_on_break");
                    let _ = db::clear_setting(&c, "session_start_time");
                }

                sync::run_sync_worker(&db_path).await;
                break;
            }
        }
    });
}

#[tauri::command]
async fn clock_in(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let device_id = match db::get_setting(&conn, "device_id").map_err(|e| e.to_string())? {
        Some(id) => id,
        None => {
            let new_id = uuid::Uuid::new_v4().to_string();
            db::set_setting(&conn, "device_id", &new_id).map_err(|e| e.to_string())?;
            new_id
        }
    };

    let (os_name, host_name) = get_device_info();
    let fingerprint = generate_device_fingerprint(&device_id, &os_name, &host_name);

    let session_id = uuid::Uuid::new_v4().to_string();
    let start_time = Utc::now().to_rfc3339();

    // 1. Device status registration event
    let dev_payload = json!({
        "employeeId": employee_id,
        "deviceName": host_name,
        "operatingSystem": os_name,
        "deviceFingerprint": fingerprint
    });
    db::queue_event(&conn, &employee_id, &session_id, &device_id, "DEVICE_STATUS", dev_payload).map_err(|e| e.to_string())?;

    // 2. Clock-in event
    let clock_in_payload = json!({
        "employeeId": employee_id,
        "startTime": start_time
    });
    db::queue_event(&conn, &employee_id, &session_id, &device_id, "CLOCK_IN", clock_in_payload).map_err(|e| e.to_string())?;

    db::set_setting(&conn, "is_clocked_in", "true").map_err(|e| e.to_string())?;
    db::set_setting(&conn, "session_id", &session_id).map_err(|e| e.to_string())?;
    db::set_setting(&conn, "is_on_break", "false").map_err(|e| e.to_string())?;
    // Persist start time so the UI timer can restore correctly after restarts
    db::set_setting(&conn, "session_start_time", &start_time).map_err(|e| e.to_string())?;

    let screenshot_interval = db::get_setting(&conn, "screenshot_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "6".to_string())
        .parse::<i32>()
        .unwrap_or(6);

    let screenshot_quality = db::get_setting(&conn, "screenshot_quality")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "80".to_string())
        .parse::<i32>()
        .unwrap_or(80);

    start_monitoring_threads(state.db_path.clone(), employee_id, session_id, device_id, screenshot_interval, screenshot_quality);

    // Initial sync
    sync::run_sync_worker(&state.db_path).await;

    Ok(start_time)
}

#[tauri::command]
async fn resume_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No active session".to_string())?;

    let device_id = db::get_setting(&conn, "device_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No device registered".to_string())?;

    let screenshot_interval = db::get_setting(&conn, "screenshot_interval")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "6".to_string())
        .parse::<i32>()
        .unwrap_or(6);

    let screenshot_quality = db::get_setting(&conn, "screenshot_quality")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| "80".to_string())
        .parse::<i32>()
        .unwrap_or(80);

    db::set_setting(&conn, "is_on_break", "false").map_err(|e| e.to_string())?;
    start_monitoring_threads(state.db_path.clone(), employee_id, session_id, device_id, screenshot_interval, screenshot_quality);

    Ok(())
}

#[tauri::command]
async fn end_previous_session(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No active session".to_string())?;

    let device_id = db::get_setting(&conn, "device_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No device registered".to_string())?;

    let end_time = Utc::now().to_rfc3339();
    let clock_out_payload = json!({
        "endTime": end_time
    });

    db::queue_event(&conn, &employee_id, &session_id, &device_id, "CLOCK_OUT", clock_out_payload).map_err(|e| e.to_string())?;

    db::set_setting(&conn, "is_clocked_in", "false").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "session_id").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "is_on_break").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "session_start_time").map_err(|e| e.to_string())?;

    sync::run_sync_worker(&state.db_path).await;

    Ok(())
}

#[tauri::command]
async fn clock_out(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No active session".to_string())?;

    let device_id = db::get_setting(&conn, "device_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No device registered".to_string())?;

    MONITOR_ACTIVE.store(false, Ordering::SeqCst);

    let end_time = Utc::now().to_rfc3339();
    let clock_out_payload = json!({
        "endTime": end_time
    });

    db::queue_event(&conn, &employee_id, &session_id, &device_id, "CLOCK_OUT", clock_out_payload).map_err(|e| e.to_string())?;

    db::set_setting(&conn, "is_clocked_in", "false").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "session_id").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "is_on_break").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "session_start_time").map_err(|e| e.to_string())?;

    sync::run_sync_worker(&state.db_path).await;

    Ok(())
}

#[tauri::command]
fn logout(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    MONITOR_ACTIVE.store(false, Ordering::SeqCst);

    db::clear_setting(&conn, "employee_id").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "access_token").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "email").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "name").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "designation").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "policy_id").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "screenshot_interval").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "screenshot_quality").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "is_clocked_in").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "session_id").map_err(|e| e.to_string())?;
    db::clear_setting(&conn, "is_on_break").map_err(|e| e.to_string())?;

    Ok(())
}


#[tauri::command]
async fn take_break(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No active session".to_string())?;

    let device_id = db::get_setting(&conn, "device_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No device registered".to_string())?;

    db::set_setting(&conn, "is_on_break", "true").map_err(|e| e.to_string())?;

    let heartbeat_payload = json!({
        "employeeId": employee_id,
        "status": "PAUSED",
        "activityPercentage": 0,
        "batteryStatus": get_battery_status(),
        "networkStatus": "online"
    });
    db::queue_event(&conn, &employee_id, &session_id, &device_id, "HEARTBEAT", heartbeat_payload).map_err(|e| e.to_string())?;

    sync::run_sync_worker(&state.db_path).await;

    Ok(())
}

#[tauri::command]
async fn resume_from_break(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;

    let employee_id = db::get_setting(&conn, "employee_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "Not logged in".to_string())?;

    let session_id = db::get_setting(&conn, "session_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No active session".to_string())?;

    let device_id = db::get_setting(&conn, "device_id").map_err(|e| e.to_string())?
        .ok_or_else(|| "No device registered".to_string())?;

    db::set_setting(&conn, "is_on_break", "false").map_err(|e| e.to_string())?;

    let heartbeat_payload = json!({
        "employeeId": employee_id,
        "status": "ACTIVE",
        "activityPercentage": 100,
        "batteryStatus": get_battery_status(),
        "networkStatus": "online"
    });
    db::queue_event(&conn, &employee_id, &session_id, &device_id, "HEARTBEAT", heartbeat_payload).map_err(|e| e.to_string())?;

    sync::run_sync_worker(&state.db_path).await;

    Ok(())
}

#[tauri::command]
fn get_api_base_url(state: tauri::State<'_, AppState>) -> Result<String, String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;
    let url = db::get_setting(&conn, "api_base_url")
        .map_err(|e| e.to_string())?
        .unwrap_or_else(|| sync::API_BASE_URL.to_string());
    Ok(url)
}

#[tauri::command]
fn set_api_base_url(url: String, state: tauri::State<'_, AppState>) -> Result<(), String> {
    let conn = db::DbState { db_path: state.db_path.clone() }
        .get_connection()
        .map_err(|e| e.to_string())?;
    db::set_setting(&conn, "api_base_url", &url).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn relaunch_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
fn open_screen_recording_prefs() {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let db_path = db::init_db(&app.handle())?;
            app.manage(AppState { db_path: db_path.clone() });

            // Global background sync thread that runs every 5 minutes (300 seconds)
            let db_path_clone = db_path.clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(300)).await;
                    sync::run_sync_worker(&db_path_clone).await;
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            login,
            get_current_employee,
            check_session_recovery,
            resume_session,
            end_previous_session,
            clock_in,
            clock_out,
            logout,
            take_break,
            resume_from_break,
            relaunch_app,
            open_screen_recording_prefs,
            get_api_base_url,
            set_api_base_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
