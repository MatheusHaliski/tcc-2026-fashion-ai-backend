package br.com.fashionai.domain.model.enums;

/** RF54 · Tipo da correção feita pela pessoa numa peça detectada (aprendizado e avaliação, só com consentimento). */
public enum LensFeedbackKind {
    WRONG_CATEGORY,
    WRONG_COLOR,
    WRONG_ATTRIBUTE,
    NOT_CLOTHING,
    MISSING_PIECE,
    BAD_BOX,
    WRONG_MATCH,
    GOOD_MATCH
}
