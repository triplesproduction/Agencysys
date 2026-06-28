use rusqlite::{params, Connection};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use sha2::{Sha256, Digest};

pub struct DbState {
    pub db_path: PathBuf,
}

impl DbState {
    pub fn get_connection(&self) -> Result<Connection, rusqlite::Error> {
        Connection::open(&self.db_path)
    }
}

pub fn init_db(app: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_dir = app.path().app_local_data_dir()?;
    fs::create_dir_all(&app_dir)?;
    let db_path = app_dir.join("agent_cache.db");

    let conn = Connection::open(&db_path)?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
         )",
        [],
    )?;

    // Create Upgraded Offline Events Queue table with sequence numbers
    conn.execute(
        "CREATE TABLE IF NOT EXISTS offline_events_queue (
            sequence_number INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT NOT NULL UNIQUE,
            employee_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            retry_count INTEGER DEFAULT 0,
            sync_status TEXT DEFAULT 'pending',
            checksum TEXT NOT NULL
         )",
        [],
    )?;

    Ok(db_path)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        let val: String = row.get(0)?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

pub fn clear_setting(conn: &Connection, key: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

pub fn queue_event(
    conn: &Connection,
    employee_id: &str,
    session_id: &str,
    device_id: &str,
    event_type: &str,
    payload: serde_json::Value,
) -> Result<(), rusqlite::Error> {
    let id = uuid::Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let payload_str = payload.to_string();

    // Compute checksum
    let mut hasher = Sha256::new();
    hasher.update(payload_str.as_bytes());
    let checksum = format!("{:x}", hasher.finalize());

    conn.execute(
        "INSERT INTO offline_events_queue (id, employee_id, session_id, device_id, event_type, payload, timestamp, retry_count, sync_status, checksum)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'pending', ?8)",
        params![id, employee_id, session_id, device_id, event_type, payload_str, timestamp, checksum],
    )?;
    Ok(())
}
