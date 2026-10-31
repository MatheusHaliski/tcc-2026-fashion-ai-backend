"""Immutable audit records, report construction and reversible assembly; no application imports."""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class FileKind:
    suffix: str


class FileKinds:
    """Flyweight: share immutable kind metadata across the entire source inventory."""
    def __init__(self):
        self._kinds = {}

    def get(self, suffix):
        if suffix not in self._kinds:
            self._kinds[suffix] = FileKind(suffix)
        return self._kinds[suffix]


@dataclass(frozen=True)
class SourceRecord:
    path: str
    kind: FileKind
    text: str
    lines: int
    band: str = ''
    action: str = ''
    sha256: str = ''

    def clone(self, **changes):
        """Prototype: policy views share immutable source content, never mutate the original."""
        return replace(self, **changes)


@dataclass(frozen=True)
class ReportSnapshot:
    """Memento of in-memory assembly; not a database or filesystem backup."""
    records: tuple[SourceRecord, ...]


@dataclass(frozen=True)
class AuditReport:
    records: tuple[SourceRecord, ...]


class ReportBuilder:
    """Builder separates incremental observation from a complete immutable result."""
    def __init__(self):
        self._records = []

    def add(self, record):
        self._records.append(record)

    def remove_last(self, record):
        if not self._records or self._records[-1] is not record:
            raise RuntimeError('Commands must be undone in reverse execution order')
        self._records.pop()

    def checkpoint(self):
        return ReportSnapshot(tuple(self._records))

    def restore(self, snapshot):
        self._records = list(snapshot.records)

    def build(self):
        return AuditReport(tuple(sorted(self._records, key=lambda r: (-r.lines, r.path))))


class AddRecord:
    """Command: explicit, reversible assembly operation, separate from source-file I/O."""
    def __init__(self, builder, record):
        self.builder, self.record, self.executed = builder, record, False

    def execute(self):
        if self.executed:
            raise RuntimeError('Record command already executed')
        self.builder.add(self.record)
        self.executed = True

    def undo(self):
        if not self.executed:
            raise RuntimeError('Record command not executed')
        self.builder.remove_last(self.record)
        self.executed = False
