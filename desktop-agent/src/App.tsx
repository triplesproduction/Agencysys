import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { getVersion } from "@tauri-apps/api/app";
import "./App.css";

interface EmployeeInfo {
  id: string;
  email: string;
  name: string;
  designation: string;
  policy_id: string | null;
  screenshot_interval: number;
  screenshot_quality: number;
  is_clocked_in: boolean;
  is_on_break: boolean;
  // ISO timestamp of when the current session started (null if not clocked in)
  session_start_time: string | null;
}

interface RecoveryState {
  has_unfinished_session: boolean;
  session_id: string | null;
}

function App() {
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  
  // Recovery popup state
  const [recoveryState, setRecoveryState] = useState<RecoveryState | null>(null);

  // Update status state
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState("1.0.0");

  // Fetch Tauri app version dynamically
  useEffect(() => {
    async function fetchVersion() {
      try {
        const ver = await getVersion();
        setAppVersion(ver);
      } catch (err) {
        console.error("Failed to get app version:", err);
      }
    }
    fetchVersion();
  }, []);

  // Check for updates on startup
  useEffect(() => {
    async function checkUpdates() {
      try {
        console.log("Checking for updates...");
        const update = await check();
        if (update) {
          console.log(`Update available: ${update.version}`);
          setUpdateStatus(`Downloading update v${update.version}...`);
          let downloaded = 0;
          let contentLength = 0;
          
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case 'Started':
                contentLength = event.data.contentLength || 0;
                setUpdateStatus("Downloading update: 0%");
                break;
              case 'Progress':
                downloaded += event.data.chunkLength;
                const pct = contentLength ? Math.round((downloaded / contentLength) * 100) : 0;
                setUpdateStatus(`Downloading update: ${pct}%`);
                break;
              case 'Finished':
                setUpdateStatus("Installing update...");
                break;
            }
          });
          
          setUpdateStatus("Update complete. Restarting...");
          setTimeout(async () => {
            await invoke("relaunch_app");
          }, 1500);
        } else {
          console.log("No updates found.");
        }
      } catch (err) {
        console.error("Update check failed:", err);
        setUpdateStatus(null);
      }
    }
    checkUpdates();
  }, []);
  
  // Clock-in timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [clockedIn, setClockedIn] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);

  // Timer Effect: auto-starts when clocked in and not on break, pauses when on break
  useEffect(() => {
    let interval: number | null = null;
    if (clockedIn && !isOnBreak) {
      interval = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [clockedIn, isOnBreak]);

  // Re-sync Timer Effect (Bug 4): Periodically fetch the authoritative start time 
  // from the backend to prevent the displayed timer from drifting.
  useEffect(() => {
    let syncInterval: number | null = null;
    if (clockedIn) {
      syncInterval = window.setInterval(async () => {
        try {
          const emp = await invoke<EmployeeInfo | null>("get_current_employee");
          if (emp && emp.is_clocked_in && emp.session_start_time) {
            const startMs = new Date(emp.session_start_time).getTime();
            const nowMs = Date.now();
            const diffSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            setElapsedSeconds(diffSeconds);
          }
        } catch (err) {
          console.error("Timer re-sync failed:", err);
        }
      }, 30000); // Re-sync every 30 seconds
    }
    return () => {
      if (syncInterval) window.clearInterval(syncInterval);
    };
  }, [clockedIn]);

  // Check login and recovery on load
  useEffect(() => {
    async function initApp() {

      try {
        const emp = await invoke<EmployeeInfo | null>("get_current_employee");
        if (emp) {
          setEmployee(emp);
          setIsOnBreak(emp.is_on_break);
          
          // Check for unfinished sessions
          const rec = await invoke<RecoveryState>("check_session_recovery");
          if (rec.has_unfinished_session) {
            setRecoveryState(rec);
          } else {
            setClockedIn(emp.is_clocked_in);
          }

          // Restore elapsed timer from the actual session start time stored in SQLite.
          // This fixes the bug where the timer resets to 0:00 every time the app restarts.
          if (emp.is_clocked_in && emp.session_start_time) {
            const startMs = new Date(emp.session_start_time).getTime();
            const nowMs = Date.now();
            const diffSeconds = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            setElapsedSeconds(diffSeconds);
          }
        }
      } catch (err) {
        console.error("App init failed:", err);
      }
    }
    initApp();
  }, []);

  // Verify auth session integrity periodically (e.g. if sync worker clears it due to expired/invalid tokens)
  useEffect(() => {
    let verifyInterval: number | null = null;
    if (employee) {
      verifyInterval = window.setInterval(async () => {
        try {
          const emp = await invoke<EmployeeInfo | null>("get_current_employee");
          if (!emp) {
            console.warn("Auth session invalidated backend-side. Logging out...");
            setEmployee(null);
            setClockedIn(false);
            setIsOnBreak(false);
            setElapsedSeconds(0);
            setRecoveryState(null);
          } else {
            setEmployee(emp);
            setClockedIn(emp.is_clocked_in);
            setIsOnBreak(emp.is_on_break);
            if (!emp.is_clocked_in) {
              setElapsedSeconds(0);
            }
          }
        } catch (err) {
          console.error("Session verification failed:", err);
        }
      }, 10000); // Check every 10 seconds
    }
    return () => {
      if (verifyInterval) window.clearInterval(verifyInterval);
    };
  }, [employee]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const emp = await invoke<EmployeeInfo>("login", { email, password });
      setEmployee(emp);
      setIsOnBreak(emp.is_on_break);
      
      const rec = await invoke<RecoveryState>("check_session_recovery");
      if (rec.has_unfinished_session) {
        setRecoveryState(rec);
      } else {
        setClockedIn(emp.is_clocked_in);
      }
    } catch (err: any) {
      setError(err || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeSession = async () => {
    setLoading(true);
    try {
      await invoke("resume_session");
      setClockedIn(true);
      setIsOnBreak(false);
      setRecoveryState(null);
    } catch (err: any) {
      setError(err || "Failed to resume session.");
    } finally {
      setLoading(false);
    }
  };

  const handleEndPreviousSession = async () => {
    setLoading(true);
    try {
      await invoke("end_previous_session");
      setClockedIn(false);
      setIsOnBreak(false);
      setElapsedSeconds(0);
      setRecoveryState(null);
    } catch (err: any) {
      setError(err || "Failed to end previous session.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("clock_in");
      setClockedIn(true);
      setIsOnBreak(false);
    } catch (err: any) {
      setError(err || "Failed to clock in.");
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("clock_out");
      setClockedIn(false);
      setIsOnBreak(false);
      setElapsedSeconds(0);
    } catch (err: any) {
      setError(err || "Failed to clock out.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await invoke("logout");
      setEmployee(null);
      setClockedIn(false);
      setIsOnBreak(false);
      setElapsedSeconds(0);
      setEmail("");
      setPassword("");
      setRecoveryState(null);
    } catch (err: any) {
      setError(err || "Failed to log out.");
    } finally {
      setLoading(false);
    }
  };

  const handleTakeBreak = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("take_break");
      setIsOnBreak(true);
    } catch (err: any) {
      setError(err || "Failed to take break.");
    } finally {
      setLoading(false);
    }
  };

  const handleResumeWork = async () => {
    setError("");
    setLoading(true);
    try {
      await invoke("resume_from_break");
      setIsOnBreak(false);
    } catch (err: any) {
      setError(err || "Failed to resume work.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  // Login view
  if (!employee) {
    return (
      <div className="agent-container">
        {updateStatus && (
          <div className="update-overlay">
            <div className="update-card">
              <div className="update-spinner" />
              <div className="update-message">{updateStatus}</div>
            </div>
          </div>
        )}
        <div className="agent-card">
          <div className="brand-header">
            <img src="/logo.png" alt="TripleS Logo" className="brand-logo" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
              <div className="brand-title">
                TripleS <span className="brand-purple">OS</span>
              </div>
              <div className="brand-tag">Desktop Agent</div>
            </div>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-title">Authentication</div>
            
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="your@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Authenticating..." : "Sign In"}
            </button>

            {error && <div className="error-banner">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  // Session Recovery modal view
  if (recoveryState) {
    return (
      <div className="agent-container">
        {updateStatus && (
          <div className="update-overlay">
            <div className="update-card">
              <div className="update-spinner" />
              <div className="update-message">{updateStatus}</div>
            </div>
          </div>
        )}
        <div className="agent-card">
          <div className="brand-header">
            <img src="/logo.png" alt="TripleS Logo" className="brand-logo" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left" }}>
              <div className="brand-title">
                TripleS <span className="brand-purple">OS</span>
              </div>
              <div className="brand-tag">Session Recovery</div>
            </div>
          </div>
          <div style={{ padding: "10px 0", textAlign: "center", marginBottom: "20px" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: "1.4" }}>
              An unfinished work session was detected. This could be due to a recent power failure, crash, or unexpected reboot.
            </p>
          </div>
          <div className="controls-group">
            <button className="control-btn clock-in" onClick={handleResumeSession} disabled={loading}>
              Resume Session
            </button>
            <button className="control-btn clock-out" onClick={handleEndPreviousSession} disabled={loading}>
              End Previous Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="agent-container">
      {updateStatus && (
        <div className="update-overlay">
          <div className="update-card">
            <div className="update-spinner" />
            <div className="update-message">{updateStatus}</div>
          </div>
        </div>
      )}
      <div className="agent-card">
        {/* Absolute-positioned Logout Button in the top right */}
        <button className="logout-icon-btn" onClick={handleLogout} title="Sign Out" disabled={loading}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>

        <div className="brand-header dashboard-header-centered">
          <img src="/logo.png" alt="TripleS Logo" className="brand-logo-medium" />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div className="brand-title-medium">
              TripleS <span className="brand-purple">OS</span>
            </div>
            <div className="brand-tag-medium">Desktop Agent</div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">
            {employee.name.split(" ").map(n => n[0]).join("").toUpperCase()}
          </div>
          <div className="profile-details">
            <div className="profile-name">{employee.name}</div>
            <div className="profile-title">{employee.designation}</div>
          </div>
        </div>

        <div className="session-panel">
          <div className="timer-label">Current Work Session</div>
          <div className="timer-value">{formatTime(elapsedSeconds)}</div>
          
          <div className={`status-badge ${clockedIn ? (isOnBreak ? "on-break" : "active") : "stopped"}`}>
            <span className="status-dot" />
            {!clockedIn ? "Session Offline" : (isOnBreak ? "On Break" : "Monitoring Active")}
          </div>
          
          {clockedIn && window.navigator.userAgent.includes("Mac") && (
            <button 
              onClick={() => invoke("open_screen_recording_prefs")}
              style={{
                background: "rgba(139, 92, 246, 0.15)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                color: "#B493FF",
                padding: "6px 12px",
                borderRadius: "8px",
                fontSize: "0.75rem",
                cursor: "pointer",
                marginTop: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Fix Screen Recording Permissions
            </button>
          )}
        </div>

        <div className="controls-group">
          {clockedIn ? (
            <>
              {isOnBreak ? (
                <button className="control-btn resume-work" onClick={handleResumeWork} disabled={loading}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Resume Work
                </button>
              ) : (
                <button className="control-btn take-break" onClick={handleTakeBreak} disabled={loading}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Take a Break
                </button>
              )}
              <button className="control-btn clock-out" onClick={handleClockOut} disabled={loading}>
                Clock Out
              </button>
            </>
          ) : (
            <button className="control-btn clock-in" onClick={handleClockIn} disabled={loading}>
              Clock In
            </button>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="footer-info">
          <div>Version: {appVersion}</div>
          <div className="footer-sync-status">
            <span style={{ 
              width: "6px", 
              height: "6px", 
              borderRadius: "50%", 
              background: clockedIn ? (isOnBreak ? "#fbbf24" : "#27ae60") : "rgba(255,255,255,0.2)" 
            }} />
            {clockedIn ? (isOnBreak ? "On Break" : "Syncing...") : "Ready"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
