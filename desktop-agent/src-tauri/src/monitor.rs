use tokio::process::Command as TokioCommand;
use std::process::Command as StdCommand;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use screenshots::Screen;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use image::DynamicImage;
use std::io::Cursor;
use sha2::{Sha256, Digest};

pub struct CompressedScreenshot {
    pub base64_image: String,
    pub sha256_hash: String,
}

/// Get the active application name with a strict timeout to prevent thread deadlocks.
pub async fn get_active_app() -> String {
    #[cfg(target_os = "macos")]
    {
        let script = r#"
            try
                with timeout of 1 second
                    tell application "System Events"
                        set frontApp to name of first application process whose frontmost is true
                    end tell
                    
                    if frontApp is "Google Chrome" then
                        tell application "Google Chrome"
                            set currentUrl to URL of active tab of front window
                            return frontApp & " - " & currentUrl
                        end tell
                    else if frontApp is "Safari" then
                        tell application "Safari"
                            set currentUrl to URL of document 1
                            return frontApp & " - " & currentUrl
                        end tell
                    else if frontApp is "Brave Browser" then
                        tell application "Brave Browser"
                            set currentUrl to URL of active tab of front window
                            return frontApp & " - " & currentUrl
                        end tell
                    else if frontApp is "Microsoft Edge" then
                        tell application "Microsoft Edge"
                            set currentUrl to URL of active tab of front window
                            return frontApp & " - " & currentUrl
                        end tell
                    else
                        return frontApp
                    end if
                end timeout
            on error
                try
                    tell application "System Events"
                        return name of first application process whose frontmost is true
                    end tell
                on error
                    return "System"
                end try
            end try
        "#;
        let mut cmd = TokioCommand::new("osascript");
        let future = cmd
            .args(&["-e", script])
            .kill_on_drop(true)
            .output();
            
        match tokio::time::timeout(std::time::Duration::from_secs(2), future).await {
            Ok(Ok(out)) => {
                let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if name.is_empty() || name == "System" {
                    get_frontmost_app_name_native().unwrap_or_else(|| "System".to_string())
                } else {
                    name
                }
            }
            _ => get_frontmost_app_name_native().unwrap_or_else(|| "System".to_string()),
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = TokioCommand::new("powershell");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let future = cmd
            .args(&[
                "-Command",
                "$code = '[DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);'; Add-Type -MemberDefinition $code -Name 'Win32' -Namespace 'API'; $hwnd = [API.Win32]::GetForegroundWindow(); $pid = 0; [API.Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid); if ($pid -gt 0) { (Get-Process -Id $pid).Name } else { 'System' }"
            ])
            .kill_on_drop(true)
            .output();

        match tokio::time::timeout(std::time::Duration::from_secs(2), future).await {
            Ok(Ok(out)) => {
                let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if name.is_empty() {
                    "System".to_string()
                } else {
                    name
                }
            }
            _ => "System".to_string(),
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        "System".to_string()
    }
}

/// Get the idle time in seconds.
pub fn get_idle_time_seconds() -> f64 {
    #[cfg(target_os = "macos")]
    {
        let output = StdCommand::new("sh")
            .args(&["-c", "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print $NF/1000000000; exit}'"])
            .output();

        match output {
            Ok(out) => {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                s.parse::<f64>().unwrap_or(0.0)
            }
            Err(_) => 0.0,
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = StdCommand::new("powershell");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        let output = cmd
            .args(&[
                "-Command",
                "$code = '[StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; } [DllImport(\"user32.dll\")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii); [DllImport(\"kernel32.dll\")] public static extern uint GetTickCount();'; Add-Type -MemberDefinition $code -Name 'Win32' -Namespace 'API'; $lii = New-Object API.Win32+LASTINPUTINFO; $lii.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lii); if ([API.Win32]::GetLastInputInfo([ref]$lii)) { ($lii.dwTime) } else { 0 }"
            ])
            .output();

        match output {
            Ok(out) => {
                let last_input_ticks_str = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if let Ok(last_input_ticks) = last_input_ticks_str.parse::<u64>() {
                    let mut cmd_uptime = StdCommand::new("powershell");
                    cmd_uptime.creation_flags(0x08000000); // CREATE_NO_WINDOW
                    let uptime_output = cmd_uptime
                        .args(&["-Command", "[API.Win32]::GetTickCount()"])
                        .output();
                    if let Ok(uo) = uptime_output {
                        let cur_ticks_str = String::from_utf8_lossy(&uo.stdout).trim().to_string();
                        if let Ok(cur_ticks) = cur_ticks_str.parse::<u64>() {
                            if cur_ticks >= last_input_ticks {
                                return (cur_ticks - last_input_ticks) as f64 / 1000.0;
                            }
                        }
                    }
                }
                0.0
            }
            Err(_) => 0.0,
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        0.0
    }
}

/// Capture screenshot, compress to JPEG with configurable quality, and generate SHA256 hash.
pub fn capture_compressed_screenshot(quality: u8) -> Option<CompressedScreenshot> {
    let screens = Screen::all().ok()?;
    let screen = screens.first()?;
    let image = screen.capture().ok()?;

    // Convert ImageBuffer to DynamicImage
    let dyn_image = DynamicImage::ImageRgba8(image);

    // Compress to JPEG
    let mut jpeg_bytes = Vec::new();
    {
        let mut cursor = Cursor::new(&mut jpeg_bytes);
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
        encoder.encode_image(&dyn_image).ok()?;
    }

    // Generate SHA256 Hash
    let mut hasher = Sha256::new();
    hasher.update(&jpeg_bytes);
    let hash_hex = format!("{:x}", hasher.finalize());

    let base64_image = STANDARD.encode(jpeg_bytes);

    Some(CompressedScreenshot {
        base64_image,
        sha256_hash: hash_hex,
    })
}

#[cfg(target_os = "macos")]
fn get_frontmost_app_name_native() -> Option<String> {
    use std::ffi::{c_void, CStr};
    use std::os::raw::c_char;

    type Sel = *const c_void;
    type Class = *const c_void;
    type Id = *mut c_void;

    #[link(name = "objc")]
    #[link(name = "AppKit", kind = "framework")]
    extern "C" {
        fn sel_registerName(name: *const c_char) -> Sel;
        fn objc_getClass(name: *const c_char) -> Class;
        fn objc_msgSend(obj: Id, sel: Sel) -> Id;
    }

    unsafe {
        let cls_nsworkspace = objc_getClass(b"NSWorkspace\0".as_ptr() as *const c_char);
        if cls_nsworkspace.is_null() {
            return None;
        }
        
        let sel_sharedworkspace = sel_registerName(b"sharedWorkspace\0".as_ptr() as *const c_char);
        let workspace: Id = objc_msgSend(cls_nsworkspace as Id, sel_sharedworkspace);
        if workspace.is_null() {
            return None;
        }
        
        let sel_frontmostapplication = sel_registerName(b"frontmostApplication\0".as_ptr() as *const c_char);
        let app: Id = objc_msgSend(workspace, sel_frontmostapplication);
        if app.is_null() {
            return None;
        }
        
        let sel_localizedname = sel_registerName(b"localizedName\0".as_ptr() as *const c_char);
        let name_str: Id = objc_msgSend(app, sel_localizedname);
        if name_str.is_null() {
            return None;
        }
        
        let sel_utf8string = sel_registerName(b"UTF8String\0".as_ptr() as *const c_char);
        let utf8_ptr: *const c_char = objc_msgSend(name_str, sel_utf8string) as *const c_char;
        if utf8_ptr.is_null() {
            return None;
        }
        
        let c_str = CStr::from_ptr(utf8_ptr);
        Some(c_str.to_string_lossy().into_owned())
    }
}
