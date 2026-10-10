package br.com.fashionai.domain.model.enums;

/** De onde veio uma entidade do catálogo global (marcas): o reset de usuários demo nunca apaga catálogo. */
public enum CatalogOrigin {
    REAL,
    SEED,
    /** Só para QA/demo; removível apenas pelo reset de catálogo demo, e só sem referências. */
    DEMO
}
