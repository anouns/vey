use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Kill any existing process on port 8000 to avoid conflicts
fn kill_existing_backend() {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Find PID using port 8000
        if let Ok(output) = std::process::Command::new("cmd")
            .args(["/C", "netstat -ano | findstr :8000 | findstr LISTENING"])
            .creation_flags(0x08000000)
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if let Some(pid_str) = line.split_whitespace().last() {
                    if let Ok(pid) = pid_str.trim().parse::<u32>() {
                        if pid > 0 {
                            let _ = std::process::Command::new("taskkill")
                                .args(["/F", "/PID", &pid.to_string()])
                                .creation_flags(0x08000000)
                                .output();
                            log::info!("Killed old backend process PID: {}", pid);
                        }
                    }
                }
            }
        }
    }
}

/// Check if the backend is already running by actually hitting the health endpoint
fn is_backend_running() -> bool {
    match std::net::TcpStream::connect_timeout(
        &"127.0.0.1:8000".parse().unwrap(),
        Duration::from_millis(500),
    ) {
        Ok(_) => {
            // Also verify it responds to HTTP
            match ureq::get("http://127.0.0.1:8000/metrics")
                .timeout(Duration::from_secs(2))
                .call()
            {
                Ok(resp) => resp.status() == 200,
                Err(_) => true, // port is open, assume it's starting
            }
        }
        Err(_) => false,
    }
}

/// Wait for backend to become healthy with retries
fn wait_for_backend(max_seconds: u64) -> bool {
    let start = std::time::Instant::now();
    while start.elapsed() < Duration::from_secs(max_seconds) {
        if is_backend_running() {
            log::info!("Backend health check passed after {:?}", start.elapsed());
            return true;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    false
}

/// Collect all candidate paths for the compiled ai_service.exe
fn get_exe_candidates(exe_dir: &PathBuf, resource_dir: Option<&PathBuf>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    // 0. Tauri bundled resource path (highest priority in production)
    if let Some(res_dir) = resource_dir {
        candidates.push(res_dir.join("ai_service").join("ai_service.exe"));
        candidates.push(res_dir.join("ai_service.exe"));
    }

    // 1. Right next to the running executable (production install)
    candidates.push(exe_dir.join("ai_service").join("ai_service.exe"));
    candidates.push(exe_dir.join("ai_service.exe"));

    // 2. In a resources subfolder (Tauri bundled resources)
    candidates.push(exe_dir.join("resources").join("ai_service").join("ai_service.exe"));
    candidates.push(exe_dir.join("resources").join("ai_service.exe"));

    // 3. Up from exe for dev builds: target/debug/ or target/release/
    for up in 1..=4 {
        let mut base = exe_dir.clone();
        for _ in 0..up {
            base = base.join("..");
        }
        candidates.push(base.join("dist").join("ai_service").join("ai_service.exe"));
        candidates.push(base.join("ai_service").join("ai_service.exe"));
        candidates.push(
            base.join("resources")
                .join("ai_service")
                .join("ai_service.exe"),
        );
    }

    candidates
}

/// Collect all candidate paths for the Python ai_service.py
fn get_python_candidates(exe_dir: &PathBuf) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    for up in 1..=4 {
        let mut base = exe_dir.clone();
        for _ in 0..up {
            base = base.join("..");
        }
        candidates.push(base.join("scripts").join("ai_service.py"));
    }
    candidates.push(exe_dir.join("scripts").join("ai_service.py"));
    candidates.push(PathBuf::from("scripts").join("ai_service.py"));

    candidates
}

fn spawn_exe(path: &PathBuf) -> Result<std::process::Child, String> {
    let working_dir = path.parent().unwrap_or(path).to_path_buf();

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new(path)
            .current_dir(&working_dir)
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .spawn()
            .map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new(path)
            .current_dir(&working_dir)
            .spawn()
            .map_err(|e| e.to_string())
    }
}

fn spawn_python(script: &PathBuf) -> Result<std::process::Child, String> {
    let python_commands = if cfg!(windows) {
        vec!["python", "python3", "py"]
    } else {
        vec!["python3", "python"]
    };

    for py in &python_commands {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            if let Ok(child) = std::process::Command::new(py)
                .arg(script.to_str().unwrap_or(""))
                .creation_flags(0x08000000)
                .spawn()
            {
                return Ok(child);
            }
        }
        #[cfg(not(windows))]
        {
            if let Ok(child) = std::process::Command::new(py).arg(script).spawn() {
                return Ok(child);
            }
        }
    }
    Err("No Python interpreter found".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Track the backend child process for cleanup
    let backend_pid: Arc<Mutex<Option<u32>>> = Arc::new(Mutex::new(None));
    let backend_pid_setup = backend_pid.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .setup(move |app| {
            // Get the Tauri resource directory (works in production builds)
            let resource_dir = app.path().resource_dir().ok();
            let pid_holder = backend_pid_setup.clone();

            std::thread::spawn(move || {
                // If backend is already running, do nothing
                if is_backend_running() {
                    log::info!("AI backend already running on port 8000");
                    return;
                }

                // Kill any zombie/stale process on port 8000
                kill_existing_backend();
                std::thread::sleep(Duration::from_millis(500));

                let exe_dir = {
                    let mut p = std::env::current_exe().unwrap_or_default();
                    p.pop();
                    p
                };

                log::info!("Looking for AI backend from: {:?}", exe_dir);
                if let Some(ref rd) = resource_dir {
                    log::info!("Tauri resource dir: {:?}", rd);
                }

                // Try compiled EXE first (works on any machine without Python)
                for path in get_exe_candidates(&exe_dir, resource_dir.as_ref()) {
                    let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
                    if canonical.exists() {
                        log::info!("Found AI backend EXE: {:?}", canonical);
                        match spawn_exe(&canonical) {
                            Ok(child) => {
                                let pid = child.id();
                                log::info!("Started AI backend (PID {}): {:?}", pid, canonical);
                                *pid_holder.lock().unwrap() = Some(pid);

                                // Wait up to 30 seconds for backend to be healthy
                                if wait_for_backend(30) {
                                    log::info!("AI backend is healthy and ready");
                                } else {
                                    log::warn!("AI backend started but health check timed out");
                                }
                                return;
                            }
                            Err(e) => log::warn!("Failed to start {:?}: {}", canonical, e),
                        }
                    }
                }

                // Fallback: Python script (dev mode)
                for path in get_python_candidates(&exe_dir) {
                    let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
                    if canonical.exists() {
                        log::info!("Found AI backend Python script: {:?}", canonical);
                        match spawn_python(&canonical) {
                            Ok(child) => {
                                let pid = child.id();
                                log::info!(
                                    "Started AI backend Python (PID {}): {:?}",
                                    pid,
                                    canonical
                                );
                                *pid_holder.lock().unwrap() = Some(pid);

                                if wait_for_backend(30) {
                                    log::info!("AI backend (Python) is healthy and ready");
                                } else {
                                    log::warn!(
                                        "AI backend (Python) started but health check timed out"
                                    );
                                }
                                return;
                            }
                            Err(e) => log::warn!("Failed to start Python {:?}: {}", canonical, e),
                        }
                    }
                }

                log::warn!(
                    "AI backend not found anywhere. Searched from: {:?}",
                    exe_dir
                );
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(move |_app_handle, event| {
            // Cleanup backend process on app exit
            if let tauri::RunEvent::Exit = event {
                if let Some(pid) = *backend_pid.lock().unwrap() {
                    log::info!("Shutting down AI backend (PID {})", pid);
                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/PID", &pid.to_string()])
                            .creation_flags(0x08000000)
                            .output();
                    }
                    #[cfg(not(windows))]
                    {
                        unsafe {
                            libc::kill(pid as i32, libc::SIGTERM);
                        }
                    }
                }
            }
        });
}

// Re-export PathResolver trait for use in setup
use tauri::Manager;
