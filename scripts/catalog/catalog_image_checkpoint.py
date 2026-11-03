"""Checkpoint SQLite das análises do lote de imagens: só análises concluídas são retomadas."""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
from pathlib import Path

class AnalysisCheckpoint:
    """Only completed analyses are resumable; download failures are retried next run."""
    def __init__(self, path: Path):
        self.conn = sqlite3.connect(path, check_same_thread=False)
        self.lock = threading.Lock()
        self.conn.execute("CREATE TABLE IF NOT EXISTS analyses (cache_key TEXT PRIMARY KEY, result TEXT NOT NULL)")
        self.conn.commit()

    def key(self, record, version):
        context = [version, record.get("source_url"), record.get("category"), record.get("subcategory"),
                   record.get("image_type"), record.get("version"), record.get("source_sha256"), record.get("last_verified_at")]
        return hashlib.sha256(json.dumps(context, ensure_ascii=False, default=str).encode()).hexdigest()

    def get(self, record, version):
        with self.lock:
            found = self.conn.execute("SELECT result FROM analyses WHERE cache_key=?", (self.key(record, version),)).fetchone()
        return json.loads(found[0]) if found else None

    def put(self, record, version, result):
        with self.lock:
            self.conn.execute("INSERT OR REPLACE INTO analyses VALUES (?, ?)",
                              (self.key(record, version), json.dumps(result, ensure_ascii=False)))
            self.conn.commit()

    def close(self):
        self.conn.close()
