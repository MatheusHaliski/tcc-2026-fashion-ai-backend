package br.com.fashionai.domain.model.enums;

/**
 * Look do Dia Vivido (docs/novos-rf/PROPOSTA_LOOK_DO_DIA_VIVIDO.md §3) — para quê a pessoa se vestiu naquele dia.
 * CUIDADO (luto, hospital, dias difíceis) é sensível: nunca entra em carrossel, ranking ou Hype contextual, só no
 * registro da própria pessoa — mesma ideia de {@link MomentNature#sensitive()}.
 */
public enum DailyLookPurpose {
    ENTREVISTA,
    PRIMEIRO_DIA,
    APRESENTACAO,
    TRABALHO_PRESENCIAL,
    HOME_OFFICE,
    ESTUDO,
    ENCONTRO,
    FESTA,
    CERIMONIA,
    VIAGEM,
    CONSULTA,
    LAZER,
    DESCANSO,
    CUIDADO,
    OUTRO;

    /** Propósito que fica só com a pessoa: sem agrupamento público, sem ranking, sem Hype contextual. */
    public boolean sensitive() {
        return this == CUIDADO;
    }
}
