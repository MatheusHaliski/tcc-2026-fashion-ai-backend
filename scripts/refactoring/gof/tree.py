"""Composite report structure, explicit traversal and extensible visitors."""
from collections import Counter
from dataclasses import dataclass


@dataclass(frozen=True)
class SourceLeaf:
    record: object

    def accept(self, visitor):
        visitor.visit_file(self)


@dataclass(frozen=True)
class SourceGroup:
    name: str
    children: tuple

    def accept(self, visitor):
        visitor.visit_group(self)
        for child in self.children:
            child.accept(visitor)

    def __iter__(self):
        return SourceIterator(self)


class SourceIterator:
    """Iterator over leaves: stable depth-first traversal without exposing child storage."""
    def __init__(self, root):
        self._stack = [iter(root.children)]

    def __iter__(self):
        return self

    def __next__(self):
        while self._stack:
            try:
                node = next(self._stack[-1])
            except StopIteration:
                self._stack.pop()
                continue
            if isinstance(node, SourceGroup):
                self._stack.append(iter(node.children))
            else:
                return node.record
        raise StopIteration


def source_tree(report):
    groups = {}
    for record in report.records:
        groups.setdefault(record.kind.suffix, []).append(SourceLeaf(record))
    return SourceGroup('repository', tuple(SourceGroup(kind, tuple(leaves))
                       for kind, leaves in sorted(groups.items())))


class BandSummary:
    """Visitor: summary changes do not modify composite nodes or the file reader."""
    def __init__(self):
        self.bands, self.kinds = Counter(), Counter()

    def visit_group(self, group):
        pass

    def visit_file(self, leaf):
        self.bands[leaf.record.band] += 1
        self.kinds[leaf.record.kind.suffix] += 1

    def result(self):
        return dict(sorted(self.bands.items()))
