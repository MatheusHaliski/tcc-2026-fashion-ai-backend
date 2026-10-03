package br.com.fashionai.domain.model.enums;

/**
 * RF20/RF21 lacuna 1 — tier do selo, em ordem crescente de alcance:
 * <ul>
 *   <li>{@link #PECA} — 1 peça vinculada ao emissor (menor unidade; botão de alfaiate);</li>
 *   <li>{@link #LOOK} — vários itens ou o look inteiro do emissor (brasão bordado);</li>
 *   <li>{@link #PERFIL} — concedido a um PERFIL inteiro (embaixador da marca, colecionador verificado…), não a uma peça
 *       ou look. É o tier mais restrito: revisão sempre manual e teto de emissão obrigatório (ver
 *       {@code SealPolicies}). Nunca é emitido pelo SealBond Matcher — só o emissor concede.</li>
 * </ul>
 */
public enum SealTier {
    PECA,
    LOOK,
    PERFIL;

    /** Tiers emitidos pelo vínculo de esquema (matcher e selos padrão do perfil): PECA e LOOK. */
    public boolean bondable() {
        return this != PERFIL;
    }
}
