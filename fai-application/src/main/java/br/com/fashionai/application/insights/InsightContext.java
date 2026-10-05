package br.com.fashionai.application.insights;

import java.util.Locale;

/**
 * Contextos de insights dinâmicos (RF53, contrato GET /api/insights). Os públicos (EXPLORER_*) usam só agregados de itens
 * {@code public_eligible} e funcionam sem login; os pessoais leem o guarda-roupa, o uso e o DNA de quem pede e exigem
 * sessão.
 */
public enum InsightContext {
    EXPLORER_RUNWAY(true),
    EXPLORER_TRENDING(true),
    EXPLORER_RANKING(true),
    EXPLORER_MAP(true),
    EXPLORER_BRANDS(true),
    EXPLORER_GLOBAL(true),
    CAPSULE(false),
    COPILOT(false),
    AUTOPILOT(false),
    HISTORY(false),
    CLOSET(false),
    LOOKS(false);

    private final boolean publicContext;

    InsightContext(boolean publicContext) {
        this.publicContext = publicContext;
    }

    public boolean isPublic() {
        return publicContext;
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
