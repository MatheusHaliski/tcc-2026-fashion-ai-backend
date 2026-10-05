package br.com.fashionai.domain.model.enums;

/** RF47 · Como o produto aparece na foto oficial — decide a ordem dos candidatos (packshot antes de foto com modelo). */
public enum CatalogImagePresentation {
    /** produto sozinho, fundo de estúdio liso */
    PACKSHOT,
    /** produto deitado, visto de cima */
    FLAT_LAY,
    /** manequim invisível (a peça "vestida", sem corpo) */
    GHOST_MANNEQUIN,
    /** vestido por modelo, em estúdio */
    ON_MODEL,
    /** cena (rua, ambiente, vários objetos) */
    LIFESTYLE,
    /** close de um detalhe (logo, costura, textura) — nunca vira foto principal */
    DETAIL_SHOT,
    /** amostra de cor/tecido */
    SWATCH,
    UNKNOWN
}
