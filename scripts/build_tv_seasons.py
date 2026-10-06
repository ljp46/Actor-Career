#!/usr/bin/env python3
"""Season casts for curated shows only. Resume cached requests; never publish partial data."""
import concurrent.futures
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import threading
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'tv-seasons-v13'
LOCK = threading.Lock()
NEXT_REQUEST = 0.0
GENDERS = {1: 'female', 2: 'male', 3: 'nonbinary'}


def request(path):
    global NEXT_REQUEST
    cached = CACHE / (hashlib.sha256(path.encode()).hexdigest() + '.json')
    if cached.exists():
        return json.loads(cached.read_text())
    for attempt in range(7):
        with LOCK:
            delay = max(0, NEXT_REQUEST - time.monotonic())
            NEXT_REQUEST = max(time.monotonic(), NEXT_REQUEST) + .065
        time.sleep(delay)
        req = urllib.request.Request('https://api.themoviedb.org/3' + path, headers={
            'Authorization': 'Bearer ' + os.environ['TMDB_TOKEN'], 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                raw = json.load(response)
            if '/season/' in path:
                data = {'id': raw['id'], 'airDate': raw.get('air_date'),
                        'lastAirDate': max((e.get('air_date') or '' for e in raw.get('episodes', [])), default=''),
                        'episodeCount': len(raw.get('episodes', [])), 'rating': raw.get('vote_average'),
                        'cast': [{'id': a['id'], 'name': a['name'], 'gender': a.get('gender'),
                                  'order': a.get('order', 999), 'roles': [
                                      {'character': r.get('character', ''), 'episodeCount': r.get('episode_count', 0)}
                                      for r in a.get('roles', [])]}
                                 for a in raw.get('aggregate_credits', {}).get('cast', [])]}
            else:
                data = {'id': raw['id'], 'status': raw.get('status'), 'lastAirDate': raw.get('last_air_date'),
                        'seasons': [{'number': s['season_number'], 'airDate': s.get('air_date'),
                                     'episodeCount': s.get('episode_count', 0)} for s in raw.get('seasons', [])]}
            cached.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
            return data
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 6:
                raise RuntimeError(f'TMDB {path}: HTTP {exc.code}') from None
            time.sleep(min(30, float(exc.headers.get('Retry-After') or 2 ** attempt)))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 6:
                raise RuntimeError(f'TMDB request failed: {path}') from None
            time.sleep(min(30, 2 ** attempt))


def packed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), compresslevel=9, mtime=0))


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    shows = {}
    people = {}
    for path in sorted((ROOT / 'data' / 'years').glob('[0-9]*.json.gz')):
        for p in json.loads(gzip.decompress(path.read_bytes()))['projects']:
            for role in p['roles']:
                pid = role.get('personId')
                if pid and role.get('birthYear') and pid not in people:
                    people[pid] = role
            if p['kind'] == 'TV series':
                shows[p['id']] = p
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        details = dict(zip(shows, pool.map(lambda p: request('/tv/' + str(p['tmdbId'])), shows.values())))
    tasks = [(sid, season) for sid, d in details.items() for season in d['seasons']
             if season['number'] > 0 and season['airDate'] and '1960-01-01' <= season['airDate'] <= '2026-12-31']
    print(json.dumps({'shows': len(shows), 'datedSeasons': len(tasks)}), flush=True)
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for i, result in enumerate(pool.map(lambda item: (item[0], item[1], request(
                f"/tv/{shows[item[0]]['tmdbId']}/season/{item[1]['number']}?append_to_response=aggregate_credits")), tasks)):
            results.append(result)
            if i % 200 == 0:
                print(f'Checkpointed {i + 1}/{len(tasks)} seasons', flush=True)
    years = {y: [] for y in range(1960, 2027)}
    index = {'version': 1, 'source': 'TMDB season aggregate credits', 'shows': {}, 'years': list(years), 'totals': {}}
    for sid, p in shows.items():
        d = details[sid]
        index['shows'][sid] = {'id': sid, 'title': p['title'], 'status': d['status'], 'lastAirDate': d['lastAirDate'], 'seasons': []}
    for sid, desc, season in results:
        p = shows[sid]
        date = season['airDate'] or desc['airDate']
        year = int(date[:4])
        roles = []
        seen = set()
        known = {r.get('personId'): r for r in p['roles'] if r.get('personId')}
        for actor in sorted(season['cast'], key=lambda a: (a['order'], a['id'])):
            old = people.get(actor['id']) or known.get(actor['id']) or {}
            birth = old.get('birthYear')
            for role in actor['roles']:
                character = role['character'].strip()
                if not character or (actor['id'], character) in seen:
                    continue
                seen.add((actor['id'], character))
                age = year - birth if birth else old.get('characterAge')
                r = {'character': character, 'actor': actor['name'], 'personId': actor['id'], 'birthYear': birth,
                     'gender': GENDERS.get(actor['gender'], old.get('gender', 'unspecified')),
                     'genderSource': 'canonical_performer', 'episodeCount': role['episodeCount'],
                     'roleType': 'recurring' if role['episodeCount'] >= max(2, season['episodeCount'] * .2) else 'guest',
                     'ageMin': max(4, age - 9) if age is not None else 4,
                     'ageMax': min(100, age + 9) if age is not None else 85}
                if age is not None:
                    r['characterAge'] = age
                roles.append(r)
        project = {'id': f"{sid}-season-{desc['number']}", 'seriesId': sid, 'seriesTitle': p['title'],
                   'title': f"{p['title']} · Season {desc['number']}", 'seasonNumber': desc['number'],
                   'year': year, 'releaseDate': date, 'finaleDate': season['lastAirDate'] or date,
                   'kind': 'TV series', 'genre': p['genre'], 'director': p['director'],
                   'creditLabel': p.get('creditLabel', 'Created by'), 'voteCount': p.get('voteCount', 0),
                   'popularity': p.get('popularity', 0), 'baselineRating': season['rating'], 'roles': roles,
                   'episodeCount': season['episodeCount'], 'source': 'TMDB season aggregate credits'}
        years[year].append(project)
        index['shows'][sid]['seasons'].append({'id': project['id'], 'number': desc['number'], 'year': year,
                                             'releaseDate': date, 'finaleDate': project['finaleDate'],
                                             'roles': [{'index': i, 'character': r['character'], 'actorId': r['personId'],
                                                        'roleType': r['roleType']} for i, r in enumerate(roles)]})
    for show in index['shows'].values():
        show['seasons'].sort(key=lambda s: (s['releaseDate'], s['number']))
        packed(ROOT / 'data' / 'tv-seasons' / 'shows' / f"{show['id']}.json.gz", show)
        show['seasons'] = [{k: v for k, v in season.items() if k != 'roles'} for season in show['seasons']]
    for year, projects in years.items():
        packed(ROOT / 'data' / 'tv-seasons' / 'years' / f'{year}.json.gz', {'year': year, 'projects': sorted(projects, key=lambda p: p['id'])})
    index['totals'] = {'shows': len(shows), 'seasons': len(results), 'roles': sum(len(p['roles']) for ps in years.values() for p in ps)}
    packed(ROOT / 'data' / 'tv-seasons' / 'index.json.gz', index)
    print(json.dumps(index['totals']), flush=True)


if __name__ == '__main__':
    main()
