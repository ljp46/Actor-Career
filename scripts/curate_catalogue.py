#!/usr/bin/env python3
"""Select a small recognisable catalogue without another TMDB import.

Audience vote count measures recognition; stored popularity breaks ties.
Budgets are not in the saved dataset, so this does not pretend to classify indies.
Complete original shards are kept separately for previously booked roles.
"""
import gzip
import hashlib
import json
import pathlib
import shutil
from build_manifest import main as build_manifest

ROOT = pathlib.Path(__file__).resolve().parents[1]
YEARS = ROOT / 'data' / 'years'
ARCHIVE = ROOT / 'data' / 'archive' / 'years'
FILM_LIMIT = 100
TV_LIMIT = 30


def select_projects(projects, film_limit=FILM_LIMIT, tv_limit=TV_LIMIT):
    def ranked(kind, limit):
        eligible = [p for p in projects if p['kind'] == kind and p.get('roles')]
        return sorted(eligible, key=lambda p: (-(p.get('voteCount') or 0), -(p.get('popularity') or 0), p['id']))[:limit]
    return ranked('Film', film_limit) + ranked('TV series', tv_limit)


def main():
    index_path = YEARS / 'index.json'
    previous = json.loads(index_path.read_text())
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    files, counts = {}, {}
    archive_files = previous.get('archive', {}).get('files', previous['files'])
    for year in previous['years']:
        path = YEARS / f'{year}.json.gz'
        backup = ARCHIVE / path.name
        if not backup.exists():
            shutil.copyfile(path, backup)
        raw = gzip.decompress(backup.read_bytes())
        assert hashlib.sha256(raw).hexdigest() == archive_files[str(year)]['sha256']
        source = json.loads(raw)
        projects = select_projects(source['projects'])
        # Keep every credited role and canonical ID unchanged.
        payload = {**source, 'projects': projects}
        curated = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode()
        packed = gzip.compress(curated, compresslevel=9, mtime=0)
        path.write_bytes(packed)
        files[str(year)] = {'sha256': hashlib.sha256(curated).hexdigest(), 'bytes': len(curated), 'compressedBytes': len(packed)}
        counts[str(year)] = {'films': sum(p['kind'] == 'Film' for p in projects), 'tv': sum(p['kind'] == 'TV series' for p in projects), 'originalProjects': len(source['projects'])}
        print(f'{year}: {len(projects)} selected from {len(source["projects"])}', flush=True)
    previous['files'] = files
    previous['selection'] = {'filmLimit': FILM_LIMIT, 'tvLimit': TV_LIMIT, 'ranking': 'audience vote count, then stored popularity', 'byYear': counts}
    previous['archive'] = {'path': 'data/archive/years', 'files': archive_files, 'totals': previous.get('archive', {}).get('totals', previous['totals'])}
    index_path.write_text(json.dumps(previous, separators=(',', ':')) + '\n')
    build_manifest()
    print('Curated gzip bytes:', sum(f['compressedBytes'] for f in files.values()))


if __name__ == '__main__':
    main()
