"""Ambiente do lote de imagens do catálogo: nomes do Railway para as MYSQL_* e as variáveis exigidas por --apply
--category-frame (só nomes, nunca valores)."""
from __future__ import annotations

import os
import urllib.parse

def configure_railway_environment():
    """Accept Railway names without logging URLs/passwords or using root implicitly."""
    public_url = os.environ.get("MYSQL_PUBLIC_URL", "").strip()
    # urlsplit treats bare host:port as a scheme/path, not a network endpoint.
    # Normalize only the parsed copy; preserve the original environment value.
    if public_url and "://" not in public_url and not public_url.startswith("//"):
        public_url = "mysql://" + public_url
    public = urllib.parse.urlsplit(public_url)
    if not os.getenv("MYSQL_HOST"):
        host = public.hostname or os.getenv("MYSQLHOST")
        if host:
            os.environ["MYSQL_HOST"] = host
        if public.hostname and public.port:
            os.environ.setdefault("MYSQL_PORT", str(public.port))
        elif os.getenv("MYSQLPORT"):
            os.environ.setdefault("MYSQL_PORT", os.environ["MYSQLPORT"])
    if not os.getenv("MYSQL_DATABASE"):
        database = os.getenv("MYSQLDATABASE") or public.path.removeprefix("/")
        if database:
            os.environ["MYSQL_DATABASE"] = database
    app_password = os.getenv("MYSQL_APP_PASSWORD") or os.getenv("RAILWAY_MYSQL_APP_PASSWORD")
    if not os.getenv("MYSQL_PASSWORD") and app_password:
        os.environ["MYSQL_PASSWORD"] = app_password
        os.environ.setdefault("MYSQL_USER", "fai_app")
    elif not os.getenv("MYSQL_USER") and os.getenv("MYSQLUSER") and os.getenv("MYSQLUSER") != "root":
        os.environ["MYSQL_USER"] = os.environ["MYSQLUSER"]
    if public.hostname:
        os.environ.setdefault("MYSQL_SSL_MODE", "REQUIRED")


# --apply --category-frame grava no MySQL e no S3: sem estas variáveis o lote nem começa (só os nomes são exibidos)
FRAME_MYSQL_VARIABLES = ("MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD")
FRAME_S3_VARIABLES = ("S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")


def missing_frame_environment(environ=None):
    """Nomes das variáveis exigidas por --apply --category-frame que faltam (depois dos nomes do Railway); nunca valores."""
    environ = os.environ if environ is None else environ

    def present(name):
        return bool(str(environ.get(name) or "").strip())
    missing = [name for name in FRAME_MYSQL_VARIABLES + FRAME_S3_VARIABLES if not present(name)]
    if str(environ.get("S3_SERVE_THROUGH_API") or "").strip().lower() == "true":
        if not present("APP_BASE_URL"):
            missing.append("APP_BASE_URL")
    elif not present("STORAGE_PUBLIC_BASE_URL"):
        missing.append("STORAGE_PUBLIC_BASE_URL (ou APP_BASE_URL com S3_SERVE_THROUGH_API=true)")
    return missing
