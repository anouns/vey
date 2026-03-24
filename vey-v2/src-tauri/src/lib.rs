#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build())
    .setup(|_app| {
      std::thread::spawn(|| {
          let mut exe_dir = std::env::current_exe().unwrap_or_default();
          exe_dir.pop(); // Remove executable name to get directory
          
          // Production: compiled AI backend EXE located next to the app
          let exe_paths = [
              exe_dir.join("ai_service").join("ai_service.exe"),
              exe_dir.join("ai_service.exe"),
              exe_dir.join("dist").join("ai_service").join("ai_service.exe"),
              // Dev paths
              exe_dir.join("..").join("..").join("dist").join("ai_service").join("ai_service.exe"),
              exe_dir.join("..").join("..").join("..").join("dist").join("ai_service").join("ai_service.exe"),
          ];
          
          // Development: Python script
          let py_paths = [
              exe_dir.join("..").join("..").join("scripts").join("ai_service.py"),
              exe_dir.join("..").join("..").join("..").join("scripts").join("ai_service.py"),
              exe_dir.join("scripts").join("ai_service.py"),
              std::path::PathBuf::from("scripts").join("ai_service.py"),
          ];
          
          // Try compiled exe first
          for path in exe_paths.iter() {
              let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
              if canonical.exists() {
                  #[cfg(windows)]
                  {
                      use std::os::windows::process::CommandExt;
                      match std::process::Command::new(&canonical)
                          .creation_flags(0x08000000) // CREATE_NO_WINDOW
                          .spawn() {
                          Ok(_) => {
                              log::info!("Started AI backend: {:?}", canonical);
                              return;
                          },
                          Err(e) => log::warn!("Failed to start {:?}: {}", canonical, e),
                      }
                  }
                  #[cfg(not(windows))]
                  {
                      match std::process::Command::new(&canonical).spawn() {
                          Ok(_) => {
                              log::info!("Started AI backend: {:?}", canonical);
                              return;
                          },
                          Err(e) => log::warn!("Failed to start {:?}: {}", canonical, e),
                      }
                  }
              }
          }
          
          // Fallback: Python script
          for path in py_paths.iter() {
              let canonical = path.canonicalize().unwrap_or_else(|_| path.clone());
              if canonical.exists() {
                  #[cfg(windows)]
                  {
                      use std::os::windows::process::CommandExt;
                      match std::process::Command::new("python")
                          .arg(canonical.to_str().unwrap_or(""))
                          .creation_flags(0x08000000) // CREATE_NO_WINDOW
                          .spawn() {
                          Ok(_) => {
                              log::info!("Started AI backend (Python): {:?}", canonical);
                              return;
                          },
                          Err(e) => log::warn!("Failed to start Python {:?}: {}", canonical, e),
                      }
                  }
                  #[cfg(not(windows))]
                  {
                      match std::process::Command::new("python3")
                          .arg(&canonical)
                          .spawn() {
                          Ok(_) => {
                              log::info!("Started AI backend (Python): {:?}", canonical);
                              return;
                          },
                          Err(e) => log::warn!("Failed to start Python {:?}: {}", canonical, e),
                      }
                  }
              }
          }
          
          log::warn!("AI backend not found. Searched from: {:?}", exe_dir);
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
