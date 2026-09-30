#!/usr/bin/env python3
"""Preserve completed artifacts from one historical import; retry failed years.

The source run continues untouched. Only the dedicated backup branch receives
catalogue data. Run on the recovery branch with GITHUB_TOKEN and, for retries, TMDB_TOKEN.
"""
import http.client
import io
import json
import os
import pathlib
import re
import subprocess
import time
import urllib.error
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
YEARS = set(range(1960, 2027))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def github_get(url, token, archive=False):
    # GitHub artifact downloads redirect to object storage. Never forward the
    # repository credential to that external URL.
    opener = urllib.request.build_opener(NoRedirect())
    for attempt in range(5):
        try:
            request = urllib.request.Request(url, headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            })
            try:
                with opener.open(request, timeout=90) as response:
                    raw = response.read()
            except urllib.error.HTTPError as error:
                if archive and error.code in (301, 302, 303, 307, 308):
                    location = error.headers.get("Location", "")
                    if not location.startswith("https://"):
                        raise ValueError("Artifact redirect must use HTTPS")
                    with urllib.request.urlopen(location, timeout=120) as response:
                        raw = response.read()
                else:
                    raise
            return raw if archive else json.loads(raw)
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            time.sleep(min(30, 2 ** attempt + 1))
        except (urllib.error.URLError, http.client.HTTPException, TimeoutError, ConnectionError):
            if attempt == 4:
                raise
            time.sleep(min(30, 2 ** attempt + 1))


def validate_year(raw, year):
    payload = json.loads(raw)
    if payload.get("year") != year or payload.get("source") != "TMDB":
        raise ValueError(f"Invalid metadata for {year}")
    if payload.get("scope") != "hollywood":
        raise ValueError(f"Unexpected catalogue scope for {year}")
    projects = payload.get("projects")
    if not isinstance(projects, list) or not projects:
        raise ValueError(f"Empty or invalid catalogue for {year}")
    seen = set()
    for project in projects:
        if project.get("year") != year or not isinstance(project.get("roles"), list):
            raise ValueError(f"Invalid production in {year}")
        key = project.get("id")
        if not key or key in seen:
            raise ValueError(f"Duplicate or missing production ID in {year}")
        seen.add(key)
    return payload


def extract_year(raw, year):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if len(entries) != 1 or entries[0].filename != f"{year}.json":
            raise ValueError(f"Unexpected ZIP contents for {year}")
        if entries[0].file_size > 250 * 1024 * 1024:
            raise ValueError(f"Oversized year shard: {year}")
        content = archive.read(entries[0])
    validate_year(content, year)
    return content


def git(*args, capture=False):
    result = subprocess.run(["git", *args], cwd=ROOT, check=True,
                            text=True, capture_output=capture)
    return result.stdout.strip() if capture else ""


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    token = os.environ["GITHUB_TOKEN"]
    run_id = int(os.environ["SOURCE_RUN_ID"])
    api = f"https://api.github.com/repos/{repo}/actions/runs/{run_id}"
    backup = f"maintenance/historical-database-{run_id}"
    git("config", "user.name", "github-actions[bot]")
    git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    exists = git("ls-remote", "--heads", "origin", f"refs/heads/{backup}", capture=True)
    if exists:
        git("fetch", "origin", f"{backup}:refs/remotes/origin/{backup}")
        git("checkout", "-B", backup, f"origin/{backup}")
    else:
        git("checkout", "-b", backup)
    out = ROOT / "data" / "years"
    out.mkdir(parents=True, exist_ok=True)

    def preserved():
        found = set()
        for year in YEARS:
            path = out / f"{year}.json"
            if path.exists():
                validate_year(path.read_bytes(), year)
                found.add(year)
        return found

    def commit_backup():
        git("add", "data/years")
        if git("diff", "--cached", "--name-only", capture=True):
            count = len(preserved())
            git("commit", "-m", f"Preserve historical catalogue: {count}/67 years")
            git("push", "origin", f"HEAD:refs/heads/{backup}")

    def snapshot():
        saved = preserved()
        missing_expired = []
        for page in range(1, 20):
            data = github_get(f"{api}/artifacts?per_page=100&page={page}", token)
            artifacts = data["artifacts"]
            for artifact in artifacts:
                match = re.fullmatch(r"historical-(\d{4})", artifact["name"])
                if not match:
                    continue
                year = int(match.group(1))
                if year not in YEARS or year in saved:
                    continue
                if artifact["expired"]:
                    missing_expired.append(year)
                    continue
                content = extract_year(github_get(artifact["archive_download_url"], token, True), year)
                temporary = out / f"{year}.json.tmp"
                temporary.write_bytes(content)
                temporary.replace(out / f"{year}.json")
                saved.add(year)
                print(f"Preserved {year}", flush=True)
            if len(artifacts) < 100:
                break
        commit_backup()
        print(f"Durable backup: {len(saved)}/67 years; {backup}", flush=True)
        return saved, missing_expired

    saved, expired = snapshot()
    failed = set(expired)
    for page in range(1, 20):
        data = github_get(f"{api}/jobs?per_page=100&page={page}", token)
        for job in data["jobs"]:
            match = re.fullmatch(r"import-year \((\d{4})\)", job["name"])
            if match and job["conclusion"] in ("failure", "cancelled"):
                failed.add(int(match.group(1)))
        if len(data["jobs"]) < 100:
            break
    retry_errors = []
    # Limit repairs per invocation; the hourly workflow will pick up others.
    for year in sorted((failed & YEARS) - saved)[:1]:
        if not os.environ.get("TMDB_TOKEN"):
            raise RuntimeError("TMDB_TOKEN is required to recover failed years")
        print(f"Recovering {year} with network retries", flush=True)
        result = subprocess.run(["python", "scripts/import_tmdb.py", "--start", str(year),
                                 "--end", str(year), "--scope", "hollywood"],
                                cwd=ROOT, timeout=4 * 60 * 60)
        if result.returncode:
            retry_errors.append(year)
        else:
            validate_year((out / f"{year}.json").read_bytes(), year)
            commit_backup()
    saved, expired = snapshot()
    missing = sorted(YEARS - saved)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as file:
            file.write(f"## Historical database recovery\n\nPreserved **{len(saved)}/67 years** on `{backup}`.\n\n")
            file.write(f"Missing years: {', '.join(map(str, missing)) or 'none'}.\n\n")
            file.write("The original import and gameplay branch remain separate. Full coverage is ready for catalogue publication.\n" if not missing else "This one-time recovery preserves every file currently available; run again to collect later completions.\n")
    if retry_errors:
        raise RuntimeError(f"Years still needing recovery: {retry_errors}")


if __name__ == "__main__":
    main()
