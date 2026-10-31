"""Read-only scan collaboration: validation, state, events and transactional report assembly."""
from abc import ABC, abstractmethod
from pathlib import Path
from .model import AddRecord, ReportBuilder


class ValidationStep:
    """Chain of Responsibility: ordered validation fails before a source is read."""
    def __init__(self, following=None):
        self.following = following

    def handle(self, root, path):
        self.check(root, path)
        if self.following:
            self.following.handle(root, path)

    def check(self, root, path):
        raise NotImplementedError


class RelativePath(ValidationStep):
    def check(self, root, path):
        if Path(path).is_absolute() or '..' in Path(path).parts:
            raise ValueError('Expected a repository-relative audit source')


class PresentFile(ValidationStep):
    def check(self, root, path):
        if not (root/path).is_file():
            raise FileNotFoundError(path)


class SourceScan:
    """Bridge: scan abstraction is independent of the reader implementation/factory."""
    def __init__(self, reader):
        self.reader = reader

    def scan(self, path):
        return self.reader.read(path)


class CheckedSourceScan(SourceScan):
    def __init__(self, root, reader, validations):
        super().__init__(reader)
        self.root, self.validations = root, validations

    def scan(self, path):
        self.validations.handle(self.root, path)
        return super().scan(path)


class LineStrategy:
    """Strategy adapts the existing line policy; no duplicated thresholds."""
    def __init__(self, band, action):
        self.band, self.action = band, action

    def classify(self, record):
        return record.clone(band=self.band(record.lines), action=self.action(record.path, record.lines))


class FilePipeline(ABC):
    """Template Method fixes scan → classify; the policy hook stays replaceable."""
    def __init__(self, scan):
        self.scan = scan

    def run(self, path):
        return self.classify(self.scan.scan(path))

    @abstractmethod
    def classify(self, record):
        raise NotImplementedError


class LinePipeline(FilePipeline):
    def __init__(self, scan, strategy):
        super().__init__(scan)
        self.strategy = strategy

    def classify(self, record):
        return self.strategy.classify(record)


class Events:
    """Observer: listeners consume lifecycle events without being coupled to the scanner."""
    def __init__(self):
        self._listeners = []

    def subscribe(self, callback):
        self._listeners.append(callback)
        return lambda: self._listeners.remove(callback)

    def emit(self, name):
        for callback in tuple(self._listeners):
            callback(name)


class ScanState:
    def start(self):
        raise RuntimeError('Audit session cannot start in this state')

    def complete(self):
        raise RuntimeError('Only a running audit can complete')

    def fail(self):
        return Failed()


class Ready(ScanState):
    def start(self):
        return Running()


class Running(ScanState):
    def complete(self):
        return Complete()


class Complete(ScanState):
    pass


class Failed(ScanState):
    def start(self):
        return Running()


class AuditCoordinator:
    """Mediator: coordinates pipeline, commands, memento, observers and state transitions."""
    def __init__(self, pipeline, expression, events):
        self.pipeline, self.expression, self.events = pipeline, expression, events
        self.builder, self.state = ReportBuilder(), Ready()

    def run(self, paths):
        self.state = self.state.start()
        checkpoint = self.builder.checkpoint()
        commands = []
        try:
            self.events.emit('started')
            for path in paths:
                record = self.pipeline.run(path)
                if self.expression.matches(record):
                    command = AddRecord(self.builder, record)
                    command.execute(); commands.append(command)
                self.events.emit('processed')
            result = self.builder.build()
            self.events.emit('completed')
            self.state = self.state.complete()
            return result
        except Exception as failure:
            for command in reversed(commands):
                command.undo()
            self.builder.restore(checkpoint)
            self.state = self.state.fail()
            try:
                self.events.emit('failed')
            except Exception as observer_failure:
                failure.add_note(f'Failure observer also failed: {type(observer_failure).__name__}')
            raise
