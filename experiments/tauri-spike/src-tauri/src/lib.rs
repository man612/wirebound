use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProbe {
    runtime: &'static str,
    mode: &'static str,
    process_id: u32,
}

#[tauri::command]
fn runtime_probe() -> RuntimeProbe {
    RuntimeProbe {
        runtime: "tauri",
        mode: "ui-only-safe-demo",
        process_id: std::process::id(),
    }
}

#[tauri::command]
fn show_after_renderer_ready(window: tauri::WebviewWindow) -> Result<bool, String> {
    window.show().map_err(|error| error.to_string())?;
    window.is_visible().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_action(window: tauri::WebviewWindow, action: String) -> Result<(), String> {
    let result = match action.as_str() {
        "minimize" => window.minimize(),
        "maximize" => {
            if window.is_maximized().map_err(|error| error.to_string())? {
                window.unmaximize()
            } else {
                window.maximize()
            }
        }
        "close" => window.close(),
        _ => return Err("Unsupported window action".to_string()),
    };
    result.map_err(|error| error.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![runtime_probe, window_action, show_after_renderer_ready])
        .run(tauri::generate_context!())
        .expect("Tauri spike runtime error");
}
