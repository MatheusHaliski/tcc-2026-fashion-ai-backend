"""Bridge somente de análise para CatalogImageBatchCli: uma JVM, sem rede, banco ou edição de pixels.

O classpath pode ser fornecido por CATALOG_IMAGE_JAVA_CLASSPATH ou extraído uma vez de um fat JAR já compilado.
Não executa Maven automaticamente. O worker Java devolve os mesmos metadados de nível A utilizados pela API.
"""
from __future__ import annotations

import hashlib
import json
import os
import queue
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
import zipfile
from pathlib import Path
from typing import Any, Sequence

PIPELINE_VERSION = "CATALOG_IMAGE_PIPELINE_V4"
JAVA_MAIN = "br.com.fashionai.application.catalog.image.CatalogImageBatchCli"
OUTCOMES = {"APPROVED", "NEEDS_REPROCESSING", "REJECTED"}
ANALYSIS_COLUMNS = {"mime", "width", "height", "source_sha256", "phash", "processing_status", "pipeline_version",
                    "quality_score", "gate_reasons", "crop_json", "metrics_json"}
MAX_RESPONSE_BYTES = 4 * 1024 * 1024


class AnalyzerError(RuntimeError):
    """Erro distinguível do veredito de qualidade REJECTED/NEEDS_REPROCESSING de uma foto."""

    def __init__(self, code: str, message: str, response: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.response = response


def ensure_classpath(workdir: str | Path, *, jar: str | Path | None = None,
                     classpath: str | None = None, cache_dir: str | Path | None = None) -> str:
    """Reusa classpath explícito ou extrai BOOT-INF de um JAR existente, em cache pelo SHA-256.

    Extração atômica; jamais recompila por foto ou altera o pom. O cache padrão fica no diretório temporário.
    Quando houver código Java novo, compile/package o projeto antes e informe o artefato correspondente.
    """
    configured = classpath or os.getenv("CATALOG_IMAGE_JAVA_CLASSPATH")
    if configured:
        return configured
    root = Path(workdir).resolve()
    artifact = Path(jar).resolve() if jar else root / "fai-bootstrap/target/fai-bootstrap-0.1.0-SNAPSHOT.jar"
    if not artifact.is_file():
        raise AnalyzerError("CLASSPATH_UNAVAILABLE", "Informe --java-classpath ou compile o fat JAR do backend antes da análise.")
    digest = hashlib.sha256()
    with artifact.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    cache = Path(cache_dir).resolve() if cache_dir else Path(tempfile.gettempdir()) / "fashionai-catalog-image-cli"
    cache.mkdir(parents=True, exist_ok=True)
    target = cache / digest.hexdigest()
    if not (target / ".complete").is_file():
        with tempfile.TemporaryDirectory(prefix="extract-", dir=cache) as temporary:
            staged = Path(temporary) / "classpath"
            (staged / "classes").mkdir(parents=True)
            (staged / "lib").mkdir()
            try:
                with zipfile.ZipFile(artifact) as archive:
                    entries = [entry for entry in archive.infolist() if not entry.is_dir() and
                               (entry.filename.startswith("BOOT-INF/classes/") or
                                entry.filename.startswith("BOOT-INF/lib/") and entry.filename.endswith(".jar"))]
                    if not any(entry.filename.startswith("BOOT-INF/lib/") for entry in entries):
                        raise AnalyzerError("CLASSPATH_UNAVAILABLE", "O artefato informado não contém as dependências BOOT-INF/lib.")
                    if sum(entry.file_size for entry in entries) > 2 * 1024 ** 3:
                        raise AnalyzerError("CLASSPATH_UNAVAILABLE", "Artefato Java excede o limite de extração de dependências.")
                    for entry in entries:
                        prefix = "BOOT-INF/classes/" if entry.filename.startswith("BOOT-INF/classes/") else "BOOT-INF/lib/"
                        relative = Path(entry.filename.removeprefix(prefix))
                        if relative.is_absolute() or ".." in relative.parts:
                            raise AnalyzerError("CLASSPATH_UNAVAILABLE", "Caminho inválido no artefato Java.")
                        destination = staged / ("classes" if "classes" in prefix else "lib") / relative
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        with archive.open(entry) as source, destination.open("wb") as output:
                            shutil.copyfileobj(source, output)
            except (OSError, zipfile.BadZipFile) as error:
                raise AnalyzerError("CLASSPATH_UNAVAILABLE", "Não foi possível ler o artefato Java.") from error
            (staged / ".complete").write_text("", encoding="utf-8")
            try:
                staged.rename(target)
            except OSError:
                if not (target / ".complete").is_file():
                    raise
    # Wildcard do classpath é expandido pela JVM, sem shell ou recompilação.
    return os.pathsep.join((str(target / "classes"), str(target / "lib" / "*")))


def build_command(classpath: str, *, java: str | Path | None = None, threads: int = 2,
                  jvm_options: Sequence[str] = ("-Xmx1g",)) -> list[str]:
    if not isinstance(threads, int) or isinstance(threads, bool) or not 1 <= threads <= 64:
        raise ValueError("threads deve estar entre 1 e 64")
    if not classpath:
        raise ValueError("classpath obrigatório")
    executable = str(java) if java else str(Path(os.environ["JAVA_HOME"]) / "bin/java") if os.getenv("JAVA_HOME") else shutil.which("java")
    if not executable:
        raise AnalyzerError("JAVA_UNAVAILABLE", "Defina JAVA_HOME para o Java 21 ou informe o executável Java.")
    resolved = shutil.which(executable)
    if resolved is None:
        raise AnalyzerError("JAVA_UNAVAILABLE", "Executável Java não encontrado.")
    return [str(Path(resolved).resolve()), *jvm_options, "-Djava.awt.headless=true", "-cp", classpath,
            JAVA_MAIN, "--threads", str(threads)]


class CatalogImageAnalyzer:
    """Context manager com requests correlacionados e até quatro pedidos por thread Java em andamento.

    Métodos podem ser chamados de threads Python diferentes. Falha de transporte encerra a JVM para que o runner
    possa retomá-la sem confundir uma resposta atrasada com outra foto. Erro de uma foto não encerra o lote.
    """

    def __init__(self, classpath: str, *, java: str | Path | None = None, threads: int = 2,
                 timeout: float = 120, startup_timeout: float = 20, stderr_path: str | Path | None = None,
                 expected_version: str = PIPELINE_VERSION, jvm_options: Sequence[str] = ("-Xmx1g",)):
        if timeout <= 0 or startup_timeout <= 0:
            raise ValueError("timeouts devem ser positivos")
        command = build_command(classpath, java=java, threads=threads, jvm_options=jvm_options)
        self.timeout = timeout
        self._lock = threading.Lock()
        self._write_lock = threading.Lock()
        self._pending: dict[str, queue.Queue] = {}
        self._slots = threading.BoundedSemaphore(threads * 4)
        self._startup: queue.Queue = queue.Queue(maxsize=1)
        self._failure: AnalyzerError | None = None
        self._closed = False
        self._stderr = None
        if stderr_path is not None:
            path = Path(stderr_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            os.fchmod(descriptor, 0o600)
            self._stderr = os.fdopen(descriptor, "ab")
        try:
            self._process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                             stderr=self._stderr or subprocess.DEVNULL, text=True,
                                             encoding="utf-8", bufsize=1)
        except OSError as error:
            if self._stderr:
                self._stderr.close()
            raise AnalyzerError("JAVA_START_FAILED", "Não foi possível iniciar o analisador Java.") from error
        self._reader = threading.Thread(target=self._read_responses, name="catalog-image-protocol", daemon=True)
        self._reader.start()
        try:
            ready = self._startup.get(timeout=startup_timeout)
            if isinstance(ready, AnalyzerError):
                raise ready
            if ready.get("pipelineVersion") != expected_version:
                raise AnalyzerError("PIPELINE_VERSION_MISMATCH", "O artefato Java não contém a versão esperada do pipeline.", ready)
            self.ready: dict[str, Any] = ready
        except queue.Empty as error:
            self.close(grace_timeout=0.1)
            raise AnalyzerError("STARTUP_TIMEOUT", "O analisador Java não anunciou disponibilidade no prazo.") from error
        except BaseException:
            self.close(grace_timeout=0.1)
            raise

    def _fail(self, error: AnalyzerError) -> None:
        with self._lock:
            if self._failure is not None:
                return
            self._failure = error
            waiting = list(self._pending.values())
        for response in waiting:
            response.put(error)
        try:
            self._startup.put_nowait(error)
        except queue.Full:
            pass

    def _read_responses(self) -> None:
        first = True
        try:
            while True:
                line = self._process.stdout.readline(MAX_RESPONSE_BYTES + 1)
                if not line:
                    if not self._closed:
                        self._fail(AnalyzerError("PROCESS_EXITED", "O analisador Java encerrou o protocolo antes da resposta."))
                    return
                if len(line) > MAX_RESPONSE_BYTES:
                    raise AnalyzerError("PROTOCOL_ERROR", "Resposta do analisador excede o limite do protocolo.")
                message = json.loads(line)
                if not isinstance(message, dict):
                    raise AnalyzerError("PROTOCOL_ERROR", "Resposta do analisador não é um objeto JSON.")
                if first:
                    if message.get("op") != "ready":
                        raise AnalyzerError("PROTOCOL_ERROR", "Primeira resposta do analisador precisa ser ready.")
                    self._startup.put(message)
                    first = False
                    continue
                with self._lock:
                    recipient = self._pending.get(message.get("id"))
                if recipient is None:
                    raise AnalyzerError("PROTOCOL_ERROR", "Resposta do analisador sem pedido correspondente.")
                recipient.put(message)
        except (ValueError, UnicodeError) as error:
            self._fail(AnalyzerError("PROTOCOL_ERROR", "Resposta JSON inválida do analisador Java."))
        except AnalyzerError as error:
            self._fail(error)
        except (OSError, TypeError):
            if not self._closed:
                self._fail(AnalyzerError("PIPE_CLOSED", "O canal do analisador Java foi fechado."))

    def _request(self, operation: str, payload: dict[str, Any], identifier: str | None) -> dict[str, Any]:
        deadline = time.monotonic() + self.timeout
        if not self._slots.acquire(timeout=self.timeout):
            raise AnalyzerError("REQUEST_TIMEOUT", "Fila de análise não liberou capacidade no prazo.")
        identifier = str(identifier) if identifier is not None else str(uuid.uuid4())
        response: queue.Queue = queue.Queue()
        registered = False
        try:
            with self._lock:
                if self._closed:
                    raise AnalyzerError("ANALYZER_CLOSED", "O analisador já foi fechado.")
                if self._failure:
                    raise self._failure
                if identifier in self._pending:
                    raise AnalyzerError("DUPLICATE_REQUEST_ID", "O identificador já possui um pedido em andamento.")
                self._pending[identifier] = response
                registered = True
            request = {"id": identifier, "op": operation, **payload}
            try:
                encoded = json.dumps(request, ensure_ascii=False, allow_nan=False) + "\n"
            except (TypeError, ValueError) as error:
                raise AnalyzerError("BAD_REQUEST", "Pedido de análise não pode ser representado como JSON.") from error
            try:
                with self._write_lock:
                    self._process.stdin.write(encoded)
                    self._process.stdin.flush()
            except (BrokenPipeError, OSError, ValueError) as error:
                failure = AnalyzerError("PIPE_CLOSED", "O canal de entrada do analisador Java foi fechado.")
                self._fail(failure)
                raise failure from error
            try:
                result = response.get(timeout=max(0, deadline - time.monotonic()))
            except queue.Empty as error:
                failure = AnalyzerError("REQUEST_TIMEOUT", "O analisador Java não respondeu no prazo.")
                self._fail(failure)
                self.close(grace_timeout=0.1)
                raise failure from error
            if isinstance(result, AnalyzerError):
                raise result
            if result.get("op") != operation or not isinstance(result.get("ok"), bool):
                raise AnalyzerError("PROTOCOL_ERROR", "Resposta incompatível com a operação solicitada.", result)
            if not result["ok"]:
                raise AnalyzerError(str(result.get("error") or "ANALYSIS_FAILED"), "O analisador não conseguiu processar este pedido.", result)
            return result
        finally:
            if registered:
                with self._lock:
                    self._pending.pop(identifier, None)
            self._slots.release()

    def analyze(self, path: str | Path, category: str | None, subcategory: str | None,
                image_type: str | None = "PACKSHOT", *, image_id: str | None = None) -> dict[str, Any]:
        result = self._request("analyze", {"path": str(Path(path).resolve()), "category": category,
                                         "subcategory": subcategory, "imageType": image_type}, image_id)
        columns = result.get("columns")
        if (result.get("outcome") not in OUTCOMES or not isinstance(columns, dict)
                or not ANALYSIS_COLUMNS.issubset(columns)
                or columns.get("processing_status") != result["outcome"]
                or columns.get("pipeline_version") != self.ready["pipelineVersion"]
                or any(columns.get(key) is not None and not isinstance(columns[key], str)
                       for key in ("mime", "source_sha256", "phash", "gate_reasons", "crop_json", "metrics_json", "quality_score"))
                or any(columns.get(key) is not None and (not isinstance(columns[key], int) or isinstance(columns[key], bool)
                                                         or columns[key] <= 0) for key in ("width", "height"))):
            raise AnalyzerError("PROTOCOL_ERROR", "Metadados de análise incompatíveis com o pipeline atual.", result)
        try:
            for key in ("crop_json", "metrics_json"):
                if columns[key] is not None and not isinstance(json.loads(columns[key]), dict):
                    raise ValueError("objeto obrigatório")
        except ValueError as error:
            raise AnalyzerError("PROTOCOL_ERROR", "Metadados JSON inválidos na resposta da análise.", result) from error
        return result

    def rank(self, category: str | None, candidates: list[dict[str, Any]], *, product_id: str | None = None) -> dict[str, Any]:
        result = self._request("rank", {"category": category, "candidates": candidates}, product_id)
        if not isinstance(result.get("roles"), list):
            raise AnalyzerError("PROTOCOL_ERROR", "Ranqueamento sem lista de papéis das imagens.", result)
        return result

    def close(self, *, grace_timeout: float = 10) -> None:
        with self._lock:
            if self._closed:
                return
            self._closed = True
        self._fail(AnalyzerError("ANALYZER_CLOSED", "O analisador foi fechado."))
        try:
            with self._write_lock:
                self._process.stdin.close()
        except (BrokenPipeError, OSError, ValueError):
            pass
        try:
            self._process.wait(timeout=grace_timeout)
        except subprocess.TimeoutExpired:
            self._process.terminate()
            try:
                self._process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self._process.kill()
                self._process.wait(timeout=3)
        self._reader.join(timeout=1)
        self._process.stdout.close()
        if self._stderr:
            self._stderr.close()

    def __enter__(self) -> "CatalogImageAnalyzer":
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()
