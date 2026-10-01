#!/usr/bin/env python3
"""Stop the two superseded full-year runs and pause their refresh schedule."""
import json
import os
import urllib.error
import urllib.request

RUNS = (36386406355, 36852230780)


def call(path, method="GET"):
    url = f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/{path}"
    request = urllib.request.Request(url, method=method, headers={
        "Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    })
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
    return json.loads(raw) if raw else None


def main():
    for run_id in RUNS:
        run = call(f"actions/runs/{run_id}")
        if run.get("name") != "Build Historical Database" or run.get("head_branch") != "main":
            raise RuntimeError(f"Unexpected workflow identity for run {run_id}")
        if run["status"] == "completed":
            print(f"Run {run_id} already completed ({run['conclusion']})", flush=True)
            continue
        try:
            call(f"actions/runs/{run_id}/cancel", "POST")
            print(f"Cancellation requested for full-year run {run_id}", flush=True)
        except urllib.error.HTTPError as error:
            # A run can finish between the status check and cancellation.
            if error.code != 409 or call(f"actions/runs/{run_id}")["status"] != "completed":
                raise
    call("actions/workflows/build-historical-database.yml/disable", "PUT")
    print("Old full-year workflow paused; monthly recovery remains enabled", flush=True)


if __name__ == "__main__":
    main()
