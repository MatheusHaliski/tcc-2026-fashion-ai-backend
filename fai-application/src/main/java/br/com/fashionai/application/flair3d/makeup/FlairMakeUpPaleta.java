package br.com.fashionai.application.flair3d.makeup;

import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dBeleza;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/** Paleta inicial FashionAI Beauty (BASE_NUCLEOS.md, MAKE UP): famílias por área e os acabamentos. */
public final class FlairMakeUpPaleta {
    public static final List<String> ACABAMENTOS = List.of("FOSCO", "CETIM", "GLOSS");
    public static final Map<String, List<String>> FAMILIAS = familias();

    private FlairMakeUpPaleta() {
    }

    private static Map<String, List<String>> familias() {
        Map<String, List<String>> m = new LinkedHashMap<>();
        m.put(Flair3dBeleza.LABIOS, List.of("NUDE", "ROSA", "CORAL", "VERMELHO", "VINHO"));
        m.put(Flair3dBeleza.BOCHECHAS, List.of("PESSEGO", "ROSA", "BRONZE"));
        m.put(Flair3dBeleza.OLHOS, List.of("MARROM", "DOURADO", "PRETO"));
        return java.util.Collections.unmodifiableMap(m);
    }

    /** A paleta como a API devolve: {familias:{area:[...]}, acabamentos:[...]}. */
    public static Map<String, Object> toMap() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("familias", FAMILIAS);
        m.put("acabamentos", ACABAMENTOS);
        return m;
    }

    /** O que a maquiagem entregue usa fora da paleta ("FAMILIA:LABIOS"), vazio quando está tudo nela. */
    public static List<String> foraDaPaleta(Entrega entrega) {
        List<String> out = new ArrayList<>();
        entrega.maquiagem().forEach((area, m) -> {
            List<String> familias = FAMILIAS.getOrDefault(area, List.of());
            if (m == null || !familias.contains(upper(m.familia()))) {
                out.add("FAMILIA:" + area);
            }
            if (m != null && m.acabamento() != null && !ACABAMENTOS.contains(upper(m.acabamento()))) {
                out.add("ACABAMENTO:" + area);
            }
        });
        return out;
    }

    private static String upper(String v) {
        return Objects.toString(v, "").trim().toUpperCase(Locale.ROOT);
    }
}
