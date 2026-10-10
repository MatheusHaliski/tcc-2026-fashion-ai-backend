"""Apply level-A image analysis without downloading or storing image bytes.

The Java analyzer and ranker run before the short SQL transaction. A product is
the atomic unit: an inventory changed by the API/worker is skipped, rather than
applying a canonical ranking calculated from an obsolete inventory.
"""
from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal

try:
    from .db import now, run_transaction
    from .source_persistence import allows_persistence
except ImportError:  # direct script execution, like the other catalog commands
    from db import now, run_transaction
    from source_persistence import allows_persistence


METADATA_COLUMNS = (
    "mime", "width", "height", "source_sha256", "phash", "processing_status",
    "pipeline_version", "quality_score", "gate_reasons", "crop_json", "metrics_json",
)
DONE = {"APPROVED", "NEEDS_REPROCESSING", "REJECTED"}
ROLES = {"CANONICAL", "ALTERNATE", "DETAIL", "DUPLICATE", "REJECTED", "REVIEW"}
PROTECTED_REVIEWS = {"APPROVED", "REJECTED"}
GUARD_COLUMNS = (
    "review_status", "processing_status", "is_canonical", "image_type",
    "quality_score", "phash", "metrics_json", "usage_status", "pipeline_version",
)


def _id(record):
    value = record.get("image_id", record.get("id"))
    if value is None:
        raise ValueError("inventory row is missing image_id")
    return str(value)


def _snapshot(record):
    row = dict(record)
    row["id"] = _id(record)
    for name in ("product_id", "product_version", "version", "image_url_hash"):
        if row.get(name) is None:
            raise ValueError(f"inventory row {row['id']} is missing {name}")
    row["product_id"] = str(row["product_id"])
    row["image_url"] = row.get("original_image_url") or row.get("image_url")
    if not row["image_url"]:
        raise ValueError(f"inventory row {row['id']} is missing original image_url")
    row["version"] = int(row["version"])
    row["product_version"] = int(row["product_version"])
    for name in ("category", "subcategory"):
        if name not in row:
            raise ValueError(f"inventory row {row['id']} is missing product {name}")
    # In the exported workbook source_url means original image URL. The DB's
    # source_url is the provenance/product page; keep those meanings separate.
    if "provenance_url" in row:
        row["source_url"] = row["provenance_url"]
    elif "source_page_url" in row:
        row["source_url"] = row["source_page_url"]
    else:
        row.pop("source_url", None)
    return row


def _json_value(value):
    if isinstance(value, str):
        return json.loads(value)
    return value


def _equal(column, left, right):
    if column.endswith("_json"):
        return _json_value(left) == _json_value(right)
    if column == "quality_score":
        return (None if left is None else Decimal(str(left))) == (None if right is None else Decimal(str(right)))
    if isinstance(left, datetime) or isinstance(right, datetime):
        def instant(value):
            return value.isoformat(timespec="microseconds") if isinstance(value, datetime) else str(value).replace(" ", "T")
        return instant(left) == instant(right)
    return left == right


def _protected(row):
    if row.get("review_status") in PROTECTED_REVIEWS:
        return "HUMAN_REVIEW"
    if row.get("processing_status") == "DOWNLOADING":
        return "WORKER_ACTIVE"
    if row.get("usage_status") == "REJECTED":
        return "USAGE_REJECTED"
    return None


def _columns(analysis):
    if not isinstance(analysis, Mapping) or analysis.get("ok") is False:
        return None
    values = analysis.get("columns", analysis)
    if not isinstance(values, Mapping):
        raise ValueError("analysis.columns must be an object")
    patch = {column: values[column] for column in METADATA_COLUMNS if column in values}
    if patch.get("processing_status") not in DONE:
        raise ValueError("analysis has no valid processing_status")
    if not isinstance(patch.get("pipeline_version"), str) or not patch["pipeline_version"] or len(patch["pipeline_version"]) > 40:
        raise ValueError("analysis has no valid pipeline_version")
    for column in ("crop_json", "metrics_json"):
        if column in patch and patch[column] is not None:
            parsed = _json_value(patch[column])
            if not isinstance(parsed, dict):
                raise ValueError(f"{column} must contain a JSON object")
            patch[column] = json.dumps(parsed, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    return patch


def _candidate(row):
    outcome = row.get("review_status") if row.get("review_status") in PROTECTED_REVIEWS else row.get("processing_status")
    metrics = _json_value(row.get("metrics_json")) or {}
    return {"id": row["id"], "imageType": row.get("image_type"), "outcome": outcome,
            "quality": float(row.get("quality_score") or 0), "detailView": metrics.get("detailView") is True,
            "phash": row.get("phash")}


def apply_product(conn, records, analyses_by_image_id, ranker):
    """Persist already-computed analyses and Java roles, atomically per product.

    ``records`` contains every image of one product, including manual decisions.
    ``ranker`` is the bridge's ``rank(category, candidates)`` callable (or object).
    The result includes changed_ids/skipped_ids and before/after snapshots for
    the caller's audit JSONL. No source URL or image bytes are replaced/deleted.
    """
    snapshots = [_snapshot(record) for record in records]
    if not snapshots:
        return {"changed_ids": [], "skipped_ids": [], "skip_reasons": {}, "changes": []}
    by_id = {row["id"]: row for row in snapshots}
    if len(by_id) != len(snapshots):
        raise ValueError("inventory contains duplicate image IDs")
    product_id = snapshots[0]["product_id"]
    if any(row["product_id"] != product_id for row in snapshots):
        raise ValueError("apply_product accepts exactly one product")
    context = {column: snapshots[0][column] for column in ("product_version", "category", "subcategory")}
    if any(any(row[column] != value for column, value in context.items()) for row in snapshots):
        raise ValueError("inventory contains inconsistent product context")
    analyses = {str(image_id): value for image_id, value in analyses_by_image_id.items()}
    if not set(analyses).issubset(by_id):
        raise ValueError("analysis refers to an image outside this product")
    instant = now()
    patches = {}
    skips = {}
    prospective = {image_id: dict(row) for image_id, row in by_id.items()}
    for image_id, analysis in analyses.items():
        reason = _protected(by_id[image_id])
        if reason:
            skips[image_id] = reason
            continue
        patch = _columns(analysis)
        if patch is None:
            skips[image_id] = "ANALYSIS_FAILED"
            continue
        patch.update(stored_url=None, assets_json=None, usage_status="REFERENCE_ONLY",
                     review_status="PENDING" if patch["processing_status"] == "NEEDS_REPROCESSING" else "NONE",
                     processed_at=instant)
        assets = analysis.get("framed_assets")
        if assets:
            if not by_id[image_id].get("allows_image_persistence") or patch["pipeline_version"] != "CATALOG_FRAME_34_50_V1":
                raise ValueError("frame persistence is not authorized")
            patch.update(stored_url=assets["stored_url"], assets_json=assets["assets_json"], usage_status="PERSISTED")
        patches[image_id] = patch
        prospective[image_id].update(patch)
    if not patches:
        return {"changed_ids": [], "skipped_ids": list(skips), "skip_reasons": skips, "changes": []}

    # A protected noncanonical image cannot be promoted, so it must not win a
    # ranking that would demote every writable canonical. Human canonical rows
    # remain untouched and are handled as a fixed selection below.
    candidates = [_candidate(row) for row in prospective.values()
                  if row.get("processing_status") in DONE and not _protected(row)]
    rank = ranker if callable(ranker) else ranker.rank
    ranking = rank(snapshots[0].get("category"), candidates)
    roles = ranking.get("roles") if isinstance(ranking, Mapping) else ranking
    if isinstance(ranking, Mapping) and ranking.get("ok") is False:
        raise ValueError("ranker did not return a successful result")
    if not isinstance(roles, list):
        raise ValueError("ranker must return roles")
    ranked = {}
    for item in roles:
        image_id, role = str(item.get("id")), item.get("role")
        if image_id in ranked or role not in ROLES:
            raise ValueError("ranker returned an invalid or repeated role")
        ranked[image_id] = role
    if set(ranked) != {candidate["id"] for candidate in candidates} or sum(role == "CANONICAL" for role in ranked.values()) > 1:
        raise ValueError("ranker returned an inconsistent product inventory")
    manual_canonical = any(row.get("is_canonical") and row.get("review_status") == "APPROVED" for row in prospective.values())
    for image_id, role in ranked.items():
        row = by_id[image_id]
        if manual_canonical and role == "CANONICAL":
            role = "ALTERNATE"
        patch = patches.setdefault(image_id, {})
        if row.get("view_role") != role:
            patch["view_role"] = role
        if bool(row.get("is_canonical")) != (role == "CANONICAL"):
            patch["is_canonical"] = role == "CANONICAL"
        if not patch:
            patches.pop(image_id)
    for patch in patches.values():
        patch["updated_at"] = instant

    committed_result = None

    def write():
        nonlocal committed_result
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, version, category, subcategory FROM catalog_products WHERE id = %s FOR UPDATE", (product_id,))
            product = cursor.fetchone()
            if product is None or int(product["version"]) != context["product_version"] or any(
                product[column] != context[column] for column in ("category", "subcategory")
            ):
                skipped = {**skips, **{image_id: "PRODUCT_CHANGED" for image_id in patches}}
                return {"changed_ids": [], "skipped_ids": list(skipped), "skip_reasons": skipped, "changes": []}
            cursor.execute("SELECT * FROM catalog_images WHERE product_id = %s ORDER BY is_primary DESC, created_at ASC FOR UPDATE", (product_id,))
            current = {str(row["id"]): row for row in cursor.fetchall()}
            # COMMIT can succeed while its response is lost. Recognize this
            # invocation's exact timestamp, version and full patches on retry.
            if committed_result is not None and set(current) == set(by_id) and all(
                int(current[image_id]["version"]) == by_id[image_id]["version"] + 1
                and all(_equal(column, current[image_id].get(column), value) for column, value in patch.items())
                for image_id, patch in patches.items()
            ):
                return {**committed_result, "recovered_commit": True}
            changed = set(current) != set(by_id)
            if not changed:
                for image_id, row in by_id.items():
                    stored = current[image_id]
                    checked = ("version", "image_url_hash", "image_url", *GUARD_COLUMNS, "source_url")
                    if any(column in row and not _equal(column, stored.get(column), row[column]) for column in checked):
                        changed = True
                        break
            if changed:
                skipped = {**skips, **{image_id: "PRODUCT_CHANGED" for image_id in patches}}
                return {"changed_ids": [], "skipped_ids": list(skipped), "skip_reasons": skipped, "changes": []}
            for image_id, patch in patches.items():
                if patch.get("assets_json"):
                    cursor.execute("SELECT s.domain, s.active, s.allows_image_persistence FROM catalog_sources s JOIN catalog_products p ON p.brand_id=s.brand_id WHERE p.id=%s FOR UPDATE", (product_id,))
                    if not allows_persistence(cursor.fetchall(), current[image_id].get("image_url"), current[image_id].get("source_domain")):
                        raise ValueError("source persistence permission changed")
            changes = []
            for image_id, patch in patches.items():
                row = current[image_id]
                assignments = ", ".join(f"`{column}` = %s" for column in patch)
                sql = (f"UPDATE catalog_images SET {assignments}, version = version + 1 "
                       "WHERE id = %s AND product_id = %s AND version = %s AND image_url_hash = %s AND image_url = %s "
                       "AND review_status NOT IN ('APPROVED', 'REJECTED') AND processing_status <> 'DOWNLOADING' AND usage_status <> 'REJECTED'")
                cursor.execute(sql, (*patch.values(), image_id, product_id, row["version"], row["image_url_hash"], row["image_url"]))
                if cursor.rowcount != 1:
                    raise RuntimeError("image update lost its optimistic guard; product transaction rolled back")
                after = {**row, **patch, "version": int(row["version"]) + 1}
                changes.append({"image_id": image_id, "before": dict(row), "after": after})
            committed_result = {"changed_ids": list(patches), "skipped_ids": list(skips), "skip_reasons": dict(skips), "changes": changes}
            return committed_result

    return run_transaction(conn, write, label=f"metadados de imagens do produto {product_id}")
