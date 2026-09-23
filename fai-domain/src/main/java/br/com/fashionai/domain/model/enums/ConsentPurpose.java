package br.com.fashionai.domain.model.enums;

/** RF3.CA16-CA21 / RF24.CA15 — uma finalidade por toggle, opt-in, nunca "aceitar tudo". */
public enum ConsentPurpose {
    AI_RECOMMENDATION,
    AI_EXTERNAL_PHOTO_PROCESSING,
    HISTORY_FOR_RECOMMENDATION,
    PERSONALIZED_ADS,
    PARTNER_SHARING,
    BODY_MEASUREMENTS,
    FACIAL_RECOGNITION,
    LOCATION_HISTORY
}
