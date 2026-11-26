package br.com.fashionai.application.service;

import java.math.BigDecimal;
import java.util.Locale;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

/**
 * Exercício 15 — valor mínimo de compra de uma oferta de cupom (promoção de selo ou combinação FLAIR).
 * O valor é decimal exato: zero ou positivo, com até 2 casas e até 99.999.999,99 (DECIMAL(10,2)); três casas são
 * recusadas, nunca arredondadas. Com valor, a moeda contratada é obrigatória e precisa ser uma das suportadas. A
 * moeda em que a pessoa vê os preços não entra aqui. Oferta antiga, gravada sem moeda, continua sem moeda enquanto o
 * valor não mudar: a moeda dela não é inventada.
 */
public final class CouponMinimumRules {
    public static final BigDecimal MAX = new BigDecimal("99999999.99");

    private CouponMinimumRules() {
    }

    /** Mínimo validado; os dois nulos = oferta sem compra mínima (diferente de mínimo zero). */
    public record Minimum(BigDecimal amount, String currency) {
    }

    public static Minimum resolve(BigDecimal amount, String currency, BigDecimal currentAmount, String currentCurrency) {
        if (amount == null) {
            return new Minimum(null, null);
        }
        if (amount.signum() < 0 || amount.compareTo(MAX) > 0 || amount.stripTrailingZeros().scale() > 2) {
            throw ApiException.badRequest("MINIMO_COMPRA_INVALIDO", Msg.t("coupon.minimo_invalido"));
        }
        BigDecimal value = amount.setScale(2);
        if (currency == null || currency.isBlank()) {
            boolean legacyUnchanged = currentCurrency == null && currentAmount != null && currentAmount.compareTo(value) == 0;
            if (!legacyUnchanged) {
                throw ApiException.badRequest("MOEDA_MINIMO_INVALIDA", Msg.t("coupon.minimo_moeda_obrigatoria"));
            }
            return new Minimum(value, null);
        }
        String code = currency.trim().toUpperCase(Locale.ROOT);
        if (!ExchangeRateService.SUPPORTED.contains(code)) {
            throw ApiException.badRequest("MOEDA_MINIMO_INVALIDA", Msg.t("coupon.minimo_moeda_invalida", String.join(", ", ExchangeRateService.SUPPORTED)));
        }
        return new Minimum(value, code);
    }

    /** O valor só quando está em reais (ou é antigo, sem moeda): os textos prontos do servidor escrevem "R$". */
    public static BigDecimal inBrl(BigDecimal amount, String currency) {
        return currency == null || "BRL".equals(currency) ? amount : null;
    }
}
