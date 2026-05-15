from __future__ import annotations

import argparse
import subprocess
from ftplib import FTP
from pathlib import Path


RUNTIME_CONFIG = """window.__LICITAAI_CONFIG__ = {
  apiBaseUrl: "https://licitaja-production.up.railway.app/api",
};
"""


def run_command(command: list[str], cwd: Path) -> None:
    completed = subprocess.run(command, cwd=cwd, check=False)
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)


def get_git_config(repo_root: Path, key: str) -> str:
    result = subprocess.run(
        ["git", "config", "--get", key],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    value = result.stdout.strip()
    if result.returncode != 0 or not value:
        raise RuntimeError(f"Configuracao ausente no git local: {key}")
    return value


def ensure_remote_dir(ftp: FTP, remote_dir: str) -> None:
    try:
        ftp.mkd(remote_dir)
    except Exception:
        pass


def upload_file(ftp: FTP, local_path: Path, remote_path: str) -> None:
    with local_path.open("rb") as handle:
        ftp.storbinary(f"STOR {remote_path}", handle)


def list_remote_files(ftp: FTP, remote_dir: str) -> list[str]:
    try:
        return ftp.nlst(remote_dir)
    except Exception:
        return []


def deploy_frontend(repo_root: Path, skip_build: bool) -> None:
    frontend_dir = repo_root / "frontend"
    dist_dir = frontend_dir / "dist"

    if not skip_build:
        run_command(["npm.cmd", "run", "build"], frontend_dir)

    (dist_dir / "config.js").write_text(RUNTIME_CONFIG, encoding="utf-8")

    host = get_git_config(repo_root, "licitai.hostingerServer")
    username = get_git_config(repo_root, "licitai.hostingerUsername")
    password = get_git_config(repo_root, "licitai.hostingerPassword")
    remote_root = get_git_config(repo_root, "licitai.hostingerRemoteRoot")

    ftp = FTP(host, username, password, timeout=30)
    ftp.encoding = "utf-8"

    ensure_remote_dir(ftp, f"{remote_root}/assets")

    upload_file(ftp, dist_dir / ".htaccess", f"{remote_root}/.htaccess")
    upload_file(ftp, dist_dir / "config.js", f"{remote_root}/config.js")
    upload_file(ftp, dist_dir / "index.html", f"{remote_root}/index.html")

    built_assets = [asset for asset in (dist_dir / "assets").iterdir() if asset.is_file()]
    current_js_asset = next((asset for asset in built_assets if asset.suffix == ".js"), None)
    current_css_asset = next((asset for asset in built_assets if asset.suffix == ".css"), None)

    remote_assets = list_remote_files(ftp, f"{remote_root}/assets")
    for remote_asset in remote_assets:
        remote_name = Path(remote_asset).name
        if current_js_asset is not None and remote_name.startswith("index-") and remote_name.endswith(".js"):
            upload_file(ftp, current_js_asset, f"{remote_root}/assets/{remote_name}")
        elif current_css_asset is not None and remote_name.startswith("index-") and remote_name.endswith(".css"):
            upload_file(ftp, current_css_asset, f"{remote_root}/assets/{remote_name}")

    for asset in built_assets:
        upload_file(ftp, asset, f"{remote_root}/assets/{asset.name}")

    ftp.quit()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy frontend build to Hostinger.")
    parser.add_argument("--repo-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    deploy_frontend(args.repo_root.resolve(), skip_build=args.skip_build)


if __name__ == "__main__":
    main()
