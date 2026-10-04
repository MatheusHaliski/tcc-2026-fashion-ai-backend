package br.com.fashionai.domain.model.enums;

/** RF4 · Decisão do admin sobre uma predição: aceita o valor do usuário, o da IA, outro valor ou descarta o item. */
public enum AiReviewDecision {
    ACCEPT_USER,
    ACCEPT_AI,
    OVERRIDE,
    DISMISS
}
