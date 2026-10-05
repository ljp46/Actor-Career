#!/usr/bin/env python3
"""Keep only demonstrably recurring character links in the startup index.

Full named casts remain in year/lazy production files. Original role indices are
never renumbered. This pass does not contact TMDB.
"""
import collections
import gzip
import json
import pathlib
import re
import unicodedata

PATH = pathlib.Path(__file__).resolve().parents[1] / 'data' / 'franchises.json.gz'


def character_key(name):
    text = unicodedata.normalize('NFKD', name)
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r'\((?:voice|uncredited)\)', '', text, flags=re.I).lower()
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def compact(data):
    for collection in data['collections'].values():
        counts = collections.Counter()
        for part in collection['parts']:
            counts.update(set(character_key(r['character']) for r in part['roles']))
        for part in collection['parts']:
            part['roles'] = [r for r in part['roles'] if character_key(r['character']) and counts[character_key(r['character'])] >= 2]
    data['indexPurpose'] = 'Recurring character links only; full original role indices retained.'
    return data


def main():
    before = PATH.stat().st_size
    data = compact(json.loads(gzip.decompress(PATH.read_bytes())))
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()
    PATH.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
    print(json.dumps({'franchiseBytesBefore': before, 'franchiseBytesAfter': PATH.stat().st_size}))


if __name__ == '__main__':
    main()
