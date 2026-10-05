import pathlib
import sys
import unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / 'scripts'))
from curate_catalogue import select_projects

class CurationTests(unittest.TestCase):
    def test_separate_limits_retain_every_role_and_canonical_ids(self):
        projects = [{'id':f'{kind}-{i}', 'kind':kind, 'title':str(i), 'voteCount':i, 'popularity':1000-i, 'roles':[{'actor':'A'}, {'actor':'B'}]} for kind, count in [('Film',150),('TV series',70)] for i in range(count)]
        chosen = select_projects(projects)
        films = [p for p in chosen if p['kind']=='Film']
        tv = [p for p in chosen if p['kind']=='TV series']
        self.assertEqual((len(films),len(tv)), (100,30))
        self.assertEqual(films[0]['id'], 'Film-149')
        self.assertEqual(films[-1]['id'], 'Film-50')
        self.assertEqual(tv[-1]['id'], 'TV series-40')
        self.assertTrue(all(p in projects and len(p['roles'])==2 for p in chosen))
    def test_small_years_are_not_padded_and_selection_is_deterministic(self):
        projects=[{'id':'b','kind':'Film','roles':[{}]}, {'id':'a','kind':'Film','roles':[{}]}, {'id':'empty','kind':'Film','roles':[]}]
        self.assertEqual([p['id'] for p in select_projects(projects)], ['a','b'])
        self.assertEqual(select_projects(projects),select_projects(list(reversed(projects))))

if __name__ == '__main__': unittest.main()
