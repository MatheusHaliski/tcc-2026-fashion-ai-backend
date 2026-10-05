package br.com.fashionai.domain.model.enums;

/** RF47 · Arquivo derivado de uma foto oficial (só existe no modo MATERIALIZED; a fonte nunca é sobrescrita). */
public enum CatalogImageAssetKind {
    /** cópia fiel da fonte (restrita à equipe) */
    SOURCE_COPY,
    /** master 4:5 com fundo transparente (restrito) */
    MASTER_TRANSPARENT,
    /** master 4:5 em fundo branco */
    MASTER_WHITE,
    /** master 4:5 em fundo neutro #F2F2F2 */
    MASTER_NEUTRAL,
    /** card 4:5 (fundo do card, pode ter o recorte semântico) */
    CARD,
    /** quadrado 1:1 (resultado da busca, miniatura do pick) */
    SQUARE,
    THUMBNAIL,
    /** close da região-assinatura (gola, cós, cadarço, mostrador…) */
    DETAIL,
    /** entrada limpa para o analisador de IA (restrito) */
    AI_ANALYSIS
}
