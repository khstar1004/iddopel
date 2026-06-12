import asyncio
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path


USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,30}$")
DEFAULT_PRIORITY_SITES = [
    "Instagram",
    "Twitter",
    "Threads",
    "TikTok",
    "YouTube",
    "Facebook",
    "LinkedIn",
    "Naver",
    "GitHub",
    "GitHubGist",
    "Reddit",
]


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        expected_token = os.environ.get("MAIGRET_API_SECRET")
        if expected_token:
            actual_token = self.headers.get("x-maigret-api-secret")
            if actual_token != expected_token:
                self.respond_json(401, {"error": {"code": "UNAUTHORIZED", "message": "Unauthorized."}})
                return

        try:
            length = int(self.headers.get("content-length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            username = str(body.get("username", "")).strip()
            mode = str(body.get("mode", "QUICK")).upper()

            if not USERNAME_RE.match(username):
                self.respond_json(422, {"error": {"code": "VALIDATION_ERROR", "message": "Invalid username."}})
                return

            result = run_maigret(username, mode)
            self.respond_json(200, result)
        except subprocess.TimeoutExpired:
            self.respond_json(504, {"error": {"code": "MAIGRET_TIMEOUT", "message": "Maigret timed out."}})
        except Exception as error:
            self.respond_json(500, {"error": {"code": "MAIGRET_FAILED", "message": str(error)}})

    def do_GET(self):
        self.respond_json(200, {"ok": True, "runtime": "python", "scanner": "maigret"})

    def respond_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("cache-control", "no-store")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_maigret(username, mode):
    if os.environ.get("MAIGRET_EXECUTION_MODE") == "subprocess":
        return run_maigret_subprocess(username, mode)

    return run_maigret_in_process(username, mode)


def run_maigret_in_process(username, mode):
    top_sites = resolve_top_sites(mode)
    site_timeout = positive_int(os.environ.get("MAIGRET_SITE_TIMEOUT_SECONDS"), 6)
    max_connections = positive_int(os.environ.get("MAIGRET_MAX_CONNECTIONS"), 10)
    retries = positive_int(os.environ.get("MAIGRET_RETRIES"), 1)
    parsing_enabled = os.environ.get("MAIGRET_EXTRACT_EXTENDED") != "false"
    proxy_url = clean_env(os.environ.get("MAIGRET_PROXY_URL"))

    with tempfile.TemporaryDirectory(prefix="id-doppelganger-maigret-") as temp_dir:
        from maigret.checking import maigret as check_username
        from maigret.db_updater import BUNDLED_DB_PATH
        from maigret.report import generate_report_context, save_html_report, save_json_report, sort_report_by_data_points
        from maigret.sites import MaigretDatabase

        os.environ.setdefault("HOME", tempfile.gettempdir())
        os.environ.setdefault("XDG_CACHE_HOME", tempfile.gettempdir())
        logger = logging.getLogger("id-doppelganger-maigret")
        logger.addHandler(logging.NullHandler())
        db = MaigretDatabase().load_from_path(BUNDLED_DB_PATH)
        site_data = resolve_site_data(db, top_sites)
        results = run_async(
            check_username(
                username=username,
                site_dict=dict(site_data),
                logger=logger,
                proxy=proxy_url,
                timeout=site_timeout,
                is_parsing_enabled=parsing_enabled,
                id_type="username",
                max_connections=max_connections,
                no_progressbar=True,
                retries=retries,
            )
        )
        results = sort_report_by_data_points(results)
        safe_username = username.replace("/", "_")
        report_json_path = str(Path(temp_dir) / f"report_{safe_username}_simple.json")
        html_report_path = str(Path(temp_dir) / f"report_{safe_username}_plain.html")
        save_json_report(report_json_path, safe_username, results, report_type="simple")
        save_html_report(html_report_path, generate_report_context([(safe_username, "username", results)]))

        report_json = Path(report_json_path).read_text(encoding="utf-8")
        html_report = Path(html_report_path).read_text(encoding="utf-8")

        return {
            "ok": True,
            "username": username,
            "checkedCount": len(site_data),
            "failedRate": 0,
            "reportJson": report_json,
            "htmlReport": {
                "html": html_report,
                "htmlFilename": Path(html_report_path).name,
            },
        }


def run_maigret_subprocess(username, mode):
    top_sites = resolve_top_sites(mode)
    site_timeout = positive_int(os.environ.get("MAIGRET_SITE_TIMEOUT_SECONDS"), 6)
    process_timeout_ms = positive_int(os.environ.get("MAIGRET_PROCESS_TIMEOUT_MS"), 55000)
    max_connections = positive_int(os.environ.get("MAIGRET_MAX_CONNECTIONS"), 10)
    retries = positive_int(os.environ.get("MAIGRET_RETRIES"), 1)

    with tempfile.TemporaryDirectory(prefix="id-doppelganger-maigret-") as temp_dir:
        runtime_env = os.environ.copy()
        runtime_env.setdefault("HOME", tempfile.gettempdir())
        runtime_env.setdefault("XDG_CACHE_HOME", tempfile.gettempdir())
        runtime_env["PYTHONIOENCODING"] = "utf-8"
        args = [
            sys.executable,
            "-m",
            "maigret",
            username,
            "--html",
            "--json",
            "simple",
            "--folderoutput",
            temp_dir,
            "--no-color",
            "--no-progressbar",
            "--no-recursion",
            "--timeout",
            str(site_timeout),
            "--retries",
            str(retries),
            "--max-connections",
            str(max_connections),
            "--reports-sorting",
            "data",
        ]

        if os.environ.get("MAIGRET_AUTO_UPDATE") != "true":
            args.append("--no-autoupdate")

        if os.environ.get("MAIGRET_FORCE_UPDATE") == "true":
            args.append("--force-update")

        if os.environ.get("MAIGRET_EXTRACT_EXTENDED") == "false":
            args.append("--no-extracting")

        proxy_url = clean_env(os.environ.get("MAIGRET_PROXY_URL"))
        if proxy_url:
            args.extend(["--proxy", proxy_url])

        if os.environ.get("MAIGRET_CLOUDFLARE_BYPASS") == "true":
            args.append("--cloudflare-bypass")

        if mode == "DEEP" and os.environ.get("MAIGRET_DEEP_ALL") == "true":
            args.append("-a")
        else:
            args.extend(["--top-sites", str(top_sites)])

        completed = subprocess.run(
            args,
            capture_output=True,
            check=False,
            encoding="utf-8",
            errors="replace",
            env=runtime_env,
            timeout=process_timeout_ms / 1000,
        )

        output = f"{completed.stdout}\n{completed.stderr}".strip()
        if completed.returncode != 0:
            raise RuntimeError(output or f"Maigret exited with code {completed.returncode}.")

        report_json_path = first_matching_file(temp_dir, "_simple.json")
        html_report_path = first_matching_file(temp_dir, "_plain.html", required=False)
        report_json = Path(report_json_path).read_text(encoding="utf-8")
        html_report = Path(html_report_path).read_text(encoding="utf-8") if html_report_path else None

        return {
            "ok": True,
            "username": username,
            "checkedCount": extract_checked_count(output, top_sites),
            "failedRate": 0,
            "reportJson": report_json,
            "htmlReport": {
                "html": html_report,
                "htmlFilename": Path(html_report_path).name if html_report_path else None,
            }
            if html_report
            else None,
            "output": output[-4000:],
        }


def run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        raise RuntimeError("Maigret scan cannot run inside an existing event loop.")

    return asyncio.run(coro)


def resolve_top_sites(mode):
    if mode == "DEEP":
        return positive_int(os.environ.get("MAIGRET_TOP_SITES_DEEP"), 150)
    return positive_int(os.environ.get("MAIGRET_TOP_SITES_QUICK"), 50)


def resolve_site_data(db, top_sites):
    site_data = db.ranked_sites_dict(top=top_sites, disabled=False, id_type="username")
    priority_sites = resolve_priority_sites()
    if priority_sites:
        priority_site_data = db.ranked_sites_dict(
            top=sys.maxsize,
            names=priority_sites,
            disabled=False,
            id_type="username",
        )
        site_data.update(priority_site_data)
    return site_data


def resolve_priority_sites():
    configured = os.environ.get("MAIGRET_PRIORITY_SITES")
    if configured == "":
        return []
    parsed = split_comma_list(configured)
    return parsed if parsed else DEFAULT_PRIORITY_SITES


def split_comma_list(value):
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def clean_env(value):
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def positive_int(value, fallback):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def first_matching_file(folder, suffix, required=True):
    for entry in Path(folder).iterdir():
        if entry.is_file() and entry.name.endswith(suffix):
            return str(entry)
    if required:
        raise RuntimeError(f"Maigret did not generate a {suffix} report.")
    return None


def extract_checked_count(output, fallback):
    match = re.search(r"Starting .*? top (\d+) sites", output, re.IGNORECASE)
    return int(match.group(1)) if match else fallback
