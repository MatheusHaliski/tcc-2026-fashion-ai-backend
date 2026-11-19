package br.com.fashionai.domain.model.enums;

/** Look do Dia Vivido §3 — quem vai ver a pessoa naquele dia. SO_EU nunca sai do perfil dela. */
public enum DailyLookAudience {
    SO_EU,
    FAMILIA,
    TRABALHO,
    AMIGOS,
    ALGUEM_ESPECIAL,
    PUBLICO;

    /** Só a pessoa: o registro não participa de nada público. */
    public boolean privateOnly() {
        return this == SO_EU;
    }
}
