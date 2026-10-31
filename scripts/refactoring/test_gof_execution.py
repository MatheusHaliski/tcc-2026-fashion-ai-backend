from pathlib import Path
import tempfile
import unittest
from scripts.refactoring.gof.execution import (AuditCoordinator, CheckedSourceScan, Complete,
    Events, Failed, LinePipeline, LineStrategy, PresentFile, RelativePath, Running, SourceScan)
from scripts.refactoring.gof.model import FileKind, SourceRecord
from scripts.refactoring.gof.query import QueryParser


class MemoryReader:
    def __init__(self):
        self.paths = []

    def read(self, path):
        self.paths.append(path)
        if path == 'broken.py':
            raise ValueError('corrupt fixture')
        return SourceRecord(path, FileKind('.py'), '', 500)


class AuditExecutionTest(unittest.TestCase):
    def pipeline(self, reader):
        return LinePipeline(SourceScan(reader), LineStrategy(lambda n:'PRIORITY', lambda p,n:'review'))

    def test_chain_rejects_paths_before_io_and_bridge_accepts_another_reader(self):
        reader = MemoryReader()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'ok.py').write_text('x')
            scan = CheckedSourceScan(root, reader, RelativePath(PresentFile()))
            for invalid in ['../escape.py', '/tmp/absolute.py']:
                with self.assertRaises(ValueError): scan.scan(invalid)
            with self.assertRaises(FileNotFoundError): scan.scan('missing.py')
            self.assertEqual(reader.paths, [])
            self.assertEqual(scan.scan('ok.py').path, 'ok.py')

    def test_template_and_strategy_apply_existing_policy_after_read(self):
        reader = MemoryReader()
        result = self.pipeline(reader).run('one.py')
        self.assertEqual(reader.paths, ['one.py'])
        self.assertEqual((result.lines, result.band, result.action), (500, 'PRIORITY', 'review'))

    def test_mediator_state_observers_and_commands_roll_back_failure_then_allow_retry(self):
        events = Events(); observed = []
        stop = events.subscribe(observed.append)
        coordinator = AuditCoordinator(self.pipeline(MemoryReader()), QueryParser('').parse(), events)
        with self.assertRaisesRegex(ValueError, 'corrupt fixture'):
            coordinator.run(['one.py', 'broken.py'])
        self.assertIsInstance(coordinator.state, Failed)
        self.assertEqual(coordinator.builder.build().records, ())
        self.assertEqual(observed, ['started','processed','failed'])
        report = coordinator.run(['one.py'])
        self.assertEqual(len(report.records), 1)
        self.assertIsInstance(coordinator.state, Complete)
        with self.assertRaises(RuntimeError): coordinator.run(['one.py'])
        stop(); events.emit('detached')
        self.assertNotIn('detached', observed)

    def test_interpreter_filters_only_when_explicitly_requested(self):
        coordinator = AuditCoordinator(self.pipeline(MemoryReader()),
                                       QueryParser('lines > 1000').parse(), Events())
        self.assertEqual(coordinator.run(['one.py']).records, ())

    def test_state_disallows_completion_before_start(self):
        from scripts.refactoring.gof.execution import Ready
        with self.assertRaises(RuntimeError): Ready().complete()
        self.assertIsInstance(Ready().start(), Running)

    def test_failing_observer_does_not_hide_the_original_read_error(self):
        events = Events()
        def fail_on_failure(event):
            if event == 'failed':
                raise OSError('observer fixture')
        events.subscribe(fail_on_failure)
        coordinator = AuditCoordinator(self.pipeline(MemoryReader()), QueryParser('').parse(), events)
        with self.assertRaisesRegex(ValueError, 'corrupt fixture') as raised:
            coordinator.run(['one.py', 'broken.py'])
        self.assertEqual(coordinator.builder.build().records, ())
        self.assertIn('OSError', raised.exception.__notes__[0])
