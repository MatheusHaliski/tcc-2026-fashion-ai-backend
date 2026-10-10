"""Conexão MySQL pelas MESMAS variáveis do backend (MYSQL_HOST, MYSQL_PORT, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD,
MYSQL_SSL_MODE). Nunca imprime senha nem connection string."""
from __future__ import annotations

import os
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

try:
    import pymysql
    import pymysql.cursors
except ImportError:  # pragma: no cover - mensagem amigável
    pymysql = None


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
        conn.rollback()
        raise


def is_connection_lost(e: BaseException) -> bool:
    """Queda de conexão (rede caiu, servidor fechou, timeout) — dá para reconectar e repetir o item. Erro de dado não."""
    if pymysql is None:
        return False
    if isinstance(e, pymysql.err.InterfaceError):
        return True
    # 2003 não conecta, 2006 servidor sumiu, 2013 conexão perdida durante a consulta, 2055 perdida no meio da leitura
    return isinstance(e, pymysql.err.OperationalError) and bool(e.args) and e.args[0] in (2003, 2006, 2013, 2055)
