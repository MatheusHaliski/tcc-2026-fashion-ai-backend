#!/usr/bin/env python3
"""Audit READY claims in an existing photo-set lot without using the GPU/DB.

Default is read-only. `--apply-local` downgrades suspicious READY photo sets to
REVIEW with an immutable adjacent backup, keeping PNGs and other lot data.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

try:
    from .photo_set_quality import apply_quality_gate
except ImportError:
    from photo_set_quality import apply_quality_gate


def harden_set_path(path: Path, *, apply_local: bool = False) -> dict:
    """Return a verdict. On approval to apply, edit ONLY a suspect set.json."""
    path = Path(path)
    source = path.read_bytes()
    record = json.loads(source)
    if record.get("status") != "READY":
        return {"status": "UNCHANGED_NOT_READY"}
    reviewed = apply_quality_gate(record)
    if reviewed.get("status") == "READY":
        return {"status": "UNCHANGED_READY"}
    verdict = {"status": "NEEDS_REVIEW", "reason": reviewed.get("reason"),
               "reasons": reviewed.get("postflight", {}).get("reasons", [])}
    if not apply_local:
        return verdict
    # Keep the source PNGs as separate review evidence, but a REVIEW photoSet
    # must not advertise READY file keys to any existing importer.
    if record.get("files"):
        reviewed["reviewPreviewFiles"] = dict(record["files"])
    reviewed.pop("files", None)
    backup = path.with_name("set.before-postflight-v1.json")
    if backup.exists():
        if backup.read_bytes() != source:
            return {"status": "BACKUP_CONFLICT_REVIEW_REQUIRED"}
    else:
        with backup.open("xb") as stream:
            stream.write(source)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent,
                                         prefix=".set-postflight-", suffix=".json", delete=False) as output:
            temporary = Path(output.name)
            json.dump(reviewed, output, ensure_ascii=False, indent=2)
            output.write("\n")
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {**verdict, "status": "DOWNGRADED_TO_REVIEW", "backup": backup.name}


def audit_lot(lot: Path, *, apply_local: bool = False) -> dict:
    counts = {}
    for path in sorted(Path(lot).glob("photo-sets/*/set.json")):
        try:
            result = harden_set_path(path, apply_local=apply_local)
        except (OSError, ValueError, TypeError):
            result = {"status": "INVALID_SET_REVIEW_REQUIRED"}
        status = result["status"]
        counts[status] = counts.get(status, 0) + 1
        print(f"[{path.parent.name}] {status}" +
              (f": {result['reason']}" if result.get("reason") else ""), flush=True)
    return counts


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--from-lot", type=Path, required=True)
    p.add_argument("--apply-local", action="store_true", help="altera só set.json; preserva backup e imagens")
    args = p.parse_args()
    print(json.dumps(audit_lot(args.from_lot, apply_local=args.apply_local), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
