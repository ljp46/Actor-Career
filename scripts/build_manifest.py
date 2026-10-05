#!/usr/bin/env python3
"""Rebuild the lightweight year/opportunity manifest from imported year shards."""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
YEARS = ROOT / "data" / "years"


def role_fit_for_age(age, role):
    target = role.get("characterAge")
    if target is None:
        target = math.floor((role.get("ageMin", 4) + role.get("ageMax", 85)) / 2 + 0.5)
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
            casting_year = int(project.get("castingYear", project["year"] - 1))
            delta = int(project["year"]) - casting_year
            year_bucket = opportunities.setdefault(str(casting_year), {})
            for role in project.get("roles", []):
                totals["roles"] += 1
                target = role.get("characterAge")
                if target is None:
                    target = math.floor((role.get("ageMin", 4) + role.get("ageMax", 85)) / 2 + 0.5)
                # A 35% fit cannot be more than nine years from the target.
                for age_at_casting in range(max(4, math.ceil(target - delta - 9)), min(90, math.floor(target - delta + 9)) + 1):
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

