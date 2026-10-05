#!/usr/bin/env python3
"""Enrich only the curated films; reuse saved casts for real collection links.

No person/credits re-import. Missing/failed API responses abort publication.
Full per-project files are lazy-loaded only for a signed deal outside the top 100.
"""
import concurrent.futures
import gzip
import json
import os
import pathlib
import threading
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'franchise-details'
LOCK = threading.Lock()
NEXT_REQUEST = 0.0


def request(path):
    global NEXT_REQUEST
    cached = CACHE / (path.strip('/').replace('/', '-') + '.json')
    if cached.exists():
        return json.loads(cached.read_text())
    for attempt in range(6):
        with LOCK:
            now = time.monotonic()
            delay = max(0, NEXT_REQUEST - now)
            NEXT_REQUEST = max(now, NEXT_REQUEST) + .06
        if delay:
            time.sleep(delay)
        req = urllib.request.Request('https://api.themoviedb.org/3' + path,
                                     headers={'Authorization': 'Bearer ' + os.environ['TMDB_TOKEN'], 'Accept': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=25) as response:
                data = json.load(response)
            # Keep a compact checkpoint, not an API credential or entire response.
            if path.startswith('/movie/'):
                data = {'id': data['id'], 'collection': data.get('belongs_to_collection'), 'rating': data.get('vote_average')}
            else:
                data = {'id': data['id'], 'name': data['name'], 'parts': [{'id': p['id'], 'title': p.get('title'), 'releaseDate': p.get('release_date')} for p in data.get('parts', [])]}
            cached.write_text(json.dumps(data, separators=(',', ':')))
            return data
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == 5:
                raise RuntimeError(f'TMDB {path}: HTTP {e.code}') from None
            time.sleep(min(30, float(e.headers.get('Retry-After') or (2 ** attempt))))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 5:
                raise RuntimeError(f'TMDB {path}: connection failed') from None
            time.sleep(min(20, 2 ** attempt))
    raise RuntimeError('Unreachable retry state')


def packed(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
    path.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))


def main():
    if not os.environ.get('TMDB_TOKEN'):
        raise SystemExit('TMDB_TOKEN is required; no partial franchise index will be published.')
    CACHE.mkdir(parents=True, exist_ok=True)
    selected = {}
    for path in sorted((ROOT / 'data' / 'years').glob('*.json.gz')):
        for p in json.loads(gzip.decompress(path.read_bytes()))['projects']:
            if p['kind'] == 'Film' and p.get('tmdbId'):
                selected[p['id']] = p
    collections, project_collections, ratings = {}, {}, {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for n, (p, detail) in enumerate(zip(selected.values(), pool.map(lambda p: request(f'/movie/{p["tmdbId"]}'), selected.values())), 1):
            ratings[p['id']] = detail.get('rating')
            c = detail.get('collection')
            if c:
                project_collections[p['id']] = str(c['id'])
                collections[str(c['id'])] = {'id': str(c['id']), 'name': c['name'], 'parts': []}
            if n % 250 == 0:
                print(f'Linked {n}/{len(selected)} curated films', flush=True)
        details = list(pool.map(lambda cid: request(f'/collection/{cid}'), collections))
    wanted = {}
    for detail in details:
        cid = str(detail['id'])
        for p in detail['parts']:
            date = p.get('releaseDate') or ''
            if len(date) == 10 and '1960-01-01' <= date <= '2026-12-31':
                wanted[f'tmdb-movie-{p["id"]}'] = cid
    # Read each archived year once, retaining only a small summary plus lazy files.
    for path in sorted((ROOT / 'data' / 'archive' / 'years').glob('*.json.gz')):
        for p in json.loads(gzip.decompress(path.read_bytes()))['projects']:
            cid = wanted.get(p['id'])
            if not cid:
                continue
            summary = {k: p.get(k) for k in ('id', 'title', 'year', 'releaseDate', 'kind', 'voteCount', 'popularity')}
            summary['collectionId'] = cid
            summary['roles'] = [{'index': i, 'character': r['character'], 'actor': r['actor'], 'gender': r.get('gender', 'unspecified')} for i, r in enumerate(p['roles'])]
            collections[cid]['parts'].append(summary)
            project_collections[p['id']] = cid
            if p['id'] not in selected:
                packed(ROOT / 'data' / 'franchise-projects' / f'{p["id"]}.json.gz', {'project': p})
    for c in collections.values():
        c['parts'].sort(key=lambda p: (p['releaseDate'] or f'{p["year"]}-01-01', p['id']))
    payload = {'source': 'TMDB collections with saved named casts', 'collections': collections, 'projectCollections': project_collections, 'ratings': ratings, 'selectedFilmsChecked': len(selected)}
    packed(ROOT / 'data' / 'franchises.json.gz', payload)
    print(json.dumps({'filmsChecked': len(selected), 'collections': len(collections), 'linkedFilms': len(project_collections), 'bytes': (ROOT / 'data' / 'franchises.json.gz').stat().st_size}), flush=True)


if __name__ == '__main__':
    main()
