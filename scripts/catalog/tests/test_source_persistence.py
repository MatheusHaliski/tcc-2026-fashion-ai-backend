import unittest
from scripts.catalog.source_persistence import allows_persistence

class SourcePersistenceTest(unittest.TestCase):
    def sources(self, domain='www.Brand.Example'):
        return [{'domain':domain, 'active':True, 'allows_image_persistence':True}]

    def test_cdn_and_normalized_domain_match(self):
        self.assertTrue(allows_persistence(self.sources(), 'https://cdn.brand.example/a.jpg', None))
        self.assertTrue(allows_persistence(self.sources(), 'https://unrelated.example/a.jpg', 'www.brand.example'))

    def test_suffix_attacks_and_disabled_sources_fail(self):
        for host in ['evilbrand.example', 'brand.example.evil.com']:
            self.assertFalse(allows_persistence(self.sources(), 'https://'+host+'/a.jpg', None))
        for field in ['active', 'allows_image_persistence']:
            sources=self.sources();sources[0][field]=False
            self.assertFalse(allows_persistence(sources,'https://brand.example/a.jpg',None))
