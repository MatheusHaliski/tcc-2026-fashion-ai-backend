"""Conexão MySQL pelas MESMAS variáveis do backend (MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD,
MYSQL_SSL_MODE). Nunca imprime senha nem connection string."""
from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

try:
    import pymysql
    import pymysql.cursors
except ImportError:  # pragma: no cover - mensagem amigável
    pymysql = None

IMPORT_VERSION = "CATALOG_IMPORT_V2"


def now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def new_id() -> str:
    return str(uuid.uuid4())


def describe_target() -> str:
    """Destino sem segredo, para os logs: host:porta/banco (usuário)."""
    return f"{os.getenv('MYSQL_HOST', 'localhost')}:{os.getenv('MYSQL_PORT', '3306')}/{os.getenv('MYSQL_DATABASE', 'fashionai')} ({os.getenv('MYSQL_USER', 'fashionai')})"


def connect():
    if pymysql is None:
        sys.exit("PyMySQL não instalado: pip install -r scripts/catalog/requirements.txt")
    password = os.getenv("MYSQL_PASSWORD")
    if not password:
        sys.exit("MYSQL_PASSWORD não definida (mesma variável do backend; veja .env.example)")
    ssl_mode = os.getenv("MYSQL_SSL_MODE", "PREFERRED").upper()
    if os.getenv("MYSQL_USE_SSL", "").lower() == "true":
        ssl_mode = "REQUIRED"
    kwargs = dict(host=os.getenv("MYSQL_HOST", "localhost"), port=int(os.getenv("MYSQL_PORT", "3306")),
                  user=os.getenv("MYSQL_USER", "fashionai"), password=password,
                  database=os.getenv("MYSQL_DATABASE", "fashionai"), charset="utf8mb4",
                  cursorclass=pymysql.cursors.DictCursor, autocommit=False,
                  # rede lenta (Wi-Fi fraco, proxy da empresa): espera mais antes de desistir de conectar/ler/gravar
                  connect_timeout=int(os.getenv("MYSQL_CONNECT_TIMEOUT", "30")),
                  read_timeout=int(os.getenv("MYSQL_READ_TIMEOUT", "120")),
                  write_timeout=int(os.getenv("MYSQL_WRITE_TIMEOUT", "120")))
    if ssl_mode in ("REQUIRED", "VERIFY_CA", "VERIFY_IDENTITY"):
        kwargs["ssl"] = {"check_hostname": ssl_mode == "VERIFY_IDENTITY"}
    return pymysql.connect(**kwargs)


@contextmanager
def transaction(conn, dry_run: bool):
    """Uma transação por produto (marca + produto + variantes + imagens + fontes): falha no meio = rollback, sem
    registros pela metade. Em --dry-run tudo roda e é desfeito no fim."""
    try:
        yield conn
        if dry_run:
            conn.rollback()
        else:
            conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            # Uma conexão morta também recusa rollback. Preserve a causa original da falha.
            logging.getLogger("catalog").warning("[WARN] rollback indisponível; preservando o erro original")
        raise


class DatabaseUnavailable(RuntimeError):
    """Falha de conexão persistente: aborta o lote em vez de perder milhares de linhas."""


def connection_lost(error: Exception) -> bool:
    if pymysql is None:
        return False
    code = error.args[0] if error.args else None
    return (isinstance(error, pymysql.err.InterfaceError) and code == 0
            or isinstance(error, pymysql.err.OperationalError) and code in (2002, 2003, 2006, 2013, 2055))


def run_transaction(conn, operation, dry_run=False, *, label="transação", on_failure=None, retries=3):
    """Repete a unidade inteira após desconexão. Nunca reconecta no meio de uma transação.

    O chamador deve usar operações idempotentes: o servidor pode ter confirmado o COMMIT antes de perder a resposta.
    Não há ping por produto; a reconexão acontece somente após uma falha de transporte.
    """
    for attempt in range(retries + 1):
        try:
            if attempt:
                if getattr(conn, "open", False):
                    conn.close()
                conn.connect()
            with transaction(conn, dry_run):
                return operation()
        except Exception as error:
            if on_failure:
                on_failure()
            if not connection_lost(error):
                raise
            if attempt == retries:
                raise DatabaseUnavailable(f"{label}: MySQL indisponível após {retries} tentativas de reconexão; "
                                          "importação interrompida. Execute novamente com --skip-existing.") from error
            logging.getLogger("catalog").warning("[RETRY] %s: conexão perdida; reconexão %s/%s", label, attempt + 1, retries)
            time.sleep(min(2 ** attempt, 4))
