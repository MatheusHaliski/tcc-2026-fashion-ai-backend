#!/usr/bin/env python3
"""Import completed JSONL records from collect_official.py into MySQL, optionally continuously.

python3 scripts/catalog/sync_collected.py --watch --interval 15
Uses the same MYSQL_* variables as import_products.py; never starts a collector.
Offsets advance only after an ingestion transaction succeeds. Incomplete last lines wait for the next scan.
"""
from __future__ import annotations
import argparse
import json
import time
from pathlib import Path
from db import DatabaseUnavailable, connect
from ingest import Ingestor

ROOT = Path(__file__).resolve().parents[2]


def completed_records(path: Path, offset: int):
    with path.open('rb') as stream:
        stream.seek(offset)
        while line := stream.readline():
            if not line.endswith(b'\n'):
                break
            end = stream.tell()
            if line.strip():
                yield end, json.loads(line.decode('utf-8'))
            else:
                yield end, None


def synchronize(folder: Path, offsets: dict, ingest, persist=lambda: None):
    imported = 0
    for path in sorted(folder.glob('*.jsonl')):
        stat = path.stat()
        identity = f'{stat.st_dev}:{stat.st_ino}'
        saved = offsets.get(path.name, {})
        offset = saved.get('offset', 0) if saved.get('identity') == identity else 0
        if offset > stat.st_size:
            offset = 0
        for end, raw in completed_records(path, offset):
            errors = ingest.report.errors
            if raw is not None:
                ingest.ingest(raw, label=f'{path.name}@{offset}')
            if ingest.report.errors > errors:
                # Leave this record pending rather than silently losing it.
                print(f'[sync] Erro em {path.name}@{offset}; será tentado na próxima consulta.', flush=True)
                break
            offsets[path.name] = {'identity': identity, 'offset': end}
            persist()
            offset = end
            imported += raw is not None
    return imported


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, default=ROOT / 'data/catalog/collected')
    parser.add_argument('--watch', action='store_true', help='continua importando registros novos enquanto a coleta roda')
    parser.add_argument('--interval', type=float, default=15)
    args = parser.parse_args(argv)
    if args.interval < 1:
        parser.error('--interval deve ser >= 1')
    args.folder.mkdir(parents=True, exist_ok=True)
    state_path = args.folder / '.state' / 'import-offsets.json'
    state_path.parent.mkdir(parents=True, exist_ok=True)
    offsets = json.loads(state_path.read_text()) if state_path.exists() else {}
    def persist():
        temp = state_path.with_suffix('.tmp')
        temp.write_text(json.dumps(offsets), encoding='utf-8')
        temp.replace(state_path)
    # Only one synchronizer owns offsets. macOS/Linux advisory lock is released even on interruption.
    import fcntl
    lock = (state_path.parent / 'import.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        parser.error('já existe um sincronizador usando esta pasta')
    conn = None
    try:
        conn = connect()
        ingest = Ingestor(conn, skip_existing=True)
        while True:
            count = synchronize(args.folder, offsets, ingest, persist)
            print(f'[sync] {count} registros processados; criados={ingest.report.created}, atualizados={ingest.report.updated}, erros={ingest.report.errors}', flush=True)
            if not args.watch:
                return int(ingest.report.errors > 0)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        return 0
    except DatabaseUnavailable:
        print('[sync] Banco indisponível. Reinicie o comando; os registros confirmados serão preservados.', flush=True)
        return 1
    finally:
        if conn is not None:
            conn.close()
        lock.close()


if __name__ == '__main__':
    raise SystemExit(main())
