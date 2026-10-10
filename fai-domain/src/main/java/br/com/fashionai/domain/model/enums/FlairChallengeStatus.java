package br.com.fashionai.domain.model.enums;

/**
 * Estado administrativo do Desafio de Montagem. A janela (aberto, em breve, encerrado) não é estado gravado: sai do
 * relógio do servidor e da janela do Momento (FLAIR-UT §14, E1–E2). Desafio encerrado vira Memória, nunca é apagado.
 */
public enum FlairChallengeStatus {
    DRAFT,
    ACTIVE,
    ARCHIVED
}
