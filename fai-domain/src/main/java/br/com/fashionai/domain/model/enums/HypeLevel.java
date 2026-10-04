package br.com.fashionai.domain.model.enums;

/** HypeScore v2 — classificação semântica do score 0–100 (limiares em HypeScoreConfig, nunca só cor na interface). */
public enum HypeLevel {
    LOW_SIGNAL,
    NICHE,
    RELEVANT,
    HOT,
    TRENDING,
    VIRAL
}
