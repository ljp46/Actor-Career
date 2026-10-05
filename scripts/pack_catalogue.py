"""Publish lossless compressed copies of all saved years, leaving backups intact."""
import gzip
import hashlib
import json
import pathlib
from build_manifest import main as build_manifest

ROOT = pathlib.Path(__file__).resolve().parents[1]
YEARS = ROOT / 'data' / 'years'

def main():
    expected = set(range(1960, 2027))
    found = {int(p.stem) for p in YEARS.glob('[0-9][0-9][0-9][0-9].json')}
    if found != expected:
        raise ValueError(f'Missing or unexpected years: {expected ^ found}')
    build_manifest()
    manifest = json.loads((YEARS / 'index.json').read_text())
    manifest['compression'] = 'gzip'
    manifest['files'] = {}
    raw_total = packed_total = 0
    for year in sorted(expected):
        path = YEARS / f'{year}.json'
        raw = path.read_bytes()
        payload = json.loads(raw)
        if payload['year'] != year or not payload.get('projects'):
            raise ValueError(f'Invalid year {year}')
        ids = [p['id'] for p in payload['projects']]
        if len(ids) != len(set(ids)):
            raise ValueError(f'Duplicate production IDs in {year}')
        for project in payload['projects']:
            if project['year'] != year or not project.get('roles'):
                raise ValueError(f'Invalid production in {year}')
            for role in project['roles']:
                if not role.get('character') or not role.get('actor'):
                    raise ValueError(f'Invalid role in {year}')
        packed = gzip.compress(raw, compresslevel=9, mtime=0)
        if gzip.decompress(packed) != raw:
            raise ValueError(f'Compression changed year {year}')
        (YEARS / f'{year}.json.gz').write_bytes(packed)
        manifest['files'][str(year)] = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw), 'compressedBytes': len(packed)}
        raw_total += len(raw)
        packed_total += len(packed)
        path.unlink()
    (YEARS / 'index.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(json.dumps({'years': len(found), **manifest['totals'], 'rawBytes': raw_total, 'compressedBytes': packed_total}))

if __name__ == '__main__':
    main()
