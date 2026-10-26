"""Conservative, explainable quality gate for automatic catalog photo sets.

Segmentation is evidence of *pixels found*, not proof that the entire product
is visible. Especially when someone wears it, a semantic garment mask can
omit a waistband, collar, cuff or back panel without touching the image edge.

This policy deliberately sends ambiguous photographs to human review. It does
not repair garments, write to the database, or alter the underlying source.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

POLICY_VERSION = "FAI_PHOTO_SET_POSTFLIGHT_V1"


@dataclass(frozen=True)
class QualityAssessment:
    status: str
    reason: str | None
    reasons: tuple[str, ...]
    version: str = POLICY_VERSION

    def as_dict(self) -> dict[str, Any]:
        return {"version": self.version, "status": self.status,
                "reason": self.reason, "reasons": list(self.reasons),
                "certified3D": False, "sourceIdentityVerified": False}


def assess_ready_candidate(payload: dict) -> QualityAssessment:
    """Review only READY claims; preserve REVIEW/RETRY/INELIGIBLE unchanged.

    `payload` may be either a GPU worker set.json or a pending lot import.
    An absent field is NOT treated as positive evidence; legacy sets must be
    re-evaluated instead of silently grandfathered into READY.
    """
    if payload.get("status") != "READY":
        reason = payload.get("reason")
        return QualityAssessment(payload.get("status") or "REVIEW", reason,
                                 (reason,) if isinstance(reason, str) and reason else ())
    metrics = payload.get("metrics") or {}
    preflight = metrics.get("preflight") or {}
    fusion = metrics.get("fashnOpen") or {}
    att = fusion.get("attestations") or {}
    cleanup = metrics.get("cleanup") or {}
    whole = metrics.get("whole") or {}
    reasons: list[str] = []
    if preflight.get("status") != "PASS":
        reasons.append("POSTFLIGHT_PREFLIGHT_NOT_VERIFIED")
    if not (att.get("complete") is True and att.get("occluded") is False
            and att.get("measurement_verified") is True):
        reasons.append("POSTFLIGHT_COMPLETENESS_NOT_VERIFIED")
    # A garment photographed on a person cannot be certified complete from a
    # binary semantic mask: bodies can hide cuffs/waistbands and leave residue.
    if fusion.get("personDetected") is not False:
        reasons.append("HUMAN_SOURCE_REVIEW_REQUIRED")
    if cleanup.get("cleanupMode") != "STRICT":
        reasons.append("LENIENT_CLEANUP_REVIEW_REQUIRED")
    ghost = whole.get("ghostPixels")
    if not isinstance(ghost, int) or isinstance(ghost, bool) or ghost < 0:
        reasons.append("WHOLE_GHOST_METRIC_MISSING")
    elif ghost > 0:
        reasons.append("GHOST_REGION_REVIEW_REQUIRED")
    if not (whole.get("width") == 900 and whole.get("height") == 1200):
        reasons.append("WHOLE_FRAME_UNVERIFIED")
    if not reasons:
        return QualityAssessment("READY", None, ())
    return QualityAssessment("REVIEW", reasons[0], tuple(reasons))


def apply_quality_gate(payload: dict) -> dict:
    """Copy a JSON-serializable payload; never modify the caller's set.json."""
    result = dict(payload)
    verdict = assess_ready_candidate(result)
    result["postflight"] = verdict.as_dict()
    if payload.get("status") == "READY" and verdict.status != "READY":
        result["status"] = "REVIEW"
        result["reason"] = verdict.reason
    return result
