import unittest
from scripts.catalog.source_persistence import allows_persistence

class SourcePersistenceTest(unittest.TestCase):
    def sources(self, domain='www.Brand.Example'):
        return [{'domain':domain, 'active':True, 'allows_image_persistence':True}]

    def test_cdn_and_normalized_domain_match(self):
        self.assertTrue(allows_persistence(self.sources(), 'https://cdn.brand.example/a.jpg', None))
        self.assertFalse(allows_persistence(self.sources(), 'https://unrelated.example/a.jpg', 'www.brand.example'))

    def test_suffix_attacks_and_disabled_sources_fail(self):
        for host in ['evilbrand.example', 'brand.example.evil.com']:
            self.assertFalse(allows_persistence(self.sources(), 'https://'+host+'/a.jpg', None))
        for field in ['active', 'allows_image_persistence']:
            sources=self.sources();sources[0][field]=False
            self.assertFalse(allows_persistence(sources,'https://brand.example/a.jpg',None))

class SqlAuthorityTest(unittest.TestCase):
    def sql_allowed(self, url):
        # SQL no longer derives eligibility. It only returns same-brand sources.
        # Exercise the inventory's source JSON path with the shared decision function.
        import json
        from scripts.catalog.catalog_image_inventory import _SELECT
        from scripts.catalog.source_persistence import source_decision
        self.assertIn('s.brand_id=p.brand_id', _SELECT)
        self.assertIn('JSON_ARRAYAGG', _SELECT)
        self.assertNotIn('SUBSTRING_INDEX', _SELECT)
        sources = json.loads('[{"domain":"brand.example","active":1,"allows_image_persistence":1}]')
        return source_decision(sources,url)['state'] == 'AUTHORIZED'

    def test_sql_and_python_match_only_authority(self):
        sources = [{'domain':'brand.example','active':True,'allows_image_persistence':True}]
        cases = {
            'https://evil.example?x=.brand.example': False,
            'https://evil.example#x=.brand.example': False,
            'https://evil.example?x=/a.brand.example': False,
            'https://brand.example@evil.example': False,
            'https://evil.example/path/.brand.example': False,
            'https://brand.example.evil.example': False,
            'https://cdn.brand.example': True,
            'https://cdn.brand.example?x=1#fragment': True,
            'https://cdn.brand.example:443': True,
            'https://user@cdn.brand.example:443/path': False,
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(self.sql_allowed(url), expected)
                self.assertEqual(allows_persistence(sources,url,None), expected)

    def test_unknown_explicit_denial_and_trailing_dot(self):
        from scripts.catalog.source_persistence import source_decision
        unknown=[{'domain':'brand.example','active':1,'allows_image_persistence':0}]
        self.assertEqual(source_decision(unknown,'https://brand.example')['state'],'UNKNOWN')
        unknown[0]['authorization_state']='DENIED'
        self.assertEqual(source_decision(unknown,'https://brand.example')['state'],'DENIED')
        self.assertTrue(self.sql_allowed('https://CDN.BRAND.EXAMPLE.:443?x=1'))
        self.assertFalse(self.sql_allowed('http://brand.example'))
        self.assertFalse(self.sql_allowed('https://brand.example:444'))
