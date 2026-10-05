package br.com.fashionai.domain.model.enums;

/**
 * RF47 · RN47.03/RN47.11/RN47.12 · O que a fonte oficial autorizou fazer com as fotos dela, com evidência registrada
 * (contrato, termo, e-mail) — fail-closed: sem registro, REFERENCE_ONLY.
 */
public enum CatalogImageRights {
    /** só a URL oficial (hotlink). Análise transitória em memória, sem guardar pixels nem enviar a terceiros. */
    REFERENCE_ONLY,
    /** pode guardar cópia fiel da foto (sem alterar), servida só para a equipe */
    STORE,
    /** pode guardar e publicar versões derivadas (recorte, fundo normalizado, reenquadramento) */
    DERIVE_PUBLISH;

    public boolean allowsStoredCopy() {
        return this != REFERENCE_ONLY;
    }

    public boolean allowsPublishedDerivatives() {
        return this == DERIVE_PUBLISH;
    }
}
