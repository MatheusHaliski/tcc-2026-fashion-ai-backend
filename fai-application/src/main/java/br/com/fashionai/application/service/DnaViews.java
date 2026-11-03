package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.StyleArchetype;

import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Views do DNA de Estilo: rótulos dos arquétipos, Camada 1/2 para o dono ou visitante, formulário da
 * Identidade de Vida e resumo de peça usado nas células.
 */
final class DnaViews {
    static final Map<StyleArchetype, String> ARCHETYPE_LABEL = new EnumMap<>(StyleArchetype.class);

    static {
        ARCHETYPE_LABEL.put(StyleArchetype.ROMANTIC, Msg.k("dna.romantico"));
        ARCHETYPE_LABEL.put(StyleArchetype.DRAMATIC, Msg.k("dna.dramatico"));
        ARCHETYPE_LABEL.put(StyleArchetype.CLASSIC, Msg.k("dna.classico"));
        ARCHETYPE_LABEL.put(StyleArchetype.NATURAL, "Natural");
        ARCHETYPE_LABEL.put(StyleArchetype.GAMINE, "Gamine");
    }

    private DnaViews() {
    }

    static Map<String, Object> lifeFormSpec() {
        return Map.of("places", Map.of("label", "Lugares", "max", 3, "examples", Msg.t("dna.cidade_natal_lugar_favorito_destino")),
                "people", Map.of("label", "Pessoas", "max", 3, "examples", Msg.t("dna.nomes_ou_apelidos_sem_foto")),
                "animals", Map.of("label", "Animais", "max", 2, "examples", Msg.t("dna.nome_e_especie_do_pet")),
                "objects", Map.of("label", Msg.t("dna.objetos_itens"), "max", 4, "examples", Msg.t("dna.instrumento_livro_bebida_hobby_esporte")),
                "maxChars", 30, "encrypted", true);
    }

    static Map<String, Object> view(StyleDna d, boolean owner) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("archetype", d.getArchetype().name());
        m.put("archetypeLabel", ARCHETYPE_LABEL.get(d.getArchetype()));
        m.put("palette", Json.csv(d.getColorPalette()).stream().map(c -> Map.of("color", c, "hex", c.startsWith("#") ? c : Taxonomy.hex(c))).toList());
        m.put("silhouette", d.getSilhouette());
        m.put("boldnessIndex", d.getBoldnessIndex());
        m.put("iconPiece", d.getIconPieceName());
        m.put("styles", Json.csv(d.getStyleKeywords()));
        m.put("occasions", Json.csv(d.getOccasionKeywords()));
        m.put("phrase", d.getIdentityPhrase());
        m.put("phraseSource", d.getPhraseSource());
        m.put("colorSeason", d.getColorSeason());
        m.put("synthesizedAt", d.getSynthesizedAt());
        if (owner) {
            m.put("life", Json.map(d.getLifeIdentityJson()));
            m.put("privateFields", Json.strings(d.getLifePrivateFieldsJson()));
        }
        m.put("cardImageUrl", d.getCardImageUrl());
        m.put("cardExpiresAt", d.getCardExpiresAt());
        return m;
    }

    static Map<String, Object> pieceBrief(WardrobeItem w) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.getId());
        m.put("name", w.getName());
        m.put("imageUrl", w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl());
        m.put("brand", w.getBrand() != null ? w.getBrand().getName() : w.getBrandName());
        m.put("category", w.getCategory());
        m.put("color", w.getColor());
        return m;
    }
}
