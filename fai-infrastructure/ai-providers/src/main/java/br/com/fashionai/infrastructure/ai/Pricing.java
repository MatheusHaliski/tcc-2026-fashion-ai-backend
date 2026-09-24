package br.com.fashionai.infrastructure.ai;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * Preço estimado por 1M de tokens (USD) para o log de inferência (RF24.CA16). São estimativas de tabela pública;
 * o custo real é conferido na fatura do provedor. Modelos desconhecidos usam o preço do modelo padrão da família.
 */
public final class Pricing {
    private record Price(double inputPerMillion, double outputPerMillion) {
    }

    private static final Map<String, Price> PRICES = Map.of(
            "claude-opus-5", new Price(5.0, 25.0),
            "claude-haiku-4-5", new Price(1.0, 5.0),
            "gemini-2.5-flash", new Price(0.30, 2.50),
            "gemini-2.5-pro", new Price(1.25, 10.0)
    );

    private Pricing() {
    }

    /** Busca na web do Claude: US$ 10 por mil buscas (cobrada à parte dos tokens). */
    public static BigDecimal webSearch(long searches) {
        return BigDecimal.valueOf(searches).multiply(new BigDecimal("0.01"));
    }

    public static BigDecimal estimate(String model, long inputTokens, long outputTokens) {
        Price p = PRICES.entrySet().stream().filter(e -> model != null && model.startsWith(e.getKey())).map(Map.Entry::getValue)
                .findFirst().orElse(model != null && model.startsWith("claude") ? PRICES.get("claude-opus-5") : PRICES.get("gemini-2.5-flash"));
        double usd = inputTokens / 1_000_000.0 * p.inputPerMillion + outputTokens / 1_000_000.0 * p.outputPerMillion;
        return BigDecimal.valueOf(usd).setScale(6, RoundingMode.HALF_UP);
    }
}
