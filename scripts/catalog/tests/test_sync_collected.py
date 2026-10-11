import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sync_collected import synchronize


def test_partial_line_and_resume(tmp_path):
    path = tmp_path / 'brand.jsonl'
    path.write_bytes(b'{"product_name":"A"}\n{"product_name":"B"}')
    offsets = {}
    ingest = Mock(report=SimpleNamespace(errors=0))
    assert synchronize(tmp_path, offsets, ingest) == 1
    assert ingest.ingest.call_count == 1
    assert synchronize(tmp_path, offsets, ingest) == 0
    with path.open('ab') as stream:
        stream.write(b'\n')
    assert synchronize(tmp_path, offsets, ingest) == 1
    assert ingest.ingest.call_args.kwargs['label'] == 'brand.jsonl@21'


def test_failed_transaction_is_not_checkpointed(tmp_path):
    (tmp_path / 'brand.jsonl').write_text(json.dumps({'product_name': 'A'})+'\n')
    offsets = {}
    ingest = Mock(report=SimpleNamespace(errors=0))
    ingest.ingest.side_effect = lambda *_a, **_kw: setattr(ingest.report, 'errors', ingest.report.errors+1)
    assert synchronize(tmp_path, offsets, ingest) == 0
    assert offsets == {}
    ingest.ingest.side_effect = None
    assert synchronize(tmp_path, offsets, ingest) == 1


def test_new_and_truncated_files_are_imported(tmp_path):
    first = tmp_path / 'a.jsonl'
    first.write_text('{"product_name":"Long name"}\n')
    offsets = {}
    ingest = Mock(report=SimpleNamespace(errors=0))
    assert synchronize(tmp_path, offsets, ingest) == 1
    first.write_text('{"product_name":"B"}\n')
    (tmp_path / 'b.jsonl').write_text('{"product_name":"C"}\n')
    assert synchronize(tmp_path, offsets, ingest) == 2
