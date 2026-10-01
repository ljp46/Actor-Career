#!/usr/bin/env python3
"""Recover failed years as independently saved monthly chunks."""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import tempfile
import time

from recover_catalogue import github_get, validate_year

ROOT = pathlib.Path(__file__).resolve().parents[1]


def command(*args, cwd=None, check=True):
    return subprocess.run(args, cwd=ROOT if cwd is None else cwd, check=check, text=True, capture_output=True)


def validate_chunk(raw, year, month):
    payload = json.loads(raw)
    if (payload.get("year") != year or payload.get("month") != month
            or payload.get("source") != "TMDB" or payload.get("scope") != "hollywood"
            or payload.get("complete") is not True or payload.get("batchVersion") != 1
            or not isinstance(payload.get("projects"), list)):
        raise ValueError(f"Invalid or incomplete chunk {year}-{month:02d}")
    seen = set()
    for project in payload["projects"]:
        key = project.get("id")
        if not key or key in seen or project.get("year") != year or not isinstance(project.get("roles"), list):
            raise ValueError(f"Invalid production in chunk {year}-{month:02d}")
        seen.add(key)
    return payload


def merge_chunks(directory, year):
    projects = {}
    for month in range(1, 13):
        path = directory / f"{month:02d}.json"
        if not path.exists():
            return None
        payload = validate_chunk(path.read_bytes(), year, month)
        for project in payload["projects"]:
            projects.setdefault(project["id"], project)
    payload = {"year": year, "source": "TMDB", "scope": "hollywood",
               "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
               "projects": sorted(projects.values(), key=lambda p: (-float(p.get("popularity") or 0), p["title"]))}
    raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    validate_year(raw, year)
    return raw


def remote_content(branch, path):
    result = command("git", "show", f"origin/{branch}:{path}", check=False)
    return result.stdout if result.returncode == 0 else None


def prepare(repo, token, run_id, branch):
    command("git", "fetch", "origin", f"{branch}:refs/remotes/origin/{branch}")
    missing_years = []
    batches = []
    for year in range(1960, 2027):
        complete = remote_content(branch, f"data/years/{year}.json")
        if complete is not None:
            validate_year(complete, year)
            continue
        missing_years.append(year)
        for month in range(1, 13):
            raw = remote_content(branch, f"data/recovery/{year}/{month:02d}.json")
            if raw is not None:
                validate_chunk(raw, year, month)
                continue
            batches.append({"year": year, "month": month})
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write(f"has_work={'true' if batches else 'false'}\n")
        output.write("matrix=" + json.dumps({"include": batches}, separators=(",", ":")) + "\n")
    print(f"Recovery plan: {len(batches)} missing months across remaining years {missing_years}", flush=True)


def save_chunk(branch, year, month, raw):
    validate_chunk(raw, year, month)
    # Each job uses an isolated checkout of the latest backup. Concurrent jobs
    # retry against its new HEAD instead of overwriting each other's progress.
    with tempfile.TemporaryDirectory(prefix="catalogue-month-") as temporary:
        work = pathlib.Path(temporary) / "backup"
        command("git", "fetch", "origin", f"{branch}:refs/remotes/origin/{branch}")
        command("git", "worktree", "add", "--detach", str(work), f"origin/{branch}")
        try:
            for attempt in range(10):
                command("git", "fetch", "origin", f"{branch}:refs/remotes/origin/{branch}")
                command("git", "reset", "--hard", f"origin/{branch}", cwd=work)
                target = work / "data" / "recovery" / str(year) / f"{month:02d}.json"
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                merged = merge_chunks(target.parent, year)
                if merged is not None:
                    (work / "data" / "years" / f"{year}.json").write_bytes(merged)
                command("git", "add", "data/recovery", "data/years", cwd=work)
                changed = command("git", "diff", "--cached", "--name-only", cwd=work).stdout.strip()
                if not changed:
                    print(f"Already preserved {year}-{month:02d}", flush=True)
                    return
                command("git", "-c", "user.name=github-actions[bot]", "-c",
                        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                        "commit", "-m", f"Preserve recovery month {year}-{month:02d}" +
                        (f" and completed year {year}" if merged is not None else ""), cwd=work)
                pushed = command("git", "push", "origin", f"HEAD:refs/heads/{branch}", cwd=work, check=False)
                if pushed.returncode == 0:
                    print(f"Saved {year}-{month:02d}" + ("; complete year assembled" if merged is not None else ""), flush=True)
                    return
                time.sleep(min(15, attempt + 1))
            raise RuntimeError("Could not save month after concurrent backup updates")
        finally:
            command("git", "worktree", "remove", "--force", str(work), check=False)


def import_month(branch, year, month):
    command("git", "fetch", "origin", f"{branch}:refs/remotes/origin/{branch}")
    if remote_content(branch, f"data/years/{year}.json") is not None:
        print(f"Year {year} is already preserved; skipping", flush=True)
        return
    existing = remote_content(branch, f"data/recovery/{year}/{month:02d}.json")
    if existing is not None:
        validate_chunk(existing, year, month)
        print(f"Month {year}-{month:02d} already complete; skipping", flush=True)
        return
    subprocess.run(["python", "scripts/import_tmdb.py", "--start", str(year), "--end", str(year),
                    "--month", str(month), "--scope", "hollywood"], cwd=ROOT, check=True, timeout=4*60*60)
    save_chunk(branch, year, month, (ROOT / "data/recovery" / str(year) / f"{month:02d}.json").read_bytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("prepare", "import"))
    args = parser.parse_args()
    run_id = int(os.environ["SOURCE_RUN_ID"])
    branch = f"maintenance/historical-database-{run_id}"
    if args.action == "prepare":
        prepare(os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_TOKEN"], run_id, branch)
    else:
        year, month = int(os.environ["RECOVERY_YEAR"]), int(os.environ["RECOVERY_MONTH"])
        if year not in range(1960, 2027) or month not in range(1, 13):
            raise ValueError("Invalid recovery year/month")
        import_month(branch, year, month)


if __name__ == "__main__":
    main()
