package br.com.fashionai.application.garmentdelivery;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;

import java.math.BigDecimal;

/**
 * Regra pura da entrega fictícia: o primeiro dígito do CEP define a região (faixas regionais dos Correios), o frete
 * fictício e os dias úteis de trânsito. Do CEP só o prefixo de 5 dígitos é guardado; a tela mostra "01310-***".
 */
final class CepRegions {
    private CepRegions() {
    }

    record Region(String code, BigDecimal shipping, int transitDays) {
    }

    private static final Region[] BY_DIGIT = {
            new Region("SP", new BigDecimal("14.90"), 1),
            new Region("SP", new BigDecimal("14.90"), 1),
            new Region("RJ_ES", new BigDecimal("19.90"), 2),
            new Region("MG", new BigDecimal("19.90"), 2),
            new Region("BA_SE", new BigDecimal("27.90"), 4),
            new Region("NE", new BigDecimal("29.90"), 4),
            new Region("N_NE", new BigDecimal("34.90"), 5),
            new Region("CO", new BigDecimal("24.90"), 3),
            new Region("PR_SC", new BigDecimal("21.90"), 2),
            new Region("RS", new BigDecimal("22.90"), 3)};

    /** CEP com ou sem máscara → 8 dígitos; nulo ou vazio → nulo (prévia sem frete); qualquer outra coisa → 400. */
    static String digits(String cep) {
        if (cep == null || cep.isBlank()) {
            return null;
        }
        String digits = cep.replaceAll("[\\s.-]", "");
        if (!digits.matches("\\d{8}") || digits.equals("00000000")) {
            throw ApiException.badRequest("GARMENT_ORDER_INVALID_CEP", Msg.t("garmentDelivery.erro.cep_invalido"));
        }
        return digits;
    }

    static Region of(String digits) {
        return BY_DIGIT[digits.charAt(0) - '0'];
    }

    static String prefix(String digits) {
        return digits.substring(0, 5);
    }

    static String masked(String prefix) {
        return prefix + "-***";
    }
}
