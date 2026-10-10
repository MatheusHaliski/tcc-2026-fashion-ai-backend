package br.com.fashionai.domain.model.enums;

/** Abrangência: o calendário é contextual (país/região) e nunca assume um calendário nacional como padrão universal (§4). */
public enum MomentScope {
    GLOBAL,
    COUNTRY,
    REGION,
    GROUP,
    PERSONAL
}
