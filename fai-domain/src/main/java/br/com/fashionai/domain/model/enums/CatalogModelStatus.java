package br.com.fashionai.domain.model.enums;

/**
 * Estado do modelo 3D de vitrine de um produto do catálogo (V86). Só {@code PUBLISHED} é servido pela API.
 * <ul>
 *   <li>{@code DRAFT}: importado, aguardando uma pessoa conferir (ex.: peça fina demais de lado);</li>
 *   <li>{@code PUBLISHED}: aparece no manequim, no quarto, no visualizador e no card expandido;</li>
 *   <li>{@code RETIRED}: substituído por outro modelo do mesmo produto.</li>
 * </ul>
 * Nenhum estado faz o modelo vestir o avatar: isso é o {@code garment_assets_3d} {@code APPROVED}.
 */
public enum CatalogModelStatus {
    DRAFT, PUBLISHED, RETIRED
}
