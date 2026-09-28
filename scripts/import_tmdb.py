#!/usr/bin/env python3
"""Build year-sharded historical catalogue data from TMDB.

The default scope is "Hollywood": every non-adult film with a US release and
every US-origin TV series for the requested years. Credentials are read only
from TMDB_TOKEN and are never written to disk.
"""
import argparse
import datetime as dt
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
GENDERS = {0: "unspecified", 1: "female", 2: "male", 3: "nonbinary"}


def request(path, **params):
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    for attempt in range(7):
        try:
            req = urllib.request.Request(
                url,
                headers={"Authorization": f"Bearer {TOKEN}", "Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=35) as response:
                data = json.load(response)
            # Conservative enough for one or two concurrent importer jobs.
            time.sleep(0.12)
            return data
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 6:
                raise
            retry_after = error.headers.get("Retry-After")
            pause = float(retry_after) if retry_after else min(45, 2 ** attempt + 1)
            time.sleep(pause)
        except urllib.error.URLError:
            if attempt == 6:
                raise
            time.sleep(min(30, 2 ** attempt + 1))
    raise RuntimeError("TMDB request failed")


def person_profile(person_id, cache):
    key = str(person_id)
    if key not in cache:
        result = request(f"/person/{person_id}")
        dob = result.get("birthday") or ""
        cache[key] = {
            "birthYear": int(dob[:4]) if len(dob) >= 4 and dob[:4].isdigit() else None,
            "gender": GENDERS.get(result.get("gender", 0), "unspecified"),
        }
    return cache[key]


def date_windows(year):
    for month in range(1, 13):
        start = dt.date(year, month, 1)
        end = (dt.date(year + (month == 12), month % 12 + 1, 1) - dt.timedelta(days=1))
        yield start, end


def discover_params(kind, start, end, page, scope):
    field = "primary_release_date" if kind == "movie" else "first_air_date"
    params = {
        f"{field}.gte": start.isoformat(),
        f"{field}.lte": end.isoformat(),
        "sort_by": "popularity.desc",
        "page": page,
        "include_adult": "false",
    }
    if scope == "hollywood":
        if kind == "movie":
            params["region"] = "US"
        else:
            params["with_origin_country"] = "US"
    return params


def discover_range(kind, start, end, scope, max_pages):
    first = request(f"/discover/{kind}", **discover_params(kind, start, end, 1, scope))
    total_pages = int(first.get("total_pages", 1))
    # TMDB caps page numbers at 500. Split dense windows until each range fits.
    if total_pages > 500 and start < end:
        middle = start + (end - start) // 2
        yield from discover_range(kind, start, middle, scope, max_pages)
        yield from discover_range(kind, middle + dt.timedelta(days=1), end, scope, max_pages)
        return
    limit = total_pages if max_pages == 0 else min(total_pages, max_pages)
    for item in first.get("results", []):
        yield item
    for page in range(2, limit + 1):
        data = request(f"/discover/{kind}", **discover_params(kind, start, end, page, scope))
        for item in data.get("results", []):
            yield item


def convert(kind, summary, year, cache, cast_limit):
    item = request(f"/{kind}/{summary['id']}", append_to_response="credits")
    date = item.get("release_date" if kind == "movie" else "first_air_date") or ""
    if not date.startswith(str(year)):
        return None

    credits = item.get("credits") or {}
    cast = credits.get("cast", [])
    if cast_limit:
        cast = cast[:cast_limit]

    if kind == "movie":
        director = next(
            (x.get("name") for x in credits.get("crew", []) if x.get("job") == "Director" and x.get("name")),
            None,
        )
        credit_label = "Directed by"
    else:
        creators = item.get("created_by") or []
        director = next((x.get("name") for x in creators if x.get("name")), None)
        credit_label = "Created by"

    roles = []
    seen_credits = set()
    for actor in cast:
        name, character = actor.get("name"), (actor.get("character") or "").strip()
        if not name or not character:
            continue
        credit_key = actor.get("credit_id") or (actor.get("id"), character)
        if str(credit_key) in seen_credits:
            continue
        seen_credits.add(str(credit_key))

        profile = person_profile(actor["id"], cache)
        by = profile.get("birthYear")
        actor_age = year - by if by else None
        low = max(4, actor_age - 9) if actor_age is not None else 4
        high = min(90, actor_age + 9) if actor_age is not None else 85
        if actor_age is not None and actor_age < 18:
            high = min(17, high)
        role_gender = GENDERS.get(actor.get("gender", 0), profile.get("gender", "unspecified"))

        role = {
            "character": character[:180],
            "actor": name,
            "personId": actor["id"],
            "birthYear": by,
            "gender": role_gender,
            "genderSource": "canonical_performer",
            "ageMin": low,
            "ageMax": max(low, high),
        }
        if actor_age is not None:
            role["characterAge"] = actor_age
        roles.append(role)

    if not roles:
        return None

    countries = [
        x.get("iso_3166_1")
        for x in (item.get("production_countries") or [])
        if x.get("iso_3166_1")
    ]
    if kind == "tv":
        countries = item.get("origin_country") or countries

    return {
        "id": f"tmdb-{kind}-{item['id']}",
        "title": item.get("title" if kind == "movie" else "name") or "Untitled",
        "year": year,
        "releaseDate": date,
        "castingYear": year - 1,
        "kind": "Film" if kind == "movie" else "TV series",
        "director": director or "Unknown",
        "creditLabel": credit_label,
        "genre": (item.get("genres") or [{"name": "Drama"}])[0]["name"],
        "genres": [g.get("name") for g in item.get("genres", []) if g.get("name")],
        "roles": roles,
        "tmdbId": item["id"],
        "source": "TMDB",
        "originCountries": countries,
        "popularity": item.get("popularity", summary.get("popularity", 0)),
        "voteCount": item.get("vote_count", summary.get("vote_count", 0)),
    }


def load_cache(path):
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return {}


def save_cache(path, cache):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache, separators=(",", ":")) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, required=True)
    parser.add_argument("--end", type=int, required=True)
    parser.add_argument(
        "--scope",
        choices=("hollywood", "worldwide"),
        default="hollywood",
        help="hollywood = films with a US release + US-origin TV; worldwide = all TMDB results",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="0 means every page. Set a small number only for development/testing.",
    )
    parser.add_argument(
        "--cast-limit",
        type=int,
        default=0,
        help="0 means every credited cast role with a character name.",
    )
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    if not TOKEN:
        parser.error("Set TMDB_TOKEN in your environment. Never commit the token.")
    if not 1960 <= args.start <= args.end <= 2026:
        parser.error("Use years 1960–2026.")
    if args.max_pages < 0 or args.max_pages > 500 or args.cast_limit < 0:
        parser.error("max-pages must be 0–500 and cast-limit must be 0 or greater.")

    out = ROOT / "data" / "years"
    out.mkdir(parents=True, exist_ok=True)
    cache_path = ROOT / ".cache" / "tmdb-people.json"
    cache = load_cache(cache_path)

    for year in range(args.start, args.end + 1):
        path = out / f"{year}.json"
        if path.exists() and not args.force:
            print(f"{year}: already exists (use --force to rebuild)")
            continue

        projects, seen = [], set()
        for kind in ("movie", "tv"):
            for start, end in date_windows(year):
                for summary in discover_range(kind, start, end, args.scope, args.max_pages):
                    item_id = summary.get("id")
                    key = (kind, item_id)
                    if not item_id or key in seen:
                        continue
                    seen.add(key)
                    try:
                        project = convert(kind, summary, year, cache, args.cast_limit)
                        if project:
                            projects.append(project)
                    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
                        print(f"Skipped {kind} {item_id}: {exc}")

        projects.sort(key=lambda p: (-float(p.get("popularity") or 0), p["title"]))
        payload = {
            "year": year,
            "source": "TMDB",
            "scope": args.scope,
            "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
            "projects": projects,
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
        save_cache(cache_path, cache)
        print(year, len(projects), sum(len(p["roles"]) for p in projects), path)


if __name__ == "__main__":
    main()
