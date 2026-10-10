package br.com.fashionai.domain.model.enums;

/**
 * Privacidade do Momento (§28). Tudo que não é PUBLIC fica fora da descoberta pública, do ranking global e do perfil
 * público, e nunca expõe participantes.
 */
public enum MomentVisibility {
    PRIVATE,
    INVITE_ONLY,
    FRIENDS,
    GROUP,
    PUBLIC;

    public boolean discoverable() {
        return this == PUBLIC;
    }
}
