package br.com.fashionai.application.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import br.com.fashionai.domain.model.IntensidadeTermica;
import br.com.fashionai.domain.model.WardrobeItem;

/**
 * O nível térmico pedido para o look no Vista-me (LEVE, MODERADO, INTENSO, validado na tabela niveis_termicos) contra a
 * intensidade térmica que cada peça declara no cadastro (LEVE, MODERADA, ALTA). É evidência de compatibilidade, não
 * filtro: peça sem intensidade declarada não conta contra o look. E não é clima nem certificado: o frio ou o calor do
 * dia, dito no pedido, é outra coisa ({@link MirrorPromptRules}), e a intensidade é o que a pessoa declarou da peça, não
 * um ensaio do tecido. Puro.
 */
final class MirrorThermalFit {
    /** A intensidade de peça que combina com cada nível do look. */
    static final Map<String, String> INTENSIDADE_DO_NIVEL = Map.of("LEVE", "LEVE", "MODERADO", "MODERADA", "INTENSO", "ALTA");

    private MirrorThermalFit() {
    }

    /** Quantas peças do look declaram intensidade compatível, quantas divergem e quantas não declaram. */
    record Fit(String nivel, int compativeis, int divergentes, int semDado) {
        int score() {
            return compativeis - divergentes;
        }

        Map<String, Object> paraTela() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("nivelTermico", nivel);
            m.put("compativeis", compativeis);
            m.put("divergentes", divergentes);
            m.put("semDado", semDado);
            m.put("base", "INTENSIDADE_DECLARADA_DA_PECA");
            return m;
        }
    }

    static Fit of(String nivel, List<WardrobeItem> look) {
        String esperada = INTENSIDADE_DO_NIVEL.get(nivel);
        int compativeis = 0;
        int divergentes = 0;
        int semDado = 0;
        for (WardrobeItem w : look) {
            String declarada = codigo(w.getIntensidadeTermica());
            if (declarada == null || esperada == null) {
                semDado++;
            } else if (declarada.equals(esperada)) {
                compativeis++;
            } else {
                divergentes++;
            }
        }
        return new Fit(nivel, compativeis, divergentes, semDado);
    }

    /** O código da intensidade declarada da peça, para a IA ler como evidência (nulo se a peça não declara). */
    static String codigo(IntensidadeTermica i) {
        return i == null || i.getCodigo() == null ? null : i.getCodigo();
    }
}
