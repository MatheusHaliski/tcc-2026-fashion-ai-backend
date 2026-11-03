package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.StyleDna;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Frase de Identidade do DNA: síntese pela IA com o fallback local, sem vazar campos privados da Camada 2.
 */
final class DnaIdentityPhrase {
    private final AiEngine ai;

    DnaIdentityPhrase(AiEngine ai) {
        this.ai = ai;
    }

    /** Frase de Identidade: a IA sintetiza (não lista); campos privados podem influenciar, mas nunca aparecem literalmente. */
    void phrase(CurrentUser user, StyleDna d) {
        Map<String, Object> life = Json.map(d.getLifeIdentityJson());
        List<String> hidden = Json.strings(d.getLifePrivateFieldsJson());
        boolean withLife = !life.isEmpty() && life.values().stream().anyMatch(v -> v instanceof List<?> l && !l.isEmpty());
        String local = localPhrase(d, life, hidden);
        Set<String> privateValues = new HashSet<>();
        for (String h : hidden) {
            if (life.get(h) instanceof List<?> l) {
                l.forEach(x -> privateValues.add(String.valueOf(x)));
            }
        }
        String prompt = Msg.t("dna.arquetipo_paleta_silhueta_ousadia_100", DnaViews.ARCHETYPE_LABEL.get(d.getArchetype()), d.getColorPalette(), d.getSilhouette(), d.getBoldnessIndex(), d.getIconPieceName(), d.getStyleKeywords(), (withLife ? Msg.t("dna.identidade_de_vida_use_como", privateValues, Json.write(life)) : ""));
        AiOutcome<String> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.DNA_SYNTHESIZER,
                Msg.t("dna.escreva_a_frase_de_identidade", Msg.languageName()),
                prompt, List.of(), 200, withLife ? List.of(Msg.t("dna.camada_1_estilo"), Msg.t("dna.camada_2_identidade_de_vida")) : List.of(Msg.t("dna.camada_1_estilo")),
                text -> {
                    if (text == null || text.isBlank()) {
                        return null;
                    }
                    String t = InputSanitizer.clean(text.replace("\"", "").trim(), 240);
                    for (String pv : privateValues) {
                        if (!pv.isBlank() && t.toLowerCase(Locale.ROOT).contains(pv.toLowerCase(Locale.ROOT))) {
                            return null; // vazaria um campo privado no card → usa a frase local
                        }
                    }
                    return t;
                }, () -> local, null));
        d.setIdentityPhrase(outcome.value() == null ? local : outcome.value());
        d.setPhraseSource(withLife ? "STYLE_AND_LIFE" : "STYLE_ONLY");
    }

    static String localPhrase(StyleDna d, Map<String, Object> life, List<String> hidden) {
        String base = DnaViews.ARCHETYPE_LABEL.get(d.getArchetype()) + " de silhueta " + d.getSilhouette() + (d.getIconPieceName() == null ? "" : Msg.t("dna.que_chega_de", d.getIconPieceName()));
        List<String> bits = new ArrayList<>();
        for (String k : List.of("objects", "places", "animals")) {
            if (!hidden.contains(k) && life.get(k) instanceof List<?> l && !l.isEmpty()) {
                String v = String.valueOf(l.get(0));
                bits.add(switch (k) {
                    case "objects" -> "leva " + v + " na rotina";
                    case "places" -> "tem " + v + " no mapa";
                    default -> Msg.t("dna.divide_os_dias_com", v);
                });
            }
        }
        return InputSanitizer.clean(base + (bits.isEmpty() ? " — " + (d.getBoldnessIndex() >= 60 ? Msg.t("common.sem_medo_de_arriscar") : Msg.t("dna.com_elegancia_serena")) : ", " + String.join(" e ", bits)) + ".", 240);
    }
}
