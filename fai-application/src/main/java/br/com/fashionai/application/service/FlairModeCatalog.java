package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.service.FlairModesService.Mode;
import br.com.fashionai.application.service.FlairModesService.Square;
import br.com.fashionai.application.service.FlairModesService.Territory;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static br.com.fashionai.application.service.FlairModesService.REWARDED_PER_MODE_DAY;

/** Catálogo estático do FLAIR: os 15 modos, o tabuleiro do World Tour, as cidades e os territórios do Monopoly/Conquest. */
final class FlairModeCatalog {
    private FlairModeCatalog() {
    }

    static final List<Mode> MODES = List.of(
            new Mode("BATTLE", Msg.k("flairModes.battle_of_looks"), "⚔️", "NUCLEO", Msg.k("flairModes.look_look_com_tema_sorteado"), Msg.k("flairModes.o_tema_muda_os_pesos")),
            new Mode("SQUAD", Msg.k("flairModes.flair_squad"), "👥", "NUCLEO", Msg.k("flairModes.n5_looks_5_looks_em"), Msg.k("flairModes.date_night_business_meeting_music")),
            new Mode("LEAGUE", Msg.k("flairModes.fashion_league"), "🏆", "NUCLEO", Msg.k("flairModes.temporada_com_tabela_pontos_e"), Msg.k("flairModes.n5_titulares_3_reservas_e")),
            new Mode("TOUR", Msg.k("flairModes.fashion_world_tour"), "🎲", "NUCLEO", Msg.k("flairModes.tabuleiro_paris_sao_paulo"), Msg.k("flairModes.role_o_dado_caia_numa")),
            new Mode("CONQUEST", Msg.k("flairModes.flair_conquest"), "🗺️", "NUCLEO", Msg.k("flairModes.conquiste_regioes_de_estilo_com"), Msg.k("flairModes.atacante_defensor_3_confrontos_quem")),
            new Mode("DECK", Msg.k("flairModes.deck_battle"), "🃏", "NUCLEO", Msg.k("flairModes.tcg_12_cartas_monte_o"), Msg.k("flairModes.n4_superiores_3_inferiores_2")),
            new Mode("WARDROBE", Msg.k("flairModes.wardrobe_wars"), "🧥", "ESPECIAL", Msg.k("flairModes.guarda_roupa_guarda_roupa"), Msg.k("flairModes.n7_rodadas_qualidade_diversidade")),
            new Mode("RUNWAY", Msg.k("flairModes.flair_runway"), "✨", "ESPECIAL", Msg.k("flairModes.competicao_de_passarela_com_8"), Msg.k("flairModes.qualificacao_semifinal_final_40_ia")),
            new Mode("DRAFT", Msg.k("flairModes.flair_draft"), "🧩", "ESPECIAL", Msg.k("flairModes.n20_pecas_escolha_alternada_3"), Msg.k("flairModes.habilidade_de_composicao_acima_de")),
            new Mode("TAG_TEAM", Msg.k("flairModes.flair_tag_team"), "🤝", "ESPECIAL", Msg.k("flairModes.n2_usuarios_2_usuarios"), Msg.k("flairModes.cada_um_entra_com_um")),
            new Mode("BOSS", Msg.k("flairModes.fashion_boss"), "👑", "ESPECIAL", Msg.k("flairModes.venca_os_chefes_controlados_pela"), Msg.k("flairModes.the_minimalist_street_king_luxury")),
            new Mode("COMBO", Msg.k("flairModes.combo_battle"), "⚡", "ESPECIAL", Msg.k("flairModes.sinergias_entre_pecas_decidem"), Msg.k("flairModes.streetwear_classic_formal_monochrome")),
            new Mode("MONOPOLY", Msg.k("flairModes.fashion_monopoly"), "🏙️", "ESPECIAL", Msg.k("flairModes.conquiste_distritos_e_boutiques"), Msg.k("flairModes.o_dono_do_distrito_ganha")),
            new Mode("CHESS", Msg.k("flairModes.flair_chess"), "♟️", "ESPECIAL", Msg.k("flairModes.tabuleiro_3_3_a_posicao"), Msg.k("flairModes.cartas_adjacentes_se_influenciam_hero")),
            new Mode("ULTIMATE", Msg.k("flairModes.flair_ultimate_team"), "🌟", "ESPECIAL", Msg.k("flairModes.n7_looks_titulares_com_funcoes"), Msg.k("flairModes.icon_trend_social_creative_classic")));

    static final List<String> CITIES = List.of("Paris", "Milan", "London", "Tokyo", "Seoul", Msg.k("flairModes.new_york"), Msg.k("flairModes.sao_paulo"));
    static final List<Square> BOARD = board();

    static List<Square> board() {
        List<Square> b = new ArrayList<>();
        String[][] data = {
                {"Paris", Msg.t("flairModes.largada_paris"), "🗼", "START", "PARIS_COUTURE", "0", "10", Msg.t("flairModes.passe_pela_largada_10_pontos")},
                {"Paris", Msg.t("flairModes.paris_couture_week"), "👗", "CHALLENGE", "PARIS_COUTURE", "62", "30", Msg.t("flairModes.look_elegante_e_coerente_style")},
                {"Paris", Msg.t("flairModes.cafe_de_flore"), "☕", "BONUS", "DATE_NIGHT", "0", "15", Msg.t("flairModes.pausa_para_o_cafe_15")},
                {"Paris", Msg.t("flairModes.aeroporto_cdg"), "✈️", "AIRPORT", "PARIS_COUTURE", "0", "0", Msg.t("flairModes.voe_direto_para_a_proxima")},
                {"Milan", Msg.t("common.milan_fashion_week"), "🇮🇹", "CHALLENGE", "MILAN_FASHION_WEEK", "64", "35", Msg.t("common.use_um_look_com_pelo")},
                {"Milan", Msg.t("flairModes.via_montenapoleone"), "🛍️", "CHALLENGE", "RED_CARPET", "60", "30", Msg.t("flairModes.marca_e_raridade_contam_mais")},
                {"Milan", Msg.t("flairModes.atelie_aberto"), "🧵", "BONUS", "MILAN_FASHION_WEEK", "0", "15", Msg.t("flairModes.visita_ao_atelie_15")},
                {"Milan", Msg.t("flairModes.aeroporto_mxp"), "✈️", "AIRPORT", "MILAN_FASHION_WEEK", "0", "0", Msg.t("flairModes.voe_para_londres")},
                {"London", Msg.t("common.rainy_london"), "☔", "CHALLENGE", "RAINY_LONDON", "60", "30", Msg.t("common.looks_com_outerwear_recebem_bonus")},
                {"London", Msg.t("flairModes.portobello_road"), "🎩", "CHALLENGE", "LONDON_VINTAGE", "60", "30", Msg.t("common.evento_retro_vintage_revival_vale")},
                {"London", Msg.t("flairModes.cha_das_cinco"), "🫖", "BONUS", "LONDON_VINTAGE", "0", "15", Msg.t("flairModes.n15_pontos")},
                {"London", "Heathrow", "✈️", "AIRPORT", "RAINY_LONDON", "0", "0", Msg.t("flairModes.voe_para_toquio")},
                {"Tokyo", Msg.t("common.tokyo_street_challenge"), "🗼", "CHALLENGE", "TOKYO_STREET", "62", "35", Msg.t("common.streetwear_recebe_20_originality")},
                {"Tokyo", Msg.t("flairModes.harajuku_sunday"), "🌸", "CHALLENGE", "FESTIVAL_NOITE", "60", "30", Msg.t("flairModes.ousadia_e_tendencia")},
                {"Tokyo", Msg.t("flairModes.karaoke"), "🎤", "BONUS", "FESTIVAL_NOITE", "0", "15", Msg.t("flairModes.n15_pontos")},
                {"Tokyo", "Haneda", "✈️", "AIRPORT", "TOKYO_STREET", "0", "0", Msg.t("flairModes.voe_para_seul")},
                {"Seoul", Msg.t("common.seoul_k_fashion"), "🇰🇷", "CHALLENGE", "SEOUL_KFASHION", "60", "30", Msg.t("common.trend_e_comunidade_em_alta")},
                {"Seoul", Msg.t("flairModes.gangnam_night"), "🌃", "CHALLENGE", "DATE_NIGHT", "60", "30", Msg.t("flairModes.harmonia_de_cores_para_a")},
                {"Seoul", Msg.t("flairModes.mercado_myeongdong"), "🍢", "BONUS", "SEOUL_KFASHION", "0", "15", Msg.t("flairModes.n15_pontos")},
                {"Seoul", "Incheon", "✈️", "AIRPORT", "SEOUL_KFASHION", "0", "0", Msg.t("flairModes.voe_para_nova_york")},
                {Msg.t("flairModes.new_york"), Msg.t("common.new_york_minimal"), "🗽", "CHALLENGE", "NEW_YORK_MINIMAL", "62", "30", Msg.t("flairModes.menos_e_mais")},
                {Msg.t("flairModes.new_york"), Msg.t("flairModes.red_carpet_met"), "🎬", "CHALLENGE", "RED_CARPET", "66", "45", Msg.t("common.formal_luxury_marca_de_celebridade")},
                {Msg.t("flairModes.new_york"), Msg.t("flairModes.central_park_run"), "🏃", "CHALLENGE", "GYM_RUN", "58", "25", Msg.t("common.esporte_adequacao_acima_de_tudo")},
                {Msg.t("flairModes.new_york"), "JFK", "✈️", "AIRPORT", "NEW_YORK_MINIMAL", "0", "0", Msg.t("flairModes.voe_para_sao_paulo")},
                {Msg.t("flairModes.sao_paulo"), "SPFW", "🌴", "CHALLENGE", "SAO_PAULO_TROPICAL", "62", "35", Msg.t("common.cor_calor_e_comunidade")},
                {Msg.t("flairModes.sao_paulo"), Msg.t("flairModes.beach_club_em_maresias"), "🏖️", "CHALLENGE", "BEACH_CLUB", "60", "30", Msg.t("common.ocasiao_de_praia_e_cores")},
                {Msg.t("flairModes.sao_paulo"), Msg.t("flairModes.rua_oscar_freire"), "🛍️", "BONUS", "SAO_PAULO_TROPICAL", "0", "20", Msg.t("flairModes.n20_pontos")},
                {Msg.t("flairModes.sao_paulo"), Msg.t("common.casamento_de_dia"), "💐", "CHALLENGE", "WEDDING_GUEST", "60", "30", Msg.t("flairModes.convidado_elegante_sem_roubar_a")}};
        for (int i = 0; i < data.length; i++) {
            String[] d = data[i];
            b.add(new Square(i, d[0], d[1], d[2], d[3], d[4], Integer.parseInt(d[5]), Integer.parseInt(d[6]), d[7]));
        }
        return b;
    }

    static final List<Territory> TERRITORIES = List.of(
            new Territory("MONOPOLY", "HARAJUKU", Msg.k("flairModes.harajuku_streetwear_district"), "🗼", "streetwear", "TOKYO_STREET", Msg.k("flairModes.cartas_streetwear_10_no_territorio")),
            new Territory("MONOPOLY", "MILAN_LUX", Msg.k("flairModes.milan_luxury_district"), "🇮🇹", "luxury", "MILAN_FASHION_WEEK", Msg.k("flairModes.cartas_luxury_10_no_territorio")),
            new Territory("MONOPOLY", "PARIS_AVENUE", Msg.k("flairModes.paris_avenue_montaigne"), "🗼", "chic", "PARIS_COUTURE", Msg.k("flairModes.cartas_chic_10_no_territorio")),
            new Territory("MONOPOLY", "LONDON_LANE", Msg.k("flairModes.london_vintage_lane"), "🎩", "vintage", "LONDON_VINTAGE", Msg.k("flairModes.cartas_vintage_10_no_territorio")),
            new Territory("MONOPOLY", "NY_LOFT", Msg.k("flairModes.new_york_minimal_loft"), "🗽", "minimalist", "NEW_YORK_MINIMAL", Msg.k("flairModes.cartas_minimalist_10_no_territorio")),
            new Territory("MONOPOLY", "SEOUL_SQUARE", Msg.k("flairModes.seoul_k_fashion_square"), "🇰🇷", "modern", "SEOUL_KFASHION", Msg.k("flairModes.cartas_modern_10_no_territorio")),
            new Territory("MONOPOLY", "SP_MARKET", Msg.k("flairModes.sao_paulo_tropical_market"), "🌴", "resort", "SAO_PAULO_TROPICAL", Msg.k("flairModes.cartas_resort_10_no_territorio")),
            new Territory("MONOPOLY", "BERLIN_HUB", Msg.k("flairModes.berlin_techwear_hub"), "⚙️", "techwear", "CYBERPUNK_FORMAL", Msg.k("flairModes.cartas_techwear_10_no_territorio")),
            new Territory("CONQUEST", "STREETWEAR", "Streetwear", "🛹", "streetwear", "TOKYO_STREET", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "LUXURY", "Luxury", "💎", "luxury", "RED_CARPET", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "VINTAGE", "Vintage", "📻", "vintage", "LONDON_VINTAGE", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "MINIMAL", Msg.k("flairModes.minimal_fashion"), "◻️", "minimalist", "NEW_YORK_MINIMAL", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "SPORT", "Sport", "🏃", "sporty", "GYM_RUN", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "FORMAL", "Formal", "🎩", "classic", "BUSINESS_MEETING", Msg.k("flairModes.defensor_com_3_looks")),
            new Territory("CONQUEST", "AVANT_GARDE", "Avant-Garde", "🧬", "avant_garde", "CYBERPUNK_FORMAL", Msg.k("flairModes.defensor_com_3_looks")));

    static Territory territory(String map, String code) {
        return TERRITORIES.stream().filter(t -> t.map().equals(map) && t.code().equals(code)).findFirst().orElseThrow(() -> ApiException.notFound(Msg.t("flairModes.territorio")));
    }

    static Map<String, Object> catalog() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("architecture", List.of(Msg.t("flairModes.peca"), "CARD", "LOOK", Msg.t("flairModes.team_deck"), Msg.t("flairModes.competicao")));
        out.put("modes", MODES);
        out.put("stats", FlairLooks.LABELS);
        out.put("themes", FlairLooks.THEMES.values());
        out.put("squadSituations", FlairLooks.SQUAD_SITUATIONS);
        out.put("divisions", FlairLooks.DIVISIONS.stream().map(d -> Map.of("from", Integer.parseInt(d[0]), "code", d[1], "label", d[2])).toList());
        out.put("bosses", FlairLooks.BOSSES.values());
        out.put("board", BOARD);
        out.put("territories", TERRITORIES);
        out.put("chessBoard", FlairLooks.BOARD);
        out.put("roles", FlairLooks.ROLES.keySet());
        out.put("ethics", Msg.t("flairModes.recompensas_do_sistema_sem_aposta", REWARDED_PER_MODE_DAY));
        return out;
    }
}
