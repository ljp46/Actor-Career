#!/usr/bin/env python3
"""Rebuild the lightweight year/opportunity manifest from imported year shards."""
import json
import pathlib
import datetime as dt

ROOT = pathlib.Path(__file__).resolve().parents[1]
YEARS = ROOT / "data" / "years"


def role_fit_for_age(age, role):
    target = role.get("characterAge")
    if target is None:
        target = round((role.get("ageMin", 4) + role.get("ageMax", 85)) / 2)
    gap = abs(age - target)
    fit = 100 - gap * 7
    if age < role.get("ageMin", 4):
        fit -= (role.get("ageMin", 4) - age) * 5
    if age > role.get("ageMax", 85):
        fit -= (age - role.get("ageMax", 85)) * 5
    return max(0, min(100, round(fit)))


def genders_for_role(role):
    value = role.get("gender", "unspecified")
    if value in ("male", "female", "nonbinary"):
        return (value,)
    return ("male", "female", "nonbinary")


def casting_start_year(project):
    """Match the browser's estimated schedule for the opportunity preview."""
    release = project.get("releaseDate")
    try:
        release_date = dt.date.fromisoformat(release) if release else None
    except ValueError:
        release_date = None
    if release_date is None:
        value = 2166136261
        for char in project["id"]:
            value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
        release_date = dt.date(int(project["year"]), 6 + value % 6, 15)
    big = (project.get("voteCount") or 0) >= 1000 or (project.get("popularity") or 0) >= 80
    tv = project.get("kind") == "TV series"
    duration = (22 if big else 14) if tv else (22 if big else 10)
    gap = 10 if tv else (30 if big else 20)
    try:
        filming_end = dt.date.fromisoformat(project["filmingEndDate"])
    except (KeyError, ValueError):
        filming_end = release_date - dt.timedelta(weeks=gap)
    try:
        filming_start = dt.date.fromisoformat(project["filmingStartDate"])
    except (KeyError, ValueError):
        filming_start = filming_end - dt.timedelta(weeks=duration)
    try:
        casting_start = dt.date.fromisoformat(project["castingStartDate"])
    except (KeyError, ValueError):
        casting_start = filming_start - dt.timedelta(weeks=26 if big else 20)
    return casting_start.year


def main():
    years = []
    opportunities = {}
    totals = {"projects": 0, "roles": 0}

    for path in sorted(YEARS.glob("[0-9][0-9][0-9][0-9].json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        year = int(payload["year"])
        years.append(year)
        for project in payload.get("projects", []):
            totals["projects"] += 1
            casting_year = casting_start_year(project)
            delta = int(project["year"]) - casting_year
            year_bucket = opportunities.setdefault(str(casting_year), {})
            for role in project.get("roles", []):
                totals["roles"] += 1
                for age_at_casting in range(4, 91):
                    age_at_project = age_at_casting + delta
                    if role_fit_for_age(age_at_project, role) < 35:
                        continue
                    for gender in genders_for_role(role):
                        gender_bucket = year_bucket.setdefault(gender, {})
                        key = str(age_at_casting)
                        gender_bucket[key] = gender_bucket.get(key, 0) + 1

    manifest = {
        "years": years,
        "range": [min(years), max(years)] if years else [],
        "totals": totals,
        "opportunities": opportunities,
    }
    (YEARS / "index.json").write_text(
        json.dumps(manifest, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"years": len(years), **totals}))


if __name__ == "__main__":
    main()
