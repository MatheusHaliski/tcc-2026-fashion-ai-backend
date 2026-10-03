package br.com.fashionai.domain.model.enums;

/** RF4 · Model Registry — CANDIDATE (avaliado) → SHADOW (roda sem decidir) → CANARY → PRODUCTION → RETIRED. */
public enum ModelDeploymentStatus {
    CANDIDATE,
    SHADOW,
    CANARY,
    PRODUCTION,
    RETIRED
}
