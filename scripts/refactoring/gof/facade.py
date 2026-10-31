"""Facade for the executable 23-pattern audit flow; local tooling only, never product rules."""
from collections import Counter
from .creation import LocalAuditFamily
from .execution import (AuditCoordinator, CheckedSourceScan, Events, LinePipeline,
                        LineStrategy, PresentFile, RelativePath)
from .model import FileKinds
from .query import QueryParser
from .tree import BandSummary, source_tree


class AuditFacade:
    def __init__(self, family, band, action):
        self.family, self.band, self.action = family, band, action
        self.telemetry = Counter()

    @classmethod
    def local(cls, write_csv, band, action):
        return cls(LocalAuditFamily(write_csv), band, action)

    def report(self, root, paths, output, query=''):
        events = Events()
        unsubscribe = events.subscribe(self._observe)
        try:
            scan = CheckedSourceScan(root, self.family.reader_creator(root, FileKinds()),
                                     RelativePath(PresentFile()))
            pipeline = LinePipeline(scan, LineStrategy(self.band, self.action))
            coordinator = AuditCoordinator(pipeline, QueryParser(query).parse(), events)
            report = coordinator.run(paths)
            tree, visitor = source_tree(report), BandSummary()
            tree.accept(visitor)
            # Iterator checks cardinality without exposing or mutating composite internals.
            if sum(1 for _ in tree) != len(report.records):
                raise RuntimeError('Report tree does not cover every accepted record')
            self.family.writer().write(output, report)
            return visitor.result()
        finally:
            unsubscribe()

    def _observe(self, name):
        self.telemetry[name] += 1
