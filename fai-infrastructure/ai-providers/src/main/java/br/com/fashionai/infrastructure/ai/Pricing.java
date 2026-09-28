package br.com.fashionai.infrastructure.ai;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Map;

/**
 * Preço estimado por 1M de tokens (USD) para o log de inferência (RF24.CA16) — é desse log que sai o teto diário de
 * gasto com IA (AiBudget), então nenhum modelo usado pode ficar sem preço. São estimativas de tabela pública; o custo
 * real é conferido na fatura do provedor. Vale o prefixo mais longo ("claude-opus-5-5" antes de "claude-opus-5");
 * modelos desconhecidos usam o preço do modelo padrão da família (Claude → Opus 5; Gemini "pro" → 2.5 Pro; demais
 * Gemini → Flash).
 */
public final class Pricing {
    private record Price(double inputPerMillion, double outputPerMillion) {
    }

    private static final Map<String, Price> PRICES = Map.of(
            "claude-opus-5-5", new Price(4.0, 20.0),
            "claude-opus-5", new Price(5.0, 25.0),
            "claude-sonnet", new Price(2.0, 10.0),
            "claude-haiku-4-5", new Price(1.0, 5.0),
            "gemini-2.5-flash-lite", new Price(0.10, 0.40),
            "gemini-2.5-flash", new Price(0.30, 2.50),
            "gemini-2.5-pro", new Price(1.25, 10.0)
    );
    private static final Price CLAUDE_DEFAULT = PRICES.get("claude-opus-5");
    /**
     * Gemini fora da tabela (ex.: um "gemini-3.x-flash" como modelo padrão): sem preço público conferido aqui, vale o do
     * Flash conhecido mais próximo (2.5 Flash) — melhor aproximar do que gravar custo zero e escapar do teto diário.
     */
    private static final Price GEMINI_FLASH = PRICES.get("gemini-2.5-flash");
    private static final Price GEMINI_PRO = PRICES.get("gemini-2.5-pro");

    private Pricing() {
    }

    /** Busca na web do Claude: US$ 10 por mil buscas (cobrada à parte dos tokens). */
    public static BigDecimal webSearch(long searches) {
        return BigDecimal.valueOf(searches).multiply(new BigDecimal("0.01"));
    }

    public static BigDecimal estimate(String model, long inputTokens, long outputTokens) {
        Price p = price(model);
        double usd = inputTokens / 1_000_000.0 * p.inputPerMillion + outputTokens / 1_000_000.0 * p.outputPerMillion;
        return BigDecimal.valueOf(usd).setScale(6, RoundingMode.HALF_UP);
    }

    private static Price price(String model) {
        String m = model == null ? "" : model;
        return PRICES.entrySet().stream().filter(e -> m.startsWith(e.getKey()))
                .max(Comparator.comparingInt(e -> e.getKey().length())).map(Map.Entry::getValue)
                .orElse(m.startsWith("claude") ? CLAUDE_DEFAULT : m.startsWith("gemini") && m.contains("pro") ? GEMINI_PRO : GEMINI_FLASH);
    }
}
