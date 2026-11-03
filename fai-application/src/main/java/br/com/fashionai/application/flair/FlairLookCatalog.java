package br.com.fashionai.application.flair;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks.Boss;
import br.com.fashionai.application.flair.FlairLooks.Theme;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair.FlairLooks.BOSSES;
import static br.com.fashionai.application.flair.FlairLooks.LABELS;
import static br.com.fashionai.application.flair.FlairLooks.OUTERWEAR;
import static br.com.fashionai.application.flair.FlairLooks.ROLES;
import static br.com.fashionai.application.flair.FlairLooks.THEMES;

/**
 * Tabelas do {@link FlairLooks}: rótulos dos 10 atributos, os temas das rodadas (pesos e condições do tabuleiro), os
 * bosses e as funções do Ultimate Team. Preenche os mapas públicos do motor uma vez, no carregamento da classe.
 */
final class FlairLookCatalog {
    private FlairLookCatalog() {
    }

    static void labels() {
        LABELS.put("HYPE", "HypeScore");
        LABELS.put("STYLE", "Style");
        LABELS.put("COLOR", Msg.k("flairLooks.color_harmony"));
        LABELS.put("OCCASION", Msg.k("flairLooks.occasion_fit"));
        LABELS.put("ORIGINALITY", "Originality");
        LABELS.put("BRAND", Msg.k("flairLooks.brand_power"));
        LABELS.put("RARITY", "Rarity");
        LABELS.put("TREND", "Trend");
        LABELS.put("COMMUNITY", "Community");
        LABELS.put("AI", Msg.k("flairLooks.ai_score"));
    }

    // ------------------------------------------------------------------ temas

    static Map<String, Double> w(Object... kv) {
        Map<String, Double> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], ((Number) kv[i + 1]).doubleValue());
        }
        return m;
    }

    static void theme(Theme t) {
        THEMES.put(t.code(), t);
    }

    static void themes() {
        theme(new Theme("FESTIVAL_NOITE", Msg.k("flairLooks.festival_de_musica_noite"), "🎶", List.of("festival", "party", "night_out"), List.of("streetwear", "boho", "y2k", "edgy"),
                w("STYLE", 1.4, "ORIGINALITY", 1.5, "TREND", 1.4), Msg.k("flairLooks.style_originality_e_trend_recebem")));
        theme(new Theme("DATE_NIGHT", Msg.k("flairLooks.date_night"), "🌙", List.of("date", "night_out"), List.of("romantic", "chic", "glam"),
                w("COLOR", 1.4, "STYLE", 1.3, "OCCASION", 1.3, "AI", 1.1), Msg.k("flairLooks.harmonia_de_cores_e_coerencia")));
        theme(new Theme("BUSINESS_MEETING", Msg.k("flairLooks.business_meeting"), "💼", List.of("work", "business"), List.of("tailored", "classic", "minimalist"),
                w("STYLE", 1.3, "OCCASION", 1.5, "AI", 1.2, "COLOR", 1.1, "ORIGINALITY", 0.6), Msg.k("flairLooks.adequacao_a_ocasiao_pesa_mais")));
        theme(new Theme("MUSIC_FESTIVAL", Msg.k("flairLooks.music_festival"), "🎪", List.of("festival", "outdoor"), List.of("boho", "streetwear", "y2k"),
                w("ORIGINALITY", 1.5, "TREND", 1.3, "STYLE", 1.1), Msg.k("flairLooks.criatividade_em_primeiro_lugar")));
        theme(new Theme("BEACH_CLUB", Msg.k("flairLooks.beach_club"), "🏖️", List.of("beach", "vacation", "party"), List.of("resort", "boho", "minimalist"),
                w("COLOR", 1.3, "OCCASION", 1.4, "TREND", 1.1), Msg.k("common.ocasiao_de_praia_e_cores")));
        theme(new Theme("RED_CARPET", Msg.k("flairLooks.red_carpet"), "🎬", List.of("formal", "ceremony", "party"), List.of("glam", "luxury", "avant_garde"),
                w("BRAND", 1.4, "RARITY", 1.4, "STYLE", 1.2), Set.of(), 0, "luxury", "BRAND", 0.15, null,
                Msg.k("common.formal_luxury_marca_de_celebridade")));
        theme(new Theme("CYBERPUNK_FORMAL", Msg.k("flairLooks.cyberpunk_formal"), "🤖", List.of("formal", "party", "night_out"), List.of("futuristic", "techwear", "tailored", "avant_garde"),
                w("ORIGINALITY", 1.5, "TREND", 1.3, "STYLE", 1.2), Msg.k("flairLooks.tema_da_flair_runway_tecnologia")));
        theme(new Theme("SMART_CASUAL_AUTUMN", Msg.k("flairLooks.smart_casual_outono_jantar"), "🍂", List.of("date", "social", "casual"), List.of("classic", "chic", "preppy"),
                w("STYLE", 1.2, "COLOR", 1.2, "OCCASION", 1.3), Msg.k("flairLooks.challenge_do_deck_battle_smart")));
        theme(new Theme("RAINY_LONDON", Msg.k("common.rainy_london"), "☔", List.of("work", "casual", "outdoor"), List.of("classic", "utility"),
                w("STYLE", 1.1, "AI", 1.1), OUTERWEAR, 10, null, null, 0, null, Msg.k("common.looks_com_outerwear_recebem_bonus")));
        theme(new Theme("MILAN_FASHION_WEEK", Msg.k("common.milan_fashion_week"), "🇮🇹", List.of("formal", "party", "social"), List.of("luxury", "chic", "tailored"),
                w("BRAND", 1.4, "STYLE", 1.2, "RARITY", 1.2), Set.of(), 0, null, null, 0, "luxury", Msg.k("common.use_um_look_com_pelo")));
        theme(new Theme("TOKYO_STREET", Msg.k("common.tokyo_street_challenge"), "🗼", List.of("casual", "night_out", "social"), List.of("streetwear", "y2k", "urban"),
                w("ORIGINALITY", 1.3, "TREND", 1.3, "STYLE", 1.1), Set.of(), 0, "streetwear", "ORIGINALITY", 0.20, null, Msg.k("common.streetwear_recebe_20_originality")));
        theme(new Theme("PARIS_COUTURE", Msg.k("flairLooks.paris_couture"), "🗼", List.of("formal", "date", "ceremony"), List.of("chic", "glam", "romantic"),
                w("STYLE", 1.4, "COLOR", 1.2, "BRAND", 1.2), Msg.k("flairLooks.elegancia_e_coerencia_parisiense")));
        theme(new Theme("SEOUL_KFASHION", Msg.k("common.seoul_k_fashion"), "🇰🇷", List.of("casual", "social", "university"), List.of("modern", "y2k", "minimalist"),
                w("TREND", 1.5, "COLOR", 1.1, "COMMUNITY", 1.2), Msg.k("common.trend_e_comunidade_em_alta")));
        theme(new Theme("NEW_YORK_MINIMAL", Msg.k("common.new_york_minimal"), "🗽", List.of("work", "business", "casual"), List.of("minimalist", "modern", "classic"),
                w("COLOR", 1.4, "STYLE", 1.3, "AI", 1.2), Msg.k("flairLooks.menos_e_mais_harmonia_de")));
        theme(new Theme("SAO_PAULO_TROPICAL", Msg.k("flairLooks.sao_paulo_tropical"), "🌴", List.of("casual", "party", "social"), List.of("resort", "boho", "urban"),
                w("COLOR", 1.2, "ORIGINALITY", 1.2, "COMMUNITY", 1.2), Msg.k("common.cor_calor_e_comunidade")));
        theme(new Theme("LONDON_VINTAGE", Msg.k("flairLooks.london_vintage"), "🎩", List.of("casual", "social", "date"), List.of("vintage", "classic", "grunge"),
                w("TREND", 1.2, "ORIGINALITY", 1.2, "STYLE", 1.1), Msg.k("common.evento_retro_vintage_revival_vale")));
        theme(new Theme("GYM_RUN", Msg.k("flairLooks.treino_ao_ar_livre"), "🏃", List.of("sport", "gym", "outdoor"), List.of("sporty", "athleisure"),
                w("OCCASION", 1.6, "AI", 1.1, "TREND", 1.1), Msg.k("common.esporte_adequacao_acima_de_tudo")));
        theme(new Theme("WEDDING_GUEST", Msg.k("common.casamento_de_dia"), "💐", List.of("wedding", "ceremony", "formal"), List.of("romantic", "classic", "chic"),
                w("OCCASION", 1.4, "COLOR", 1.3, "STYLE", 1.2), Msg.k("flairLooks.convidado_elegante_sem_roubar_a")));
    }

    static void boss(Boss b) {
        BOSSES.put(b.code(), b);
    }

    static void bosses() {
        boss(new Boss("MINIMALIST", Msg.k("flairLooks.the_minimalist"), "👑", "NEW_YORK_MINIMAL", Map.of("STYLE", 100, "COLOR", 95, "AI", 97),
                Msg.k("flairLooks.poucas_cores_e_pecas_coerentes")));
        boss(new Boss("STREET_KING", Msg.k("flairLooks.street_king"), "🔥", "TOKYO_STREET", Map.of("TREND", 96, "ORIGINALITY", 92, "STYLE", 90),
                Msg.k("flairLooks.tenis_cargo_camiseta_ampla_formam")));
        boss(new Boss("LUXURY_QUEEN", Msg.k("flairLooks.luxury_queen"), "💎", "RED_CARPET", Map.of("BRAND", 98, "RARITY", 96, "HYPE", 94),
                Msg.k("flairLooks.no_red_carpet_marca_e")));
        boss(new Boss("COLOR_MASTER", Msg.k("flairLooks.color_master"), "🌈", "SAO_PAULO_TROPICAL", Map.of("COLOR", 99, "ORIGINALITY", 90, "COMMUNITY", 88),
                Msg.k("flairLooks.cores_analogas_vizinhas_no_circulo")));
        boss(new Boss("VINTAGE_COLLECTOR", Msg.k("flairLooks.vintage_collector"), "🧥", "LONDON_VINTAGE", Map.of("TREND", 92, "ORIGINALITY", 94, "RARITY", 90),
                Msg.k("flairLooks.duas_pecas_vintage_ativam_o")));
        boss(new Boss("AVANT_GARDE_AI", Msg.k("flairLooks.avant_garde_ai"), "🧬", "CYBERPUNK_FORMAL", Map.of("ORIGINALITY", 99, "TREND", 95, "AI", 96),
                Msg.k("flairLooks.estilos_ousados_avant_garde_statement")));
    }

    static void roles() {
        ROLES.put("ICON", "RATING");
        ROLES.put("TREND", "TREND");
        ROLES.put("SOCIAL", "COMMUNITY");
        ROLES.put("CREATIVE", "ORIGINALITY");
        ROLES.put("CLASSIC", "STYLE");
        ROLES.put("WILD_CARD", "WILD");
        ROLES.put("SPECIAL", "RARITY");
    }
}
