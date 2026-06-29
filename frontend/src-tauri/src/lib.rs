use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

struct BackendProcess(Mutex<Option<Child>>);

fn start_backend() -> Option<Child> {
    let cargo_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let backend_dir = cargo_dir.parent()?.parent()?.join("backend");
    Command::new("python")
        .args(["-m", "uvicorn", "app.main:app", "--port", "8000"])
        .current_dir(&backend_dir)
        .spawn()
        .ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let backend = start_backend();
            app.manage(BackendProcess(Mutex::new(backend)));

            let show_item = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let mut tray = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon().cloned() {
                tray = tray.icon(icon);
            }
            tray.tooltip("Warframe Nexus")
                .on_menu_event(|app, event| match event.id.0.as_str() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(state) = window.try_state::<BackendProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(ref mut child) = *guard {
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running Warframe Nexus");
}
