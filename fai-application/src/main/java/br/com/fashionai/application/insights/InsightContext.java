package br.com.fashionai.application.insights;

import java.util.Locale;

/**
 * Contextos de insights dinâmicos (RF53, contrato GET /api/insights). Os públicos (EXPLORER_*, FEED, SEARCH,
 * BRAND_PROFILE, CREATOR_PROFILE) usam só agregados de itens {@code public_eligible} e funcionam sem login; os pessoais
 * leem o guarda-roupa, o uso e o DNA de quem pede e exigem sessão.
 * <p>
 * Lote A5 (P3-15): FEED (feed da comunidade), SEARCH (busca), BRAND_PROFILE (perfil de marca/celebridade, chave = slug)
 * e CREATOR_PROFILE (perfil pessoal, chave = @ ou id) são públicos; LOOK_EDITOR (editor de look, com as peças escolhidas)
 * é pessoal.
 */
public enum InsightContext {
    EXPLORER_RUNWAY(true),
    EXPLORER_TRENDING(true),
    EXPLORER_RANKING(true),
    EXPLORER_MAP(true),
    EXPLORER_BRANDS(true),
    EXPLORER_GLOBAL(true),
    FEED(true),
    SEARCH(true),
    BRAND_PROFILE(true),
    CREATOR_PROFILE(true),
    CAPSULE(false),
    COPILOT(false),
    AUTOPILOT(false),
    HISTORY(false),
    CLOSET(false),
    LOOKS(false),
    LOOK_EDITOR(false);

    private final boolean publicContext;

    InsightContext(boolean publicContext) {
        this.publicContext = publicContext;
    }

    public boolean isPublic() {
        return publicContext;
    }

    /** Contexto de um perfil (marca, celebridade ou pessoa): exige a chave do perfil ({@code key}). */
    public boolean isProfile() {
        return this == BRAND_PROFILE || this == CREATOR_PROFILE;
    }

    /** Nome do enum (sem diferenciar maiúsculas; hífen vale como sublinhado); desconhecido = nulo. */
    public static InsightContext parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_');
        for (InsightContext c : values()) {
            if (c.name().equals(t)) {
                return c;
            }
        }
        return null;
    }
}
