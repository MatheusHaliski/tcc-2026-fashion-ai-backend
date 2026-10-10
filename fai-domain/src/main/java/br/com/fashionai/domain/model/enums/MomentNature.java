package br.com.fashionai.domain.model.enums;

/**
 * Natureza do Momento (docs/momentos §4): a plataforma diferencia evento cultural, sazonal, comercial, religioso,
 * FashionAI e privado. Datas religiosas ou culturalmente sensíveis são apresentadas com cuidado e nunca viram
 * competição automaticamente (pontos e ranking desligados por padrão em RELIGIOUS).
 */
public enum MomentNature {
    CULTURAL,
    SEASONAL,
    COMMERCIAL,
    RELIGIOUS,
    FASHIONAI,
    PRIVATE;

    /** Natureza que não deve ser transformada em competição de moda por padrão. */
    public boolean sensitive() {
        return this == RELIGIOUS;
    }
}
