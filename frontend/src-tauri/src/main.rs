#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, OpenOptions},
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
#[cfg(unix)]
use std::os::unix::process::CommandExt;

#[cfg(unix)]
const SIGTERM: i32 = 15;

#[cfg(unix)]
unsafe extern "C" {
    fn setsid() -> i32;
    fn killpg(pgrp: i32, sig: i32) -> i32;
}

const APP_TITLE: &str = "kppost-ui";
const BACKEND_STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
const LOG_DIR_NAME: &str = "logs";
const NATIVE_LOG_FILE_NAME: &str = "native.log";
const BACKEND_LAUNCH_LOG_FILE_NAME: &str = "backend-launch.log";

#[derive(Default)]
struct BackendState {
    child: Mutex<Option<Child>>,
}

struct BackendLaunch {
    child: Child,
    url: String,
}

fn main() {
    if let Err(error) = run_app() {
        log_fallback_native_message(&format!("application startup failed: {error:#}"));
        panic!("error while building tauri application: {error:#}");
    }
}

fn run_app() -> Result<()> {
    let app = tauri::Builder::default()
        .setup(|app| {
            app.manage(BackendState::default());
            append_native_log(app.handle(), "setup started");

            let launch = match launch_backend(app.handle()) {
                Ok(launch) => launch,
                Err(error) => {
                    append_native_log(app.handle(), &format!("backend launch failed: {error:#}"));
                    return Err(error.into());
                }
            };
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

            append_native_log(app.handle(), "main window created");
            Ok(())
        })
        .build(tauri::generate_context!())
        .context("failed to build tauri application")?;

    app.run(|app, event| {
        match event {
            RunEvent::Exit | RunEvent::ExitRequested { .. } => {
                append_native_log(app, "exit requested");
                terminate_backend(app);
            }
            RunEvent::WindowEvent { label, event, .. } => {
                if label == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                    append_native_log(app, "main window destroyed");
                    terminate_backend(app);
                }
            }
            _ => {}
        }
    });

    Ok(())
}

fn launch_backend(app: &tauri::AppHandle) -> Result<BackendLaunch> {
    let backend_dir = find_resource_subdir(app, "backend")?;
    let python_root = find_resource_subdir(app, "python")?;
    let python_executable = resolve_python_executable(&python_root)?;
    let backend_entry = backend_dir.join("main.py");
    let backend_launch_log = open_log_file(app, BACKEND_LAUNCH_LOG_FILE_NAME)?;

    if !backend_entry.is_file() {
        bail!("Missing backend entrypoint at {}", backend_entry.display());
    }

    let host = "127.0.0.1";
    let port = pick_available_port()?;
    let url = format!("http://{host}:{port}");

    let mut command = Command::new(&python_executable);
    command
        .arg(&backend_entry)
        .current_dir(&backend_dir)
        .env("KPPPOST_UI_APP_MODE", "native")
        .env("KPPPOST_UI_HOST", host)
        .env("KPPPOST_UI_PORT", port.to_string())
        .env("PYTHON_EXECUTABLE", &python_executable)
        .env("PYTHONPATH", &backend_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::from(backend_launch_log.try_clone().context("failed to clone backend launch log")?))
        .stderr(Stdio::from(backend_launch_log));
    configure_backend_command(&mut command);
    let mut child = command
        .spawn()
        .with_context(|| format!("failed to launch backend with {}", python_executable.display()))?;

    append_native_log(
        app,
        &format!(
            "backend spawned with python={} entry={} host={} port={}",
            python_executable.display(),
            backend_entry.display(),
            host,
            port
        ),
    );

    if let Err(error) = wait_for_backend(host, port, &mut child) {
        append_native_log(app, &format!("backend health check failed: {error:#}"));
        let _ = child.kill();
        return Err(error);
    }

    append_native_log(app, &format!("backend healthy at {url}"));
    Ok(BackendLaunch { child, url })
}

fn terminate_backend(app: &tauri::AppHandle) {
    if let Some(state) = app.try_state::<BackendState>() {
        if let Ok(mut slot) = state.child.lock() {
            if let Some(child) = slot.as_mut() {
                terminate_backend_child(child);
                let _ = child.wait();
            }
            *slot = None;
        }
    }
}

fn configure_backend_command(command: &mut Command) {
    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if setsid() == -1 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }
}

fn terminate_backend_child(child: &mut Child) {
    #[cfg(unix)]
    {
        let pid = child.id() as i32;
        if pid > 0 {
            unsafe {
                let _ = killpg(pid, SIGTERM);
            }
        }
    }

    let _ = child.kill();
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

fn open_log_file(app: &tauri::AppHandle, file_name: &str) -> Result<std::fs::File> {
    let log_dir = native_log_dir(app)?;
    fs::create_dir_all(&log_dir).with_context(|| format!("failed to create log dir {}", log_dir.display()))?;
    let log_path = log_dir.join(file_name);
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .with_context(|| format!("failed to open log file {}", log_path.display()))
}

fn native_log_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
    Ok(app.path().app_data_dir().context("failed to resolve app data dir")?.join(LOG_DIR_NAME))
}

fn append_native_log(app: &tauri::AppHandle, message: &str) {
    if let Ok(mut file) = open_log_file(app, NATIVE_LOG_FILE_NAME) {
        let _ = writeln!(file, "{message}");
    }
}

fn log_fallback_native_message(message: &str) {
    let fallback_path = std::env::temp_dir().join("kppost-ui-native.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(fallback_path) {
        let _ = writeln!(file, "{message}");
    }
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
