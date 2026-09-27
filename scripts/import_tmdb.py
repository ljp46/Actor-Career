#!/usr/bin/env python3
"""Bounded TMDB catalogue importer. Uses a local token; never writes credentials."""
import argparse
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://api.themoviedb.org/3"
TOKEN = os.environ.get("TMDB_TOKEN")


def request(path, **params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=25) as response:
                data = json.load(response)
            time.sleep(0.28)
            return data
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 4:
                raise
            time.sleep(min(30, 2 ** attempt + 1))
    raise RuntimeError("TMDB request failed")


def birth_year(person_id, cache):
    if person_id not in cache:
        result = request(f"/person/{person_id}")
        dob = result.get("birthday") or ""
        cache[person_id] = int(dob[:4]) if len(dob) >= 4 and dob[:4].isdigit() else None
    return cache[person_id]


def convert(kind, summary, year, cache):
    item = request(f"/{kind}/{summary['id']}", append_to_response="credits")
    date = item.get("release_date" if kind == "movie" else "first_air_date") or ""
    if not date.startswith(str(year)):
        return None
    credits = item.get("credits") or {}
    cast = credits.get("cast", [])[:8]
    director = next((x["name"] for x in credits.get("crew", []) if x.get("job") == "Director"), None)
    if kind == "tv":
        creators = item.get("created_by") or []
        director = creators[0]["name"] if creators else None
    roles = []
    for actor in cast:
        if not actor.get("name") or not actor.get("character"):
            continue
        by = birth_year(actor["id"], cache)
        actor_age = year - by if by else None
        low = max(4, actor_age - 9) if actor_age is not None else 4
        high = min(90, actor_age + 9) if actor_age is not None else 85
        if actor_age is not None and actor_age < 18:
            high = min(17, high)
        roles.append({"character": actor["character"][:100], "actor": actor["name"], "personId": actor["id"], "birthYear": by, "ageMin": low, "ageMax": max(low, high)})
    if not roles:
        return None
    return {"id": f"tmdb-{kind}-{item['id']}", "title": item.get("title" if kind == "movie" else "name"), "year": year, "releaseDate": date, "kind": "Film" if kind == "movie" else "TV series", "director": director or "Unknown", "genre": (item.get("genres") or [{"name": "Drama"}])[0]["name"], "roles": roles, "tmdbId": item["id"], "source": "TMDB"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument("--max-pages", type=int, default=2)
    args = parser.parse_args()
    if not TOKEN:
        parser.error("Set TMDB_TOKEN in your environment. Never commit the token.")
    if not 1960 <= args.start <= args.end <= 2026 or not 1 <= args.max_pages <= 10:
        parser.error("Use years 1960–2026 and 1–10 pages.")
    out = ROOT / "data" / "years"
    out.mkdir(exist_ok=True)
    cache = {}
    for year in range(args.start, args.end + 1):
        projects = []
        for kind in ("movie", "tv"):
            date_field = "primary_release_date" if kind == "movie" else "first_air_date"
            for page in range(1, args.max_pages + 1):
                data = request(f"/discover/{kind}", **{f"{date_field}.gte": f"{year}-01-01", f"{date_field}.lte": f"{year}-12-31", "sort_by": "popularity.desc", "page": page, "include_adult": "false"})
                for item in data.get("results", []):
                    try:
                        project = convert(kind, item, year, cache)
                        if project:
                            projects.append(project)
                    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
                        print(f"Skipped {kind} {item['id']}: {exc}")
                if page >= data.get("total_pages", 1):
                    break
        path = out / f"{year}.json"
        path.write_text(json.dumps({"year": year, "source": "TMDB", "projects": projects}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(year, len(projects), path)
    manifest = out / "index.json"
    years = sorted(int(path.stem) for path in out.glob("[0-9][0-9][0-9][0-9].json"))
    manifest.write_text(json.dumps({"years": years}, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
