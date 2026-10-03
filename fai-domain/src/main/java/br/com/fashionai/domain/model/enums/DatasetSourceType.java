package br.com.fashionai.domain.model.enums;

/** RF4 · Proveniência de dados de treinamento: só fontes legalmente utilizáveis entram no dataset. */
public enum DatasetSourceType {
    OWN,
    USER_CONSENTED,
    LICENSED,
    ACADEMIC,
    BRAND_PARTNER,
    MANUFACTURER,
    AUTHORIZED_CATALOG,
    INTERNAL
}
