"""Creation policies and adapters for local, read-only source inspection."""
from abc import ABC, abstractmethod
from hashlib import sha256
from pathlib import Path
from threading import Lock
import os
import tempfile
from .model import SourceRecord


class AuditDefaults:
    """Singleton scoped to this offline tool: immutable decoding defaults, no user/session data."""
    __slots__ = ()
    _instance = None
    _lock = Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
            return cls._instance

    @property
    def encoding(self):
        return 'utf-8'

    @property
    def errors(self):
        return 'replace'


class Utf8Reader:
    def __init__(self, root, kinds):
        self.root, self.kinds = root, kinds

    def read(self, path):
        defaults = AuditDefaults()
        text = (self.root/path).read_text(encoding=defaults.encoding, errors=defaults.errors)
        return SourceRecord(path, self.kinds.get(Path(path).suffix), text, len(text.splitlines()))


class ScopedReader:
    """Proxy protects the source root, including symlink traversal, before delegating I/O."""
    def __init__(self, root, delegate):
        self.root, self.delegate = root.resolve(), delegate

    def read(self, path):
        if not (self.root/path).resolve().is_relative_to(self.root):
            raise ValueError('Audit source escapes its repository root')
        return self.delegate.read(path)


class DigestReader:
    """Decorator adds provenance without changing decoding or classification semantics."""
    def __init__(self, delegate):
        self.delegate = delegate

    def read(self, path):
        record = self.delegate.read(path)
        return record.clone(sha256=sha256(record.text.encode('utf-8')).hexdigest())


class ReaderCreator(ABC):
    """Factory Method: creation varies independently of the creator's reading operation."""
    @abstractmethod
    def create_reader(self):
        raise NotImplementedError

    def read(self, path):
        return self.create_reader().read(path)


class LocalReaderCreator(ReaderCreator):
    def __init__(self, root, kinds):
        self.root, self.kinds = root, kinds

    def create_reader(self):
        return DigestReader(ScopedReader(self.root, Utf8Reader(self.root, self.kinds)))


class CsvReportAdapter:
    """Adapter from immutable audit reports to the repository's existing write_csv contract."""
    def __init__(self, write_csv):
        self.write_csv = write_csv

    def write(self, output, report):
        output.parent.mkdir(parents=True, exist_ok=True)
        handle, name = tempfile.mkstemp(prefix='.fai-audit-', dir=output.parent)
        os.close(handle)
        temporary = Path(name)
        try:
            rows = [{'path':r.path, 'physical_lines':r.lines, 'band':r.band, 'action':r.action}
                    for r in report.records]
            self.write_csv(temporary, rows, ['path','physical_lines','band','action'])
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)


class AuditFamily(ABC):
    """Abstract Factory: matching reader creators and report sinks form one I/O family."""
    @abstractmethod
    def reader_creator(self, root, kinds):
        raise NotImplementedError

    @abstractmethod
    def writer(self):
        raise NotImplementedError


class LocalAuditFamily(AuditFamily):
    def __init__(self, write_csv):
        self.write_csv = write_csv

    def reader_creator(self, root, kinds):
        return LocalReaderCreator(root, kinds)

    def writer(self):
        return CsvReportAdapter(self.write_csv)
