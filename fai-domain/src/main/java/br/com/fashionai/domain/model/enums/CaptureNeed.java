package br.com.fashionai.domain.model.enums;

/**
 * RF4 · Força do pedido de foto complementar. Nenhum nível bloqueia o cadastro: toda solicitação tem "Pular".
 * STRONGLY_RECOMMENDED = a informação provavelmente só existe nessa vista (ex.: patch da marca atrás da calça).
 */
public enum CaptureNeed {
    STRONGLY_RECOMMENDED,
    RECOMMENDED,
    OPTIONAL
}
