#!/usr/bin/env python3
"""Permanent acting-credit overlay. Preserve existing project and role identifiers."""
import concurrent.futures
import gzip
import json
import pathlib
import re
import import_tmdb as tmdb
import build_tv_seasons as tv

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'filmographies'


def read(path):
    return json.loads(gzip.decompress(path.read_bytes()))


def acting(character):
    return bool(character.strip()) and not re.search(
        r'\b(self|herself|himself|themselves|host|presenter|musical guest)\b', character, re.I)


def main():
    roster = json.loads((ROOT / 'data' / 'filmography-roster.json').read_text())
    people, selected, archive, seasons = {}, {}, {}, {}
    for folder, bank in [('years', selected), ('archive/years', archive), ('tv-seasons/years', seasons)]:
        for path in sorted((ROOT / 'data' / folder).glob('*.json.gz')):
            for p in read(path)['projects']:
                bank[p['id']] = p
                for r in p['roles']:
                    if r.get('personId') and r.get('birthYear'):
                        people[str(r['personId'])] = {'birthYear': r['birthYear'], 'gender': r['gender']}
    # Unknown secondary performers retain an explicit unknown age rather than invented biographies.
    def profile(pid, cache):
        return cache.get(str(pid), {'birthYear': None, 'gender': 'unspecified'})
    for actor in roster:
        people[str(actor['id'])] = tmdb.person_profile(actor['id'], people)
    tmdb.person_profile = profile
    credits = {}
    excluded = []
    for actor in roster:
        rows = tmdb.request(f"/person/{actor['id']}/combined_credits")['cast']
        for row in rows:
            kind = row.get('media_type')
            date = row.get('release_date' if kind == 'movie' else 'first_air_date') or ''
            reason = None
            if kind not in ('movie', 'tv') or row.get('adult') or not acting(row.get('character') or ''):
                reason = 'non-acting or unnamed credit'
            elif not date or not '1960-01-01' <= date <= '2026-12-31':
                reason = 'undated or outside historical years'
            if reason:
                excluded.append({'actor': actor['name'], 'title': row.get('title') or row.get('name'), 'reason': reason})
                continue
            key = f"tmdb-{kind}-{row['id']}"
            entry = credits.setdefault(key, {'kind': kind, 'row': row, 'actors': []})
            if actor['id'] not in entry['actors']:
                entry['actors'].append(actor['id'])
    years, shows, coverage = {}, {}, []
    tv.CACHE.mkdir(parents=True, exist_ok=True)
    base_index = read(ROOT / 'data' / 'tv-seasons' / 'index.json.gz')
    for i, (sid, entry) in enumerate(sorted(credits.items())):
        print(f"Project {i+1}/{len(credits)}: {sid}", flush=True)
        row, kind = entry['row'], entry['kind']
        p = selected.get(sid) or archive.get(sid)
        if kind == 'movie':
            if p is None:
                p = tmdb.convert(kind, row, int(row['release_date'][:4]), people, 0)
            if p is None:
                raise RuntimeError(f'Missing dated film {sid}')
            if sid not in selected:
                years.setdefault(p['year'], {})[sid] = p
            coverage.append({'id': sid, 'actors': entry['actors'], 'status': 'existing' if sid in selected else 'added'})
            continue
        existing = base_index['shows'].get(sid)
        if existing:
            history = read(ROOT / 'data' / 'tv-seasons' / 'shows' / f'{sid}.json.gz')
            found = {r.get('actorId') for s in history['seasons'] for r in s.get('roles', [])}
            if all(a in found for a in entry['actors']):
                coverage.append({'id': sid, 'actors': entry['actors'], 'status': 'existing seasons'})
                continue
        if p is None:
            p = tmdb.convert(kind, row, int(row['first_air_date'][:4]), people, 0)
        if p is None:
            raise RuntimeError(f'Missing dated series {sid}')
        detail = tv.request(f"/tv/{row['id']}")
        descriptors = [s for s in detail['seasons'] if s['number'] > 0 and s['airDate'] and '1960-01-01' <= s['airDate'] <= '2026-12-31']
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda s: tv.request(f"/tv/{row['id']}/season/{s['number']}?append_to_response=aggregate_credits"), descriptors))
        history = {'id': sid, 'title': p['title'], 'status': detail['status'], 'lastAirDate': detail['lastAirDate'], 'seasons': []}
        for desc, season in zip(descriptors, results):
            date = season['airDate'] or desc['airDate']
            year = int(date[:4])
            pid = f"{sid}-season-{desc['number']}"
            old = seasons.get(pid)
            roles = list(old['roles']) if old else []
            seen = {(r.get('personId'), r['character']) for r in roles}
            for actor in sorted(season['cast'], key=lambda a: (a['order'], a['id'])):
                birth = people.get(str(actor['id']), {}).get('birthYear')
                age = year - birth if birth else None
                for role in actor['roles']:
                    char = role['character'].strip()
                    if not acting(char) or (actor['id'], char) in seen:
                        continue
                    seen.add((actor['id'], char))
                    r = {'character': char, 'actor': actor['name'], 'personId': actor['id'], 'birthYear': birth,
                         'gender': tv.GENDERS.get(actor['gender'], 'unspecified'), 'genderSource': 'canonical_performer',
                         'episodeCount': role['episodeCount'], 'roleType': 'recurring' if role['episodeCount'] >= max(2, season['episodeCount']*.2) else 'guest',
                         'ageMin': max(4, age-9) if age is not None else 4, 'ageMax': min(17 if age < 18 else 100, age+9) if age is not None else 85}
                    if age is not None:
                        r['characterAge'] = age
                    roles.append(r)
            project = dict(old) if old else {'id': pid, 'seriesId': sid, 'seriesTitle': p['title'], 'title': f"{p['title']} · Season {desc['number']}",
                'seasonNumber': desc['number'], 'year': year, 'releaseDate': date, 'finaleDate': season['lastAirDate'] or date,
                'kind': 'TV series', 'genre': p['genre'], 'director': p['director'], 'creditLabel': p.get('creditLabel', 'Created by'),
                'voteCount': p.get('voteCount', 0), 'popularity': p.get('popularity', 0), 'baselineRating': season['rating'],
                'episodeCount': season['episodeCount'], 'source': 'TMDB season aggregate credits'}
            project['roles'] = roles
            years.setdefault(year, {})[pid] = project
            history['seasons'].append({'id': pid, 'number': desc['number'], 'year': year, 'releaseDate': date, 'finaleDate': project['finaleDate'],
                'roles': [{'index': n, 'character': r['character'], 'actorId': r['personId'], 'roleType': r.get('roleType', 'recurring')} for n, r in enumerate(roles)]})
        history['seasons'].sort(key=lambda s: (s['releaseDate'], s['number']))
        tv.packed(OUT / 'shows' / f'{sid}.json.gz', history)
        shows[sid] = {**history, 'seasons': [{k:v for k,v in s.items() if k != 'roles'} for s in history['seasons']]}
        coverage.append({'id': sid, 'actors': entry['actors'], 'status': 'season overlay'})
    for year, projects in years.items():
        tv.packed(OUT / 'years' / f'{year}.json.gz', {'year': year, 'projects': sorted(projects.values(), key=lambda p:p['id'])})
    index = {'version': 1, 'actors': roster, 'years': sorted(years), 'shows': shows, 'coverage': coverage, 'excluded': excluded,
             'totals': {'filmAdditions': sum(p['kind'] == 'Film' for ps in years.values() for p in ps.values()), 'seriesOverlays': len(shows), 'seasonOverlays': sum(len(s['seasons']) for s in shows.values())}}
    (OUT / 'index.json').write_text(json.dumps(index, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(json.dumps(index['totals']), flush=True)


if __name__ == '__main__':
    main()
