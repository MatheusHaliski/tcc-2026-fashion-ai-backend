package br.com.fashionai.domain.model.enums;

/**
 * Estado do HypeScore v2 de uma entidade. "Sem dados" nunca vira 0: {@link #INSUFFICIENT_DATA} guarda score nulo e a
 * interface mostra "Dados insuficientes". "Não calculado" e "desatualizado" são derivados na leitura (sem linha / linha antiga).
 */
public enum HypeStatus {
    AVAILABLE,
    INSUFFICIENT_DATA
}
