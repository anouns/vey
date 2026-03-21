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
          exe_dir.pop(); // Remove executable name, get directory
          
          let possible_paths = [
              exe_dir.join("scripts/ai_service.py"),
              exe_dir.join("_up_/_up_/scripts/ai_service.py"),
              exe_dir.join("_up_/scripts/ai_service.py"),
              exe_dir.join("../scripts/ai_service.py"),
              exe_dir.join("../../scripts/ai_service.py"),
              std::path::PathBuf::from("../scripts/ai_service.py"),
              std::path::PathBuf::from("scripts/ai_service.py"),
          ];
          
          for path in possible_paths.iter() {
              if path.exists() {
                  #[cfg(windows)]
                  {
                      use std::os::windows::process::CommandExt;
                      let mut success = false;
                      if std::process::Command::new("pythonw")
                          .arg(path.to_str().unwrap())
                          .creation_flags(0x08000000)
                          .spawn().is_ok() {
                          success = true;
                      } else if std::process::Command::new("python")
                          .arg(path.to_str().unwrap())
                          .creation_flags(0x08000000)
                          .spawn().is_ok() {
                          success = true;
                      }
                      if success { break; }
                  }
                  
                  #[cfg(not(windows))]
                  {
                      let _ = std::process::Command::new("python3")
                          .arg(path)
                          .spawn();
                  }
                  break;
              }
          }
      });
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
