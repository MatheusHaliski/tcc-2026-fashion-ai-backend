package br.com.fashionai.application.atelierproject;

import br.com.fashionai.application.atelierproject.AtelierProjectViews.Measurement;
import br.com.fashionai.application.atelierproject.AtelierProjectViews.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Regra pura da ficha completa: família, modelagem, tecido e ao menos uma medida, todas com ponto, protocolo e valor
 * positivo. Usada pela revisão que aprova a exposição, pela ficha técnica e pela encomenda à Fábrica FashionAI.
 */
public final class TechPackCompleteness {
    private TechPackCompleteness() {
    }

    public static List<String> missing(Specification s) {
        List<String> out = new ArrayList<>();
        if (blank(s.family())) {
            out.add("family");
        }
        if (blank(s.modeling())) {
            out.add("modeling");
        }
        if (blank(s.fabric())) {
            out.add("fabric");
        }
        if (s.measurements() == null || s.measurements().isEmpty() || s.measurements().stream().anyMatch(TechPackCompleteness::incomplete)) {
            out.add("measurements");
        }
        return List.copyOf(out);
    }

    private static boolean incomplete(Measurement m) {
        return m == null || blank(m.point()) || blank(m.protocol()) || m.centimeters() == null || m.centimeters().signum() <= 0;
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
