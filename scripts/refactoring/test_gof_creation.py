from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib
import tempfile
import unittest
from scripts.refactoring.gof.creation import AuditDefaults, CsvReportAdapter, LocalAuditFamily
from scripts.refactoring.gof.facade import AuditFacade
from scripts.refactoring.gof.model import AuditReport, FileKinds, SourceRecord
from scripts.refactoring.inventory_gof import write_csv
from scripts.refactoring.line_policy import review_action, size_band


class AuditCreationTest(unittest.TestCase):
    def test_singleton_defaults_are_process_local_immutable_and_thread_safe(self):
        with ThreadPoolExecutor(max_workers=4) as executor:
            values = list(executor.map(lambda _:AuditDefaults(), range(30)))
        self.assertTrue(all(value is values[0] for value in values))
        self.assertEqual(values[0].encoding, 'utf-8')
        with self.assertRaises(AttributeError): values[0].encoding = 'ascii'

    def test_factory_products_decorate_provenance_and_proxy_rejects_symlink_escape(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as external:
            root = Path(tmp); (root/'one.py').write_text('value = 1\n')
            (Path(external)/'outside.py').write_text('outside')
            (root/'link.py').symlink_to(Path(external)/'outside.py')
            family = LocalAuditFamily(write_csv)
            creator = family.reader_creator(root, FileKinds())
            record = creator.read('one.py')
            self.assertEqual(record.sha256, hashlib.sha256(b'value = 1\n').hexdigest())
            self.assertEqual(record.lines, 1)
            with self.assertRaises(ValueError): creator.read('link.py')
            family.writer().write(root/'out.csv', AuditReport((record,)))
            self.assertTrue((root/'out.csv').read_text().startswith('path,physical_lines,band,action\n'))

    def test_csv_adapter_preserves_previous_artifact_if_existing_writer_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); output = root/'out.csv'; output.write_text('previous')
            def fail(path, rows, columns):
                path.write_text('partial')
                raise OSError('disk fixture')
            with self.assertRaisesRegex(OSError, 'disk fixture'):
                CsvReportAdapter(fail).write(output, AuditReport(()))
            self.assertEqual(output.read_text(), 'previous')
            self.assertEqual(sorted(p.name for p in root.iterdir()), ['out.csv'])

    def test_facade_preserves_legacy_bytes_counts_and_empty_inventory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'b.py').write_text('# b\n'*251)
            (root/'a.ts').write_text('export const x = 1;\n')
            paths = ['b.py','a.ts']; expected = []
            for path in paths:
                lines = len((root/path).read_text().splitlines())
                expected.append({'path':path,'physical_lines':lines,'band':size_band(lines),
                                 'action':review_action(path, lines)})
            write_csv(root/'legacy.csv', sorted(expected,key=lambda r:(-r['physical_lines'],r['path'])),
                      ['path','physical_lines','band','action'])
            facade = AuditFacade.local(write_csv, size_band, review_action)
            self.assertEqual(facade.report(root, paths, root/'new.csv'),
                             {'REVIEW':1,'WITHIN_GENERAL_TARGET':1})
            self.assertEqual((root/'new.csv').read_bytes(), (root/'legacy.csv').read_bytes())
            self.assertEqual(dict(facade.telemetry), {'started':1,'processed':2,'completed':1})
            self.assertEqual(facade.report(root, [], root/'empty.csv'), {})
            self.assertEqual((root/'empty.csv').read_text(), 'path,physical_lines,band,action\n')

    def test_facade_uses_a_matching_alternative_abstract_factory_family(self):
        from scripts.refactoring.gof.creation import AuditFamily, ReaderCreator
        captured = []
        class MemoryCreator(ReaderCreator):
            def create_reader(self):
                return self
            def read(self, path):
                return SourceRecord(path, FileKinds().get('.py'), '', 1)
        class MemoryWriter:
            def write(self, output, report): captured.append(report)
        class MemoryFamily(AuditFamily):
            def reader_creator(self, root, kinds): return MemoryCreator()
            def writer(self): return MemoryWriter()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'one.py').write_text('')
            result = AuditFacade(MemoryFamily(), size_band, review_action).report(root, ['one.py'], root/'unused')
            self.assertEqual(result, {'WITHIN_GENERAL_TARGET':1})
            self.assertEqual(captured[0].records[0].path, 'one.py')
            self.assertFalse((root/'unused').exists())
