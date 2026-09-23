package br.com.fashionai.domain.model.enums;

/** Jobs assíncronos orquestrados pelo motor transversal (RF24) e pelos pipelines RF4/RF5/RF18. */
public enum PipelineJobType {
    PIECE_ANALYSIS,
    FLAT_LAY_STANDARDIZATION,
    CONTENT_MODERATION,
    BACKGROUND_GENERATION,
    SCHEME_CARD_RENDER,
    TRY_ON_2D,
    OUTFIT_RENDER,
    TRY_ON_POLISH,
    CATEGORY_FALLBACK_COMPOSITION,
    STYLE_DNA_SYNTHESIS,
    EMBEDDING_GENERATION,
    HYPE_SCORE_RECALC,
    DATA_EXPORT,
    THREE_D_GENERATION
}
