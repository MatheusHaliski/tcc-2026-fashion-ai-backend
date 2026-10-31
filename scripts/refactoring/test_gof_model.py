import unittest
from scripts.refactoring.gof.model import AddRecord, FileKinds, ReportBuilder, SourceRecord
from scripts.refactoring.gof.tree import BandSummary, SourceGroup, source_tree


class AuditModelTest(unittest.TestCase):
    def setUp(self):
        self.kinds = FileKinds()
        self.record = SourceRecord('one.py', self.kinds.get('.py'), '# x\n', 1,
                                   'WITHIN_GENERAL_TARGET', 'review')

    def test_prototype_preserves_source_and_flyweights_while_changing_policy_view(self):
        view = self.record.clone(band='HIGH')
        self.assertEqual(self.record.band, 'WITHIN_GENERAL_TARGET')
        self.assertEqual(view.band, 'HIGH')
        self.assertIs(view.kind, self.kinds.get('.py'))
        self.assertIs(view.text, self.record.text)
        with self.assertRaises(AttributeError):
            view.lines = 10

    def test_builder_snapshot_restores_all_records_and_final_result_is_independent(self):
        builder = ReportBuilder(); builder.add(self.record)
        snapshot = builder.checkpoint()
        builder.add(self.record.clone(path='second.py', lines=900, band='HIGH'))
        report = builder.build()
        self.assertEqual([r.path for r in report.records], ['second.py', 'one.py'])
        builder.restore(snapshot)
        self.assertEqual(len(builder.build().records), 1)
        self.assertEqual(len(report.records), 2)

    def test_commands_are_reversible_once_and_enforce_stack_order(self):
        builder = ReportBuilder()
        first = AddRecord(builder, self.record)
        second = AddRecord(builder, self.record.clone(path='two.py'))
        with self.assertRaises(RuntimeError):
            first.undo()
        first.execute(); second.execute()
        with self.assertRaises(RuntimeError):
            first.execute()
        with self.assertRaises(RuntimeError):
            first.undo()
        second.undo(); first.undo()
        self.assertEqual(builder.build().records, ())

    def test_composite_visitor_and_iterator_cover_nested_files_once(self):
        builder = ReportBuilder(); builder.add(self.record)
        builder.add(self.record.clone(path='b.ts', kind=self.kinds.get('.ts'), band='HIGH'))
        tree = SourceGroup('outer', (SourceGroup('empty', ()), source_tree(builder.build())))
        visitor = BandSummary(); tree.accept(visitor)
        self.assertEqual(visitor.result(), {'HIGH': 1, 'WITHIN_GENERAL_TARGET': 1})
        self.assertEqual(sorted(r.path for r in tree), ['b.ts', 'one.py'])
        self.assertEqual(list(SourceGroup('empty', ())), [])
