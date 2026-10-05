package br.com.fashionai.domain.model.enums;

/**
 * Estado de uma versão da identidade do avatar (AVATAR-ID I1):
 * <ul>
 *   <li>{@code DRAFT}: criada, ainda sem relatório de qualidade nem aprovação da pessoa;</li>
 *   <li>{@code NEEDS_REFINEMENT}: o gate de identidade reprovou alguma métrica; a pessoa vê o avatar com aviso, mas
 *       outras pessoas continuam vendo a última versão aprovada;</li>
 *   <li>{@code APPROVED}: passou no gate e a pessoa confirmou (salvar depois da prévia é a confirmação), ou a pessoa
 *       aprovou mesmo com avisos.</li>
 * </ul>
 */
public enum IdentityStatus {
    DRAFT, NEEDS_REFINEMENT, APPROVED
}
