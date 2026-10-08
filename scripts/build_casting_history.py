"""Build compact year-sharded incumbency from complete saved histories, never only loaded years."""
import gzip,json,pathlib,re,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p):return json.loads(gzip.decompress(p.read_bytes()))
def identity(x):
    x=''.join(c for c in unicodedata.normalize('NFKD',x) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+',' ',re.sub(r'\((?:voice|uncredited)\)','',x,flags=re.I).lower()).strip()
def usable(x):return bool(x) and not re.fullmatch(r'(?:(?:a|an|the) )?(?:man|woman|boy|girl|child|guard|soldier|reporter|doctor|nurse|cop|policeman|dancer|singer|extra|voice|self|himself|herself|uncredited)(?: \d+)?',x)
def main():
    years={y:{} for y in range(1960,2027)}
    shows={p.stem.replace('.json',''):p for p in (ROOT/'data/tv-seasons/shows').glob('*.gz')}
    shows.update({p.stem.replace('.json',''):p for p in (ROOT/'data/filmographies/shows').glob('*.gz')})
    for path in shows.values():
        show=read(path);seen={}
        for season in sorted(show['seasons'],key=lambda s:(s['releaseDate'],s['number'])):
            locks={}
            for r in season.get('roles',[]):
                char=identity(r['character'])
                if not usable(char):continue
                prior=seen.get(char)
                if prior:locks[str(r['index'])]={'firstYear':prior['year'],'firstProjectId':prior['id'],'historicalRecast':prior.get('actor')!=r.get('actorId')}
            if locks:years[season['year']][season['id']]=locks
            for r in season.get('roles',[]):
                char=identity(r['character'])
                if usable(char):seen.setdefault(char,{'year':season['year'],'id':season['id'],'actor':r.get('actorId')})
    franchises=read(ROOT/'data/franchises.json.gz')
    for collection in franchises['collections'].values():
        seen={}
        for p in sorted(collection['parts'],key=lambda p:(p.get('releaseDate') or str(p['year']),p['id'])):
            locks={}
            for r in p['roles']:
                char=identity(r['character']);prior=seen.get(char)
                if usable(char) and prior:locks[str(r['index'])]={'firstYear':prior['year'],'firstProjectId':prior['id'],'historicalRecast':prior['actor']!=r['actor']}
            if locks and p['year'] in years:years[p['year']][p['id']]=locks
            for r in p['roles']:
                char=identity(r['character'])
                if usable(char):seen.setdefault(char,{'year':p['year'],'id':p['id'],'actor':r['actor']})
    out=ROOT/'data/casting-history';out.mkdir(exist_ok=True);(out/'years').mkdir(exist_ok=True)
    for year,projects in years.items():(out/'years'/f'{year}.json.gz').write_bytes(gzip.compress(json.dumps({'year':year,'projects':projects},separators=(',',':')).encode(),mtime=0))
    totals={'projects':sum(len(p) for p in years.values()),'returningRoles':sum(len(r) for p in years.values() for r in p.values())}
    (out/'index.json').write_text(json.dumps({'version':1,'years':list(years),'totals':totals},separators=(',',':'))+'\n')
    print(totals)
if __name__=='__main__':main()
