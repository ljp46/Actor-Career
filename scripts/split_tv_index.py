#!/usr/bin/env python3
"""Split the already saved full season index without contacting TMDB."""
import gzip
import json
import pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
PATH = ROOT / 'data' / 'tv-seasons' / 'index.json.gz'


def packed(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode(), compresslevel=9, mtime=0))


def main():
    data = json.loads(gzip.decompress(PATH.read_bytes()))
    for show in data['shows'].values():
        target = ROOT / 'data' / 'tv-seasons' / 'shows' / f"{show['id']}.json.gz"
        if show['seasons'] and 'roles' not in show['seasons'][0]:
            if not target.exists():
                raise ValueError('An already compact index needs its saved show file.')
            continue
        packed(target, show)
        show['seasons'] = [{k: v for k, v in season.items() if k != 'roles'} for season in show['seasons']]
    packed(PATH, data)
    print(json.dumps({'startupBytes': PATH.stat().st_size, 'shows': len(data['shows']), 'totals': data['totals']}))


if __name__ == '__main__':
    main()
