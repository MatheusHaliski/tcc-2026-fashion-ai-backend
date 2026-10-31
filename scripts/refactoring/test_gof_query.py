import unittest
from scripts.refactoring.gof.model import FileKind, SourceRecord
from scripts.refactoring.gof.query import QueryParser


class AuditQueryTest(unittest.TestCase):
    record = SourceRecord('sample.py', FileKind('.py'), '', 601, 'HIGH')

    def test_default_expression_includes_every_source(self):
        self.assertTrue(QueryParser('').parse().matches(self.record))

    def test_comparison_precedence_and_parentheses(self):
        for text in ['lines > 600', 'lines >= 601 and band = HIGH',
                     'band = CRITICAL or lines > 600 and lines < 700',
                     '(band = CRITICAL or band = HIGH) and lines != 600']:
            with self.subTest(text=text):
                self.assertTrue(QueryParser(text).parse().matches(self.record))
        self.assertFalse(QueryParser('lines <= 600 or band == CRITICAL').parse().matches(self.record))

    def test_invalid_queries_fail_explicitly_without_evaluation(self):
        for text in ['lines >', 'lines > -1', 'path = secret', '__import__(os)',
                     'lines > 1; drop', '(lines > 1', 'band > HIGH', 'lines > 1 junk', 'x'*513]:
            with self.subTest(text=text), self.assertRaises(ValueError):
                QueryParser(text).parse()
