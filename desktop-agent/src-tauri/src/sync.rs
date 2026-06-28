use reqwest::Client;
use serde_json::{json, Value};
use std::path::Path;
use rusqlite::params;

// Backend API base — all requests go through the Next.js server, never directly to Supabase.
// This prevents the Supabase project URL and anon key from being embedded in the binary.
// Change this to your production domain when deploying.
pub const API_BASE_URL: &str = env!("TRIPLES_API_BASE_URL");

struct QueuedEvent {
    id: String,
    event_type: String,
    payload: serde_json::Value,
    timestamp: String,
    checksum: String,
}

fn get_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    crate::db::get_setting(conn, key).unwrap_or(None)
}

fn fetch_pending_events(db_path: &Path) -> Result<Vec<QueuedEvent>, rusqlite::Error> {
    let conn = rusqlite::Connection::open(db_path)?;
    let mut stmt = conn.prepare(
        "SELECT id, event_type, payload, timestamp, checksum, sequence_number FROM offline_events_queue 
         WHERE sync_status != 'synced' 
         ORDER BY sequence_number ASC 
         LIMIT 50"
    )?;

    let mut rows = stmt.query([])?;
    let mut events = Vec::new();

    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let event_type: String = row.get(1)?;
        let payload_str: String = row.get(2)?;
        let timestamp: String = row.get(3)?;
        let checksum: String = row.get(4)?;

        if let Ok(payload) = serde_json::from_str(&payload_str) {
            events.push(QueuedEvent {
                id,
                event_type,
                payload,
                timestamp,
                checksum,
            });
        }
    }
    Ok(events)
}

fn process_sync_success(conn: &rusqlite::Connection, res_json_res: Result<Value, reqwest::Error>) {
    if let Ok(res_json) = res_json_res {
        if let Some(synced_ids) = res_json["syncedIds"].as_array() {
            let mut count = 0;
            for val in synced_ids {
                if let Some(id_str) = val.as_str() {
                    let _ = conn.execute(
                        "DELETE FROM offline_events_queue WHERE id = ?1",
                        params![id_str]
                    );
                    count += 1;
                }
            }
            println!("Sync Worker: Successfully synced {} events.", count);
        }

        if let Some(commands) = res_json["commands"].as_array() {
            for cmd in commands {
                let cmd_id = cmd["id"].as_str().unwrap_or_default();
                let command_type = cmd["command"].as_str().unwrap_or_default();
                println!("Executing Remote Command: [id: {}, type: {}]", cmd_id, command_type);
            }
        }
    } else if let Err(e) = res_json_res {
        eprintln!("Sync Worker: Failed to parse success response: {}", e);
    }
}

fn mark_batch_failed(conn: &rusqlite::Connection, event_ids: &[String], is_bad_request: bool) {
    for id_str in event_ids {
        let _ = conn.execute(
            "UPDATE offline_events_queue SET retry_count = retry_count + 1, sync_status = 'failed' WHERE id = ?1",
            params![id_str]
        );
    }
    
    if is_bad_request {
        let _ = conn.execute(
            "DELETE FROM offline_events_queue WHERE retry_count >= 5",
            []
        );
    }
}

/// Sync queued events in batches and strictly by Sequence Number order.
pub async fn run_sync_worker(db_path: &Path) {
    let (token, device_id, session_id, refresh_token) = {
        let conn = match rusqlite::Connection::open(db_path) {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Sync Worker: Failed to open database: {}", e);
                return;
            }
        };
        let t = match get_setting(&conn, "access_token") { 
            Some(t) => t, 
            None => { eprintln!("Sync Worker skipped: access_token not found in settings"); return } 
        };
        let d = match get_setting(&conn, "device_id") { 
            Some(d) => d, 
            None => { eprintln!("Sync Worker skipped: device_id not found in settings"); return } 
        };
        let s = match get_setting(&conn, "session_id") { 
            Some(s) => s, 
            None => { eprintln!("Sync Worker skipped: session_id not found in settings"); return } 
        };
        let r = get_setting(&conn, "refresh_token").unwrap_or_default();
        (t, d, s, r)
    };

    let events = match fetch_pending_events(db_path) {
        Ok(e) => e,
        Err(e) => {
            eprintln!("Sync Worker: Failed to fetch pending events: {}", e);
            return;
        }
    };

    if events.is_empty() {
        return;
    }

    let mut events_list = Vec::new();
    let mut event_ids_in_batch = Vec::new();
    for ev in &events {
        events_list.push(json!({
            "id": ev.id,
            "eventType": ev.event_type,
            "payload": ev.payload,
            "timestamp": ev.timestamp,
            "checksum": ev.checksum
        }));
        event_ids_in_batch.push(ev.id.clone());
    }

    let client = Client::new();
    let url = format!("{}/api/desktop-agent/sync", API_BASE_URL);

    let batch_body = json!({
        "agentVersion": "1.0.0",
        "deviceId": device_id,
        "sessionId": session_id,
        "events": events_list
    });

    let res = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", "application/json")
        .json(&batch_body)
        .send()
        .await;

    if let Ok(conn) = rusqlite::Connection::open(db_path) {
        match res {
            Ok(response) => {
                if response.status().is_success() {
                    let res_json_res = response.json::<Value>().await;
                    process_sync_success(&conn, res_json_res);
                } else if response.status() == reqwest::StatusCode::UNAUTHORIZED && !refresh_token.is_empty() {
                    // Token expired: Attempt to refresh token
                    let refresh_url = format!("{}/api/auth/agent-refresh", API_BASE_URL);
                    let refresh_res = client.post(&refresh_url)
                        .header("Content-Type", "application/json")
                        .json(&json!({ "refresh_token": refresh_token }))
                        .send()
                        .await;

                    let mut refresh_successful = false;
                    if let Ok(r_resp) = refresh_res {
                        if r_resp.status().is_success() {
                            if let Ok(r_json) = r_resp.json::<Value>().await {
                                if let (Some(new_access), Some(new_refresh)) = (r_json["access_token"].as_str(), r_json["refresh_token"].as_str()) {
                                    refresh_successful = true;
                                    // Save new tokens
                                    let _ = conn.execute("UPDATE settings SET value = ?1 WHERE key = 'access_token'", params![new_access]);
                                    let _ = conn.execute("UPDATE settings SET value = ?1 WHERE key = 'refresh_token'", params![new_refresh]);
                                    
                                    // Retry sync immediately with new token
                                    let retry_res = client.post(&url)
                                        .header("Authorization", format!("Bearer {}", new_access))
                                        .header("Content-Type", "application/json")
                                        .json(&batch_body)
                                        .send()
                                        .await;
                                    
                                    match retry_res {
                                        Ok(retry_resp) => {
                                            if retry_resp.status().is_success() {
                                                let retry_json_res = retry_resp.json::<Value>().await;
                                                process_sync_success(&conn, retry_json_res);
                                            } else {
                                                eprintln!("Sync Worker: Retry sync failed with status {}", retry_resp.status());
                                                mark_batch_failed(&conn, &event_ids_in_batch, retry_resp.status() == reqwest::StatusCode::BAD_REQUEST);
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("Sync Worker: Retry sync network error: {}", e);
                                            mark_batch_failed(&conn, &event_ids_in_batch, false);
                                        }
                                    }
                                }
                            }
                        } else {
                            eprintln!("Sync Worker: Token refresh failed with status {}", r_resp.status());
                        }
                    } else if let Err(e) = refresh_res {
                        eprintln!("Sync Worker: Token refresh network error: {}", e);
                    }

                    if !refresh_successful {
                        mark_batch_failed(&conn, &event_ids_in_batch, false);
                    }
                } else {
                    eprintln!("Sync Worker: Initial sync failed with status {}", response.status());
                    mark_batch_failed(&conn, &event_ids_in_batch, response.status() == reqwest::StatusCode::BAD_REQUEST);
                }
            }
            Err(e) => {
                eprintln!("Sync Worker: Network error during initial sync: {}", e);
                mark_batch_failed(&conn, &event_ids_in_batch, false);
            }
        }
    }
}
