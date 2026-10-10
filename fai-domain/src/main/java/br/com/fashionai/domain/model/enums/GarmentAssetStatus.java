package br.com.fashionai.domain.model.enums;

/**
 * Estado de um asset 3D de roupa (MP-2). Só {@code APPROVED} veste o avatar no provador; qualquer outro estado faz a
 * peça aparecer como prévia 2D identificada.
 * <ul>
 *   <li>{@code DRAFT}: enviado, sem métricas de vestir;</li>
 *   <li>{@code IN_REVIEW}: métricas medidas e dentro do gate, aguardando revisão humana (cor, estampa, logo);</li>
 *   <li>{@code APPROVED}: revisado e liberado;</li>
 *   <li>{@code REJECTED}: reprovado no gate ou na revisão;</li>
 *   <li>{@code RETIRED}: substituído por uma versão nova.</li>
 * </ul>
 */
public enum GarmentAssetStatus {
    DRAFT, IN_REVIEW, APPROVED, REJECTED, RETIRED
}
