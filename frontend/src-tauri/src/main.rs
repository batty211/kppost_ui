#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use anyhow::{anyhow, bail, Context, Result};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const APP_TITLE: &str = "kppost-ui";
const BACKEND_STARTUP_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<Child>>,
}

struct BackendLaunch {
    child: Child,
    url: String,
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(BackendState::default());

            let launch = launch_backend(app.handle())?;
            {
                let state = app.state::<BackendState>();
                let mut slot = state.child.lock().expect("backend state poisoned");
                *slot = Some(launch.child);
            }

            WebviewWindowBuilder::new(
                app,
                "main",
                WebviewUrl::External(launch.url.parse().context("invalid backend URL")?),
            )
            .title(APP_TITLE)
            .inner_size(1440.0, 960.0)
            .min_inner_size(1024.0, 720.0)
            .build()
            .context("failed to build main window")?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
                terminate_backend(app);
            }
        });
}

fn launch_backend(app: &tauri::AppHandle) -> Result<BackendLaunch> {
    let backend_dir = find_resource_subdir(app, "backend")?;
    let python_root = find_resource_subdir(app, "python")?;
    let python_executable = resolve_python_executable(&python_root)?;
    let backend_entry = backend_dir.join("main.py");

    if !backend_entry.is_file() {
        bail!("Missing backend entrypoint at {}", backend_entry.display());
    }

    let host = "127.0.0.1";
    let port = pick_available_port()?;
    let url = format!("http://{host}:{port}");

    let mut child = Command::new(&python_executable)
        .arg(&backend_entry)
        .current_dir(&backend_dir)
        .env("KPPPOST_UI_APP_MODE", "native")
        .env("KPPPOST_UI_HOST", host)
        .env("KPPPOST_UI_PORT", port.to_string())
        .env("PYTHON_EXECUTABLE", &python_executable)
        .env("PYTHONPATH", &backend_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .with_context(|| format!("failed to launch backend with {}", python_executable.display()))?;

    if let Err(error) = wait_for_backend(host, port, &mut child) {
        let _ = child.kill();
        return Err(error);
    }

    Ok(BackendLaunch { child, url })
}

fn terminate_backend(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<BackendState>() {
        if let Ok(mut slot) = state.child.lock() {
            if let Some(child) = slot.as_mut() {
                let _ = child.kill();
                let _ = child.wait();
            }
            *slot = None;
        }
    }
}

fn wait_for_backend(host: &str, port: u16, child: &mut Child) -> Result<()> {
    let deadline = Instant::now() + BACKEND_STARTUP_TIMEOUT;
    let address = format!("{host}:{port}");

    while Instant::now() < deadline {
        if let Some(status) = child.try_wait().context("failed to poll backend process")? {
            bail!("backend exited before health check completed: {status}");
        }

        if health_check(&address).is_ok() {
            return Ok(());
        }

        thread::sleep(Duration::from_millis(200));
    }

    Err(anyhow!("backend did not become healthy at http://{address}/health"))
}

fn health_check(address: &str) -> Result<()> {
    let mut stream = TcpStream::connect(address).with_context(|| format!("cannot connect to {address}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .context("failed to set backend health timeout")?;
    stream
        .write_all(
            format!("GET /health HTTP/1.1\r\nHost: {address}\r\nConnection: close\r\n\r\n").as_bytes(),
        )
        .context("failed to send backend health request")?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .context("failed to read backend health response")?;

    if response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200") {
        return Ok(());
    }

    bail!("unexpected health response: {response}")
}

fn pick_available_port() -> Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").context("failed to reserve backend port")?;
    let port = listener
        .local_addr()
        .context("failed to read reserved backend port")?
        .port();
    drop(listener);
    Ok(port)
}

fn find_resource_subdir(app: &tauri::AppHandle, relative_name: &str) -> Result<PathBuf> {
    for base_dir in resource_search_roots(app) {
        let candidate = base_dir.join(relative_name);
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    Err(anyhow!(
        "Missing staged resource directory '{relative_name}'. Run the native staging step before building the app."
    ))
}

fn resource_search_roots(app: &tauri::AppHandle) -> Vec<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.clone());
        candidates.push(resource_dir.join(".native-build").join("stage"));
        candidates.push(resource_dir.join("_up_").join("_up_"));
        candidates.push(
            resource_dir
                .join("_up_")
                .join("_up_")
                .join(".native-build")
                .join("stage"),
        );
    }

    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.native-build/stage"));
    candidates
}

fn resolve_python_executable(python_root: &Path) -> Result<PathBuf> {
    let runtime_slug = current_runtime_slug();
    let runtime_dir = python_root.join(runtime_slug);

    for candidate in python_executable_candidates(&runtime_dir)? {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(anyhow!(
        "No bundled Python executable was found for runtime '{}' under {}",
        runtime_slug,
        python_root.display(),
    ))
}

fn python_executable_candidates(runtime_dir: &Path) -> Result<Vec<PathBuf>> {
    if cfg!(target_os = "windows") {
        return Ok(vec![
            runtime_dir.join("python.exe"),
            runtime_dir.join("bin").join("python.exe"),
        ]);
    }

    let bin_dir = runtime_dir.join("bin");
    let mut candidates = vec![bin_dir.join("python3"), bin_dir.join("python")];

    if let Ok(entries) = std::fs::read_dir(&bin_dir) {
        let mut versioned = entries
            .filter_map(|entry| entry.ok().map(|item| item.path()))
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| {
                        (name.starts_with("python3.") || name.starts_with("python."))
                            && !name.ends_with("-config")
                    })
            })
            .collect::<Vec<_>>();
        versioned.sort();
        candidates.extend(versioned);
    }

    Ok(candidates)
}

fn current_runtime_slug() -> &'static str {
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    {
        return "macos-arm64";
    }

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    {
        return "macos-x64";
    }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        return "windows-x64";
    }

    #[allow(unreachable_code)]
    "unsupported"
}

#[cfg(test)]
mod tests {
    use super::python_executable_candidates;
    use std::{
        fs,
        path::Path,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn unique_temp_dir(label: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("kppost-ui-{label}-{nanos}"))
    }

    #[test]
    fn versioned_python_binary_is_considered() {
        if cfg!(target_os = "windows") {
            return;
        }

        let runtime_dir = unique_temp_dir("python-runtime");
        let bin_dir = runtime_dir.join("bin");
        fs::create_dir_all(&bin_dir).expect("create bin dir");
        fs::write(bin_dir.join("python3.12"), "").expect("create python3.12");
        fs::write(bin_dir.join("python3.12-config"), "").expect("create config helper");

        let candidates = python_executable_candidates(Path::new(&runtime_dir)).expect("resolve candidates");

        assert!(candidates.contains(&bin_dir.join("python3.12")));
        assert!(!candidates.contains(&bin_dir.join("python3.12-config")));

        fs::remove_dir_all(runtime_dir).expect("cleanup temp dir");
    }
}
