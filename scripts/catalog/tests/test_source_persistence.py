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

class SqlAuthorityTest(unittest.TestCase):
    def sql_allowed(self, url):
        import sqlite3
        from scripts.catalog.source_persistence import SOURCE_MATCH_SQL
        def substring_index(value, delimiter, count):
            if value is None: return None
            parts = value.split(delimiter)
            return delimiter.join(parts[:count] if count > 0 else parts[count:])
        with sqlite3.connect(':memory:') as conn:
            conn.create_function('SUBSTRING_INDEX', 3, substring_index)
            conn.create_function('sql_left', 2, lambda x,n: x[:n] if x is not None else None)
            conn.create_function('sql_right', 2, lambda x,n: x[-n:] if x is not None else None)
            conn.create_function('CHAR_LENGTH', 1, lambda x: len(x) if x is not None else None)
            conn.create_function('CONCAT', 2, lambda x,y: x+y if x is not None and y is not None else None)
            conn.execute('CREATE TABLE i (image_url TEXT, source_domain TEXT)')
            conn.execute('CREATE TABLE s (domain TEXT)')
            conn.execute('INSERT INTO i VALUES (?,NULL)', (url,))
            conn.execute("INSERT INTO s VALUES ('brand.example')")
            expression = SOURCE_MATCH_SQL.replace('LEFT(', 'sql_left(').replace('RIGHT(', 'sql_right(')
            return bool(conn.execute('SELECT '+expression+' FROM i,s').fetchone()[0])

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
            'https://user@cdn.brand.example:443/path': True,
        }
        for url, expected in cases.items():
            with self.subTest(url=url):
                self.assertEqual(self.sql_allowed(url), expected)
                self.assertEqual(allows_persistence(sources,url,None), expected)
