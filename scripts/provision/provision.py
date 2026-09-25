#!/usr/bin/env python3
"""
Provisionamento dos bancos do FashionAI a partir de docs/planilhas/Entidades_BD_por_RF_RNF.xlsx.

Para cada banco da planilha (aba "Bancos") o script cria o que falta e confere o resultado, sempre de forma idempotente
(rodar de novo não duplica nada):

  MySQL 8     cria o banco (e, com MYSQL_ADMIN_*, o usuário da aplicação só com os privilégios dela); confere que todas
              as tabelas da aba "Entidades" existem (as tabelas nascem das migrações Flyway na subida do backend)
  Cassandra   aplica fai-infrastructure/persistence-cassandra/src/main/resources/cassandra/schema.cql
              (keyspace com NetworkTopologyStrategy quando CASSANDRA_LOCAL_DATACENTER está definido)
  OpenSearch  cria os índices fai-pieces e fai-schemes com mapeamento explícito (texto em português + .keyword)
  Redis       confere conexão e autenticação (PING)
  S3 / MinIO  cria o bucket de mídia e o CORS para o frontend; com S3_PUBLIC_READ=true libera leitura pública de users/
              e pending/, mantendo restricted/ (documentos do cadastro) privado

Credenciais vêm só de variáveis de ambiente (as mesmas do .env.example); nada é gravado em disco nem impresso.
Banco sem variáveis é pulado com o motivo. Uso:

  python3 scripts/provision/provision.py --check      # só confere (não altera nada)
  python3 scripts/provision/provision.py              # cria o que falta e confere
  python3 scripts/provision/provision.py --only mysql,opensearch
"""
import argparse
import base64
import json
import os
import shutil
import socket
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SHEET = os.path.join(ROOT, "docs", "planilhas", "Entidades_BD_por_RF_RNF.xlsx")
CQL = os.path.join(ROOT, "fai-infrastructure", "persistence-cassandra", "src", "main", "resources", "cassandra", "schema.cql")

OK, SKIP, FAIL, PLAN = "ok", "pulado", "FALHOU", "plano"
results = []


def env(name, default=""):
    v = os.environ.get(name, default)
    return v.strip() if isinstance(v, str) else default


def report(db, status, detail):
    results.append((db, status, detail))
    print(f"[{status:>7}] {db:<11} {detail}")


# ------------------------------------------------------------------------------------------------ planilha
def sheet_tables():
    """Tabelas MySQL listadas na aba Entidades (coluna 'Tabela MySQL')."""
    try:
        import openpyxl  # noqa: WPS433 — opcional
    except ImportError:
        return None
    wb = openpyxl.load_workbook(SHEET, read_only=True)
    rows = list(wb["Entidades"].iter_rows(values_only=True))
    head = [str(h) for h in rows[0]]
    col = head.index("Tabela MySQL")
    return sorted({str(r[col]).strip() for r in rows[1:] if r[col] and str(r[col]).strip() not in ("—", "-")})


# ------------------------------------------------------------------------------------------------ MySQL
def mysql_cli(args, sql, user, password, database=None):
    cmd = ["mysql", "--protocol=TCP", "-h", env("MYSQL_HOST", "localhost"), "-P", env("MYSQL_PORT", "3306"), "-u", user, "-N", "-B"]
    if database:
        cmd.append(database)
    proc = subprocess.run(cmd, input=sql, capture_output=True, text=True, env={**os.environ, "MYSQL_PWD": password}, timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip().splitlines()[-1] if proc.stderr.strip() else "erro no mysql")
    return proc.stdout


def provision_mysql(check):
    db, user, pw = env("MYSQL_DATABASE", "fashionai"), env("MYSQL_USER"), env("MYSQL_PASSWORD")
    if not user or not pw:
        return report("MySQL", SKIP, "defina MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER e MYSQL_PASSWORD")
    if not shutil.which("mysql"):
        return report("MySQL", SKIP, "cliente 'mysql' não encontrado no PATH")
    admin, admin_pw = env("MYSQL_ADMIN_USER"), env("MYSQL_ADMIN_PASSWORD")
    try:
        if not check and admin and admin_pw:
            host_pattern = env("MYSQL_APP_HOST_PATTERN", "%")
            q = lambda s: s.replace("\\", "\\\\").replace("'", "\\'")  # noqa: E731
            mysql_cli(None, f"CREATE DATABASE IF NOT EXISTS `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
                            f"CREATE USER IF NOT EXISTS '{q(user)}'@'{q(host_pattern)}' IDENTIFIED BY '{q(pw)}';\n"
                            f"GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES, CREATE VIEW, SHOW VIEW, "
                            f"CREATE ROUTINE, ALTER ROUTINE, EXECUTE, TRIGGER, LOCK TABLES ON `{db}`.* TO '{q(user)}'@'{q(host_pattern)}';\n",
                      admin, admin_pw)
            report("MySQL", OK, f"banco `{db}` e usuário da aplicação garantidos (privilégios só em `{db}`)")
        tables = set(mysql_cli(None, "SHOW TABLES;", user, pw, db).split())
        version = mysql_cli(None, "SELECT version FROM flyway_schema_history WHERE success=1 AND version IS NOT NULL ORDER BY installed_rank DESC LIMIT 1;", user, pw, db).strip() \
            if "flyway_schema_history" in tables else "—"
        version = version or "—"
        expected = sheet_tables()
        if expected is None:
            return report("MySQL", OK, f"conectado; {len(tables)} tabelas; Flyway v{version} (instale openpyxl para conferir a planilha)")
        missing = [t for t in expected if t not in tables]
        if not tables or version == "—":
            return report("MySQL", PLAN, f"conectado; sem migrações ainda: suba o backend uma vez (Flyway cria as {len(expected)} tabelas)")
        if missing:
            return report("MySQL", FAIL, f"Flyway v{version}; faltam {len(missing)} tabelas da planilha: {', '.join(missing[:8])}")
        report("MySQL", OK, f"Flyway v{version}; as {len(expected)} tabelas da planilha existem")
    except Exception as e:  # noqa: BLE001
        report("MySQL", FAIL, str(e))


# ------------------------------------------------------------------------------------------------ Cassandra
def provision_cassandra(check):
    hosts = env("CASSANDRA_CONTACT_POINTS")
    if not hosts or env("CASSANDRA_ENABLED", "false").lower() != "true":
        return report("Cassandra", SKIP, "defina CASSANDRA_ENABLED=true e CASSANDRA_CONTACT_POINTS (e usuário/senha, se houver)")
    keyspace, dc = env("CASSANDRA_KEYSPACE", "fashionai_feed"), env("CASSANDRA_LOCAL_DATACENTER")
    rf = env("CASSANDRA_REPLICATION_FACTOR", "3" if dc and dc != "datacenter1" else "1")
    cql = open(CQL, encoding="utf-8").read().replace("fashionai_feed", keyspace)
    if dc and dc != "datacenter1":
        cql = cql.replace("{'class': 'SimpleStrategy', 'replication_factor': 1}", f"{{'class': 'NetworkTopologyStrategy', '{dc}': {rf}}}")
    try:
        from cassandra.auth import PlainTextAuthProvider  # noqa: WPS433 — pip install cassandra-driver
        from cassandra.cluster import Cluster
    except ImportError:
        if shutil.which("cqlsh"):
            host = hosts.split(",")[0].strip()
            cmd = ["cqlsh", host, env("CASSANDRA_PORT", "9042")]
            if env("CASSANDRA_USERNAME"):
                cmd += ["-u", env("CASSANDRA_USERNAME"), "-p", env("CASSANDRA_PASSWORD")]
            stmt = "DESCRIBE KEYSPACES;" if check else cql
            proc = subprocess.run(cmd, input=stmt, capture_output=True, text=True, timeout=120)
            return report("Cassandra", OK if proc.returncode == 0 else FAIL, "cqlsh: " + ("schema aplicado" if not check else "conectado") if proc.returncode == 0 else proc.stderr.strip()[-200:])
        return report("Cassandra", SKIP, "instale o driver (pip install cassandra-driver) ou o cqlsh")
    try:
        auth = PlainTextAuthProvider(env("CASSANDRA_USERNAME"), env("CASSANDRA_PASSWORD")) if env("CASSANDRA_USERNAME") else None
        cluster = Cluster([h.strip() for h in hosts.split(",")], port=int(env("CASSANDRA_PORT", "9042")), auth_provider=auth)
        session = cluster.connect()
        if not check:
            for stmt in [s.strip() for s in "\n".join(l for l in cql.splitlines() if not l.strip().startswith("--")).split(";") if s.strip()]:
                session.execute(stmt)
        tables = [r.table_name for r in session.execute("SELECT table_name FROM system_schema.tables WHERE keyspace_name=%s", [keyspace])]
        cluster.shutdown()
        want = {"timeline_by_user", "notifications_by_user"}
        report("Cassandra", OK if want <= set(tables) else (PLAN if check else FAIL),
               f"keyspace {keyspace}: {', '.join(sorted(tables)) or 'sem tabelas'}" + ("" if want <= set(tables) else " (rode sem --check para criar)"))
    except Exception as e:  # noqa: BLE001
        report("Cassandra", FAIL, str(e)[:200])


# ------------------------------------------------------------------------------------------------ OpenSearch
TEXT = {"type": "text", "analyzer": "brazilian", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}}
KW = {"type": "text", "fields": {"keyword": {"type": "keyword", "ignore_above": 256}}}
INDICES = {
    "pieces": {"name": TEXT, "category": KW, "subcategory": KW, "color": KW, "brand": KW, "style": KW, "occasion": KW, "sex": KW,
               "market": KW, "country": KW, "visibility": KW, "moderation": KW, "ownerId": KW, "hypeScore": {"type": "float"}},
    "schemes": {"title": TEXT, "description": TEXT, "style": KW, "occasion": KW, "season": KW, "tags": KW, "colors": KW, "brands": KW,
                "country": KW, "visibility": KW, "status": KW, "ownerId": KW, "hypeScore": {"type": "float"}},
}


def http(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:  # noqa: S310 — URL vem da configuração do operador
            return r.status, r.read().decode() or "{}"
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def provision_opensearch(check):
    url = env("OPENSEARCH_URL").rstrip("/")
    if not url or env("OPENSEARCH_ENABLED", "false").lower() != "true":
        return report("OpenSearch", SKIP, "defina OPENSEARCH_ENABLED=true e OPENSEARCH_URL (e usuário/senha, se houver)")
    prefix = env("OPENSEARCH_INDEX_PREFIX", "fai-")
    auth = {}
    if env("OPENSEARCH_USERNAME"):
        auth = {"Authorization": "Basic " + base64.b64encode(f"{env('OPENSEARCH_USERNAME')}:{env('OPENSEARCH_PASSWORD')}".encode()).decode()}
    try:
        done = []
        for name, props in INDICES.items():
            idx = prefix + name
            status, _ = http("HEAD", f"{url}/{idx}", headers=auth)
            if status == 200:
                done.append(f"{idx} (já existia)")
                continue
            if check:
                done.append(f"{idx} (falta)")
                continue
            status, text = http("PUT", f"{url}/{idx}", {"settings": {"number_of_shards": 1, "number_of_replicas": int(env("OPENSEARCH_REPLICAS", "1"))},
                                                         "mappings": {"properties": props}}, auth)
            if status >= 300:
                raise RuntimeError(f"{idx}: HTTP {status} {text[:160]}")
            done.append(f"{idx} (criado)")
        report("OpenSearch", PLAN if check and any("falta" in d for d in done) else OK, "; ".join(done))
    except Exception as e:  # noqa: BLE001
        report("OpenSearch", FAIL, str(e)[:200])


# ------------------------------------------------------------------------------------------------ Redis
def provision_redis(check):
    host = env("REDIS_HOST")
    if not host or env("REDIS_ENABLED", "false").lower() != "true":
        return report("Redis", SKIP, "defina REDIS_ENABLED=true, REDIS_HOST, REDIS_PORT e REDIS_PASSWORD")
    try:
        with socket.create_connection((host, int(env("REDIS_PORT", "6379"))), timeout=10) as s:
            if env("REDIS_SSL", "false").lower() == "true":
                import ssl  # noqa: WPS433
                s = ssl.create_default_context().wrap_socket(s, server_hostname=host)
            cmds = []
            if env("REDIS_PASSWORD"):
                user = env("REDIS_USERNAME")
                args = ["AUTH", user, env("REDIS_PASSWORD")] if user else ["AUTH", env("REDIS_PASSWORD")]
                cmds.append(args)
            cmds.append(["PING"])
            for c in cmds:
                s.sendall(("*%d\r\n" % len(c) + "".join(f"${len(a.encode())}\r\n{a}\r\n" for a in c)).encode())
                reply = s.recv(256).decode(errors="replace").strip()
                if reply.startswith("-"):
                    raise RuntimeError(reply[:120])
        report("Redis", OK, f"PING → {reply}")
    except Exception as e:  # noqa: BLE001
        report("Redis", FAIL, str(e)[:200])


# ------------------------------------------------------------------------------------------------ S3 / MinIO
def provision_s3(check):
    bucket = env("S3_BUCKET", "fashionai-media")
    if env("STORAGE_TYPE", "local").lower() != "s3" or not env("S3_ACCESS_KEY_ID") or not env("S3_SECRET_ACCESS_KEY"):
        return report("S3", SKIP, "defina STORAGE_TYPE=s3, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY (S3_ENDPOINT para MinIO/R2)")
    try:
        import boto3  # noqa: WPS433 — pip install boto3
    except ImportError:
        return report("S3", SKIP, "instale o boto3 (pip install boto3)")
    try:
        s3 = boto3.client("s3", region_name=env("S3_REGION", "us-east-1"), endpoint_url=env("S3_ENDPOINT") or None,
                          aws_access_key_id=env("S3_ACCESS_KEY_ID"), aws_secret_access_key=env("S3_SECRET_ACCESS_KEY"))
        names = {b["Name"] for b in s3.list_buckets().get("Buckets", [])}
        if bucket not in names:
            if check:
                return report("S3", PLAN, f"bucket {bucket} não existe (rode sem --check para criar)")
            region = env("S3_REGION", "us-east-1")
            kw = {} if region == "us-east-1" or env("S3_ENDPOINT") else {"CreateBucketConfiguration": {"LocationConstraint": region}}
            s3.create_bucket(Bucket=bucket, **kw)
        if not check:
            origins = [o.strip() for o in env("APP_CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
            s3.put_bucket_cors(Bucket=bucket, CORSConfiguration={"CORSRules": [{"AllowedMethods": ["GET", "HEAD"], "AllowedOrigins": origins,
                                                                                 "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600}]})
            if env("S3_PUBLIC_READ", "false").lower() == "true":
                # leitura pública só de users/ e pending/ (fotos, cards, logos); restricted/ (documentos do cadastro, RF1) fica privado
                s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps({"Version": "2012-10-17", "Statement": [{
                    "Sid": "LeituraPublicaDaMidia", "Effect": "Allow", "Principal": "*", "Action": "s3:GetObject",
                    "Resource": [f"arn:aws:s3:::{bucket}/users/*", f"arn:aws:s3:::{bucket}/pending/*"]}]}))
        report("S3", OK, f"bucket {bucket}" + ("" if check else " com CORS para o frontend" + (" e leitura pública de users/ e pending/ (restricted/ privado)" if env("S3_PUBLIC_READ", "false").lower() == "true" else "")))
    except Exception as e:  # noqa: BLE001
        report("S3", FAIL, str(e)[:200])


STEPS = {"mysql": provision_mysql, "cassandra": provision_cassandra, "opensearch": provision_opensearch, "redis": provision_redis, "s3": provision_s3}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="só confere; não cria nada")
    ap.add_argument("--only", default=",".join(STEPS), help="bancos separados por vírgula: " + ",".join(STEPS))
    args = ap.parse_args()
    print(f"FashionAI — provisionamento dos bancos ({'conferência' if args.check else 'criação + conferência'})")
    for name in [n.strip() for n in args.only.split(",") if n.strip()]:
        if name not in STEPS:
            print(f"banco desconhecido: {name}"); sys.exit(2)
        STEPS[name](args.check)
    failed = [r for r in results if r[1] == FAIL]
    print(f"\n{len(results) - len(failed)} de {len(results)} sem falha" + (f"; falharam: {', '.join(r[0] for r in failed)}" if failed else ""))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
