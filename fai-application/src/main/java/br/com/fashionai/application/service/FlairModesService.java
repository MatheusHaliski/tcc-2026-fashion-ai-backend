package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairLooks;
import br.com.fashionai.application.flair.FlairLooks.Clash;
import br.com.fashionai.application.flair.FlairLooks.Look;
import br.com.fashionai.application.flair.FlairLooks.Theme;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairMatchEntry;
import br.com.fashionai.domain.model.FlairModeState;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.FlairTerritory;
import br.com.fashionai.domain.model.FlairTrophy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairModeStateRepository;
import br.com.fashionai.domain.repository.FlairTerritoryRepository;
import br.com.fashionai.domain.repository.FlairTrophyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * FLAIR como conjunto de modos sobre as mesmas peças, looks, HypeScore e estatísticas do Fashion AI:
 * <b>PEÇA → CARD → LOOK → TEAM/DECK → COMPETIÇÃO</b>. Núcleo: Battle of Looks, FLAIR Squad, Fashion League, Fashion
 * World Tour, FLAIR Conquest e Deck Battle. Eventos especiais: Wardrobe Wars, Runway, Draft, Tag Team, Fashion Boss,
 * Combo Battle, Fashion Monopoly, FLAIR Chess e Ultimate Team. Todos usam o motor {@link FlairLooks}; recompensas vêm
 * do sistema (sem aposta), com teto diário por modo.
 */
@Service
public class FlairModesService {
    static final int REWARDED_PER_MODE_DAY = 3;
    static final Set<String> COMPETITIVE = Set.of("DUEL", "TEAM", "BATTLE", "SQUAD", "LEAGUE", "TAG_TEAM", "CONQUEST", "MONOPOLY", "COMBO", "ULTIMATE");
    private static final SecureRandom DICE = new SecureRandom();

    private final FlairService flair;
    private final SchemeService schemeService;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final WardrobeItemRepository pieces;
    private final UserRepository users;
    private final FlairMatchRepository matches;
    private final FlairMatchEntryRepository entries;
    private final FlairModeStateRepository states;
    private final FlairTerritoryRepository territories;
    private final FlairTrophyRepository trophies;
    private final FlairCoinEntryRepository coins;
    private final NotificationService notifications;
    private final Guard guard;
    private final FaiPointsService faiPoints;

    public FlairModesService(FlairService flair, SchemeService schemeService, SchemeRepository schemes, SchemeItemRepository schemeItems,
                             WardrobeItemRepository pieces, UserRepository users, FlairMatchRepository matches, FlairMatchEntryRepository entries,
                             FlairModeStateRepository states, FlairTerritoryRepository territories, FlairTrophyRepository trophies,
                             FlairCoinEntryRepository coins, NotificationService notifications, Guard guard, FaiPointsService faiPoints) {
        this.faiPoints = faiPoints;
        this.flair = flair;
        this.schemeService = schemeService;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.pieces = pieces;
        this.users = users;
        this.matches = matches;
        this.entries = entries;
        this.states = states;
        this.territories = territories;
        this.trophies = trophies;
        this.coins = coins;
        this.notifications = notifications;
        this.guard = guard;
    }

    // ================================================================== catálogo

    public record Mode(String code, String name, String emoji, String group, String summary, String how) {
    }

    public static final List<Mode> MODES = List.of(
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

    public record Square(int index, String city, String title, String emoji, String type, String theme, int target, int reward, String rule) {
    }

    public static final List<String> CITIES = List.of("Paris", "Milan", "London", "Tokyo", "Seoul", Msg.k("flairModes.new_york"), Msg.k("flairModes.sao_paulo"));
    public static final List<Square> BOARD = board();

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

    public record Territory(String map, String code, String name, String emoji, String style, String theme, String bonus) {
    }

    public static final List<Territory> TERRITORIES = List.of(
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

    public Map<String, Object> catalog() {
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

    // ================================================================== looks e cartas

    static LocalDate today() {
        return FlairService.today();
    }

    static String seasonKey() {
        LocalDate d = today();
        return d.getYear() + "-T" + String.format("%02d", (d.getDayOfYear() - 1) / 28 + 1);
    }

    static String weekKey() {
        LocalDate d = today();
        return d.get(IsoFields.WEEK_BASED_YEAR) + "-W" + String.format("%02d", d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    List<Card> cardsOf(Scheme s) {
        return schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull).map(flair::card).toList();
    }

    Look look(Scheme s) {
        return FlairLooks.look(new FlairLooks.LookInput(s.getId().toString(), s.getTitle(), s.getUser().getUsername(),
                s.getCoverImageUrl() == null || "null".equals(s.getCoverImageUrl()) ? null : s.getCoverImageUrl(),
                s.getHypeScore() == null ? null : s.getHypeScore().doubleValue(), s.getLikeCount(), s.getSaveCount(), s.getCommentCount(),
                s.getShareCount(), s.getRemixCount(), Json.csv(s.getStyle()), Json.csv(s.getOccasion()), s.getSeason() == null ? null : s.getSeason().name(), cardsOf(s)));
    }

    Look lookOfCards(List<Card> cards, String title, String owner) {
        return FlairLooks.look(new FlairLooks.LookInput(null, title, owner, cards.isEmpty() ? null : cards.get(0).imageUrl(), null, 0, 0, 0, 0, 0,
                List.of(), List.of(), null, cards));
    }

    List<Scheme> ownSchemes(UUID userId) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED).stream()
                .filter(s -> !schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).isEmpty()).toList();
    }

    Scheme ownScheme(CurrentUser user, UUID id) {
        Scheme s = schemeService.owned(user, id);
        if (s.getStatus() == SchemeStatus.ARCHIVED) {
            throw ApiException.badRequest("LOOK_ARQUIVADO", Msg.t("flairModes.esse_look_esta_arquivado"));
        }
        return s;
    }

    List<Look> publicLooksOf(CurrentUser viewer, User owner) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && schemeService.canView(viewer, s)).map(this::look)
                .filter(l -> !l.cards().isEmpty()).toList();
    }

    /**
     * Looks públicos da comunidade (a "Casa"), sem os do próprio jogador, sorteados por semente. Só looks que um visitante
     * veria (visibilidade do look × perfil do autor) e de ninguém com bloqueio com o jogador.
     */
    List<Look> houseLooks(UUID exclude, int n, long seed) {
        List<Scheme> pub = new ArrayList<>(schemes.findAllPublic(PageRequest.of(0, 120)).stream().filter(s -> !s.getUser().getId().equals(exclude))
                .filter(s -> schemeService.canView(null, s) && !guard.blocked(exclude, s.getUser().getId())).toList());
        java.util.Collections.shuffle(pub, new Random(seed));
        List<Look> out = new ArrayList<>();
        for (Scheme s : pub) {
            Look l = look(s);
            if (!l.cards().isEmpty()) {
                out.add(l);
            }
            if (out.size() >= n) {
                break;
            }
        }
        return out;
    }

    List<Card> houseCards(UUID exclude, int n, long seed) {
        // findAllPublic já respeita privacidade do perfil, moderação e arquivamento; o bloqueio depende de quem joga
        List<WardrobeItem> pub = new ArrayList<>(pieces.findAllPublic(PageRequest.of(0, 400)).stream()
                .filter(w -> !w.getUser().getId().equals(exclude) && w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> !guard.blocked(exclude, w.getUser().getId())).toList());
        java.util.Collections.shuffle(pub, new Random(seed));
        return pub.stream().limit(n).map(flair::card).toList();
    }

    User opponentUser(CurrentUser user, String opponent) {
        User u = users.findByUsernameIgnoreCase(opponent.trim().replaceFirst("^@", "")).orElseThrow(() -> ApiException.notFound(Msg.t("entity.oponente")));
        if (u.getId().equals(user.id())) {
            throw ApiException.badRequest("OPONENTE_INVALIDO", Msg.t("common.escolha_outra_pessoa_ou_a"));
        }
        return u;
    }

    static boolean house(String opponent) {
        return opponent == null || opponent.isBlank() || "CASA".equalsIgnoreCase(opponent.trim());
    }

    long seed(Object... parts) {
        return Objects.hash(parts) * 31L + today().toEpochDay();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> myLooks(CurrentUser user) {
        List<Look> looks = ownSchemes(user.id()).stream().map(this::look).sorted(Comparator.comparingInt(Look::rating).reversed()).toList();
        return Map.of("looks", looks.stream().map(FlairModesService::lookView).toList(), "stats", FlairLooks.LABELS);
    }

    /** Visão enxuta do look (sem a lista completa de cartas) para as telas de jogo. */
    static Map<String, Object> lookView(Look l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("schemeId", l.schemeId());
        m.put("title", l.title());
        m.put("owner", l.owner());
        m.put("coverUrl", l.coverUrl());
        m.put("rating", l.rating());
        m.put("stats", l.stats());
        m.put("synergies", l.synergies());
        m.put("styles", l.styles());
        m.put("occasions", l.occasions());
        m.put("cards", l.cards().stream().map(c -> Map.of("id", c.id(), "name", c.name(), "imageUrl", String.valueOf(c.imageUrl()), "category", c.category(),
                "rarity", c.rarity(), "power", c.power())).toList());
        return m;
    }

    static Map<String, Object> clashView(Clash c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("label", c.label());
        m.put("a", c.a());
        m.put("b", c.b());
        m.put("scoreA", c.scoreA());
        m.put("scoreB", c.scoreB());
        m.put("winner", c.winner());
        m.put("notes", c.notes());
        m.put("breakdown", c.breakdown());
        return m;
    }

    // ================================================================== registro, recompensa e troféus

    String outcome(String winner) {
        return "DRAW".equals(winner) ? "DRAW" : "A".equals(winner) ? "WIN" : "LOSS";
    }

    static String overall(List<Clash> rounds) {
        long a = rounds.stream().filter(r -> "A".equals(r.winner())).count(), b = rounds.stream().filter(r -> "B".equals(r.winner())).count();
        if (a != b) {
            return a > b ? "A" : "B";
        }
        double sa = rounds.stream().mapToDouble(Clash::scoreA).sum(), sb = rounds.stream().mapToDouble(Clash::scoreB).sum();
        return FlairLooks.winner(sa, sb);
    }

    /** Grava a partida (histórico e vitórias com peça de marca para o Duelo patrocinado) e paga a recompensa do sistema. */
    Map<String, Object> finish(CurrentUser user, String mode, String theme, String winner, Map<String, Object> result, List<Look> mine, User rival, List<Look> theirs) {
        FlairMatch m = new FlairMatch();
        m.setMode(mode);
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setTheme(theme == null ? null : theme.length() > 80 ? theme.substring(0, 80) : theme);
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setWinnerSide(winner);
        m.setResultJson(Json.write(result));
        matches.save(m);
        entry(m, users.findById(user.id()).orElseThrow(), mine, "A", result.get("scoreA"));
        if (rival != null) {
            entry(m, rival, theirs, "B", result.get("scoreB"));
        }
        String outcome = outcome(winner);
        FlairProfile p = flair.profile(user.id());
        switch (outcome) {
            case "WIN" -> p.setWins(p.getWins() + 1);
            case "LOSS" -> p.setLosses(p.getLosses() + 1);
            default -> p.setDraws(p.getDraws() + 1);
        }
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        boolean rewarded = coins.countByUserIdAndReasonAndCreatedAtAfter(user.id(), "MODE_" + mode, dayStart) < REWARDED_PER_MODE_DAY;
        int coinsWon = !rewarded ? 0 : "WIN".equals(outcome) ? 20 : "DRAW".equals(outcome) ? 8 : 3;
        if (coinsWon > 0) {
            flair.award(user.id(), coinsWon, "WIN".equals(outcome) ? 20 : 5, "MODE_" + mode, m.getId().toString());
        }
        if (COMPETITIVE.contains(mode)) {
            flair.rightsCheck(user.id());
        }
        Map<String, Object> out = new LinkedHashMap<>(result);
        out.put("matchId", m.getId());
        out.put("mode", mode);
        out.put("outcome", outcome);
        out.put("coins", coinsWon);
        out.put("rewardCapReached", !rewarded);
        out.put("faiPoints", faiPoints.game(user.id(), "FLAIR_" + mode, m.getId().toString(), outcome));   // RF41
        return out;
    }

    private void entry(FlairMatch m, User u, List<Look> looks, String side, Object score) {
        FlairMatchEntry e = new FlairMatchEntry();
        e.setMatch(m);
        e.setUser(u);
        Look first = looks == null || looks.isEmpty() ? null : looks.get(0);
        e.setScheme(first == null || first.schemeId() == null ? null : schemes.findById(UUID.fromString(first.schemeId())).orElse(null));
        e.setSide(side);
        e.setDeckPower(first == null ? 0 : first.rating());
        e.setScore(score instanceof Number n ? BigDecimal.valueOf(n.doubleValue()) : null);
        e.setBrandPiecesJson(Json.write(looks == null ? List.of() : looks.stream().flatMap(l -> l.cards().stream()).map(Card::brandName)
                .filter(Objects::nonNull).map(x -> x.toLowerCase(Locale.ROOT)).distinct().toList()));
        entries.save(e);
    }

    void trophy(UUID userId, String mode, String title, String season, Map<String, Object> detail) {
        if (trophies.existsByUserIdAndModeAndTitleAndSeasonKey(userId, mode, title, season)) {
            return;
        }
        FlairTrophy t = new FlairTrophy();
        t.setUser(users.findById(userId).orElseThrow());
        t.setMode(mode);
        t.setTitle(title);
        t.setSeasonKey(season);
        t.setDetailJson(Json.write(detail));
        trophies.save(t);
        notifications.notify(userId, null, NotificationType.ACHIEVEMENT_UNLOCKED, "FLAIR_TROPHY", t.getId(), "🏆 " + title, Msg.k("flairModes.novo_trofeu_flair_no_seu"), Map.of("href", "/flair?tab=modos"));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> trophiesOf(UUID userId) {
        return trophies.findByUserIdOrderByCreatedAtDesc(userId).stream().map(t -> Map.<String, Object>of("id", t.getId(), "mode", t.getMode(), "title", t.getTitle(),
                "season", t.getSeasonKey(), "at", t.getCreatedAt())).toList();
    }

    FlairModeState state(UUID userId, String mode, String season) {
        return states.findByUserIdAndModeAndSeasonKey(userId, mode, season).orElseGet(() -> {
            FlairModeState s = new FlairModeState();
            s.setUser(users.findById(userId).orElseThrow());
            s.setMode(mode);
            s.setSeasonKey(season);
            s.setStateJson("{}");
            return states.save(s);
        });
    }

    static List<UUID> ids(Object raw) {
        if (!(raw instanceof List<?> l)) {
            return List.of();
        }
        return l.stream().filter(Objects::nonNull).map(String::valueOf).filter(x -> !x.isBlank()).map(UUID::fromString).toList();
    }

    // ================================================================== 1. Battle of Looks

    @Transactional
    public Map<String, Object> battle(CurrentUser user, UUID schemeId, String opponent, String themeCode) {
        guard.requireCanCreate(user);
        Look mine = look(ownScheme(user, schemeId));
        Theme t = themeCode == null || themeCode.isBlank() ? FlairLooks.drawTheme(seed(schemeId, opponent, "battle", System.nanoTime() / 60_000_000_000L)) : FlairLooks.theme(themeCode);
        User rival = house(opponent) ? null : opponentUser(user, opponent);
        List<Look> pool = rival == null ? houseLooks(user.id(), 6, seed(schemeId, "house")) : publicLooksOf(user, rival);
        if (pool.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico", ((rival == null ? Msg.t("flairModes.a_comunidade") : "@" + rival.getUsername()))));
        }
        Look theirs = pool.stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total())).get();
        Clash c = FlairLooks.battle(mine, theirs, t);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.a_casa", theirs.owner()) : "@" + rival.getUsername(), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", c.scoreA());
        r.put("scoreB", c.scoreB());
        return finish(user, "BATTLE", t.label(), c.winner(), r, List.of(mine), rival, List.of(theirs));
    }

    // ================================================================== 2. FLAIR Squad

    List<Look> pickSquad(List<Look> looks, int n) {
        List<Theme> sits = FlairLooks.SQUAD_SITUATIONS.stream().map(FlairLooks::theme).toList();
        if (looks.size() <= n) {
            return looks;
        }
        // os 5 que cobrem melhor as 5 situações (cada situação pega o melhor ainda livre)
        List<Look> left = new ArrayList<>(looks), out = new ArrayList<>();
        for (Theme t : sits) {
            Look best = left.stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total())).get();
            out.add(best);
            left.remove(best);
            if (out.size() == n) {
                break;
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> squad(CurrentUser user, List<UUID> schemeIds, String opponent) {
        guard.requireCanCreate(user);
        List<Look> mine = schemeIds == null || schemeIds.isEmpty() ? pickSquad(ownSchemes(user.id()).stream().map(this::look).toList(), 5)
                : schemeIds.stream().limit(5).map(id -> look(ownScheme(user, id))).toList();
        if (mine.isEmpty()) {
            throw ApiException.badRequest("SEM_LOOKS", Msg.t("flairModes.monte_ao_menos_um_look"));
        }
        User rival = house(opponent) ? null : opponentUser(user, opponent);
        List<Look> theirs = pickSquad(rival == null ? houseLooks(user.id(), 12, seed("squad")) : publicLooksOf(user, rival), 5);
        if (theirs.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.o_oponente_ainda_nao_tem"));
        }
        List<Theme> sits = FlairLooks.SQUAD_SITUATIONS.stream().map(FlairLooks::theme).toList();
        List<Clash> rounds = FlairLooks.squad(mine, theirs, sits);
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("situations", sits);
        r.put("me", mine.stream().map(FlairModesService::lookView).toList());
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.squad_da_casa") : "@" + rival.getUsername(), "looks", theirs.stream().map(FlairModesService::lookView).toList()));
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        return finish(user, "SQUAD", Msg.t("flairModes.n5_situacoes"), w, r, mine, rival, theirs);
    }

    // ================================================================== 3. Fashion League

    @Transactional
    public Map<String, Object> saveRoster(CurrentUser user, List<UUID> starters, List<UUID> reserves, List<UUID> specials) {
        guard.requireCanCreate(user);
        if (starters == null || starters.isEmpty() || starters.size() > 5) {
            throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.escolha_de_1_a_5"));
        }
        if (reserves != null && reserves.size() > 3 || specials != null && specials.size() > 5) {
            throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.ate_3_reservas_e_5"));
        }
        Set<UUID> all = new HashSet<>(starters);
        if (reserves != null) {
            for (UUID r : reserves) {
                if (!all.add(r)) {
                    throw ApiException.badRequest("ELENCO_INVALIDO", Msg.t("flairModes.um_look_nao_pode_ser"));
                }
            }
        }
        all.forEach(id -> ownScheme(user, id));
        if (specials != null) {
            for (UUID p : specials) {
                WardrobeItem w = pieces.findById(p).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
                guard.requireOwner(user, w.getUser().getId(), "piece:" + p);
            }
        }
        FlairModeState s = state(user.id(), "LEAGUE", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        st.put("starters", starters.stream().map(UUID::toString).toList());
        st.put("reserves", reserves == null ? List.of() : reserves.stream().map(UUID::toString).toList());
        st.put("specials", specials == null ? List.of() : specials.stream().map(UUID::toString).toList());
        st.putIfAbsent("played", 0);
        st.putIfAbsent("wins", 0);
        st.putIfAbsent("draws", 0);
        st.putIfAbsent("losses", 0);
        st.putIfAbsent("points", 0);
        st.putIfAbsent("hype", 0);
        s.setStateJson(Json.write(st));
        return league(user);
    }

    static int num(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> league(CurrentUser user) {
        String season = seasonKey();
        List<Map<String, Object>> table = new ArrayList<>();
        for (FlairModeState s : states.findByModeAndSeasonKey("LEAGUE", season)) {
            Map<String, Object> st = Json.map(s.getStateJson());
            if (ids(st.get("starters")).isEmpty()) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("user", Views.user(s.getUser()));
            row.put("played", num(st.get("played")));
            row.put("wins", num(st.get("wins")));
            row.put("draws", num(st.get("draws")));
            row.put("losses", num(st.get("losses")));
            row.put("points", num(st.get("points")));
            row.put("hype", num(st.get("hype")));
            row.put("division", FlairLooks.division(num(st.get("points"))));
            row.put("you", s.getUser().getId().equals(user.id()));
            table.add(row);
        }
        table.sort(Comparator.comparingInt((Map<String, Object> m) -> num(m.get("points"))).reversed().thenComparing(m -> -num(m.get("hype"))));
        for (int i = 0; i < table.size(); i++) {
            table.get(i).put("position", i + 1);
        }
        Map<String, Object> mine = states.findByUserIdAndModeAndSeasonKey(user.id(), "LEAGUE", season).map(s -> Json.map(s.getStateJson())).orElse(Map.of());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", season);
        out.put("table", table);
        out.put("roster", mine);
        out.put("division", FlairLooks.division(num(mine.get("points"))));
        out.put("rule", Msg.t("flairModes.temporada_de_4_semanas_5"));
        return out;
    }

    List<Look> looksById(List<UUID> ids) {
        return ids.stream().map(id -> schemes.findById(id).orElse(null)).filter(Objects::nonNull).filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).map(this::look).toList();
    }

    List<Card> cardsById(List<UUID> ids) {
        return ids.stream().map(id -> pieces.findById(id).orElse(null)).filter(Objects::nonNull).map(flair::card).toList();
    }

    @Transactional
    public Map<String, Object> playLeague(CurrentUser user) {
        guard.requireCanCreate(user);
        String season = seasonKey();
        FlairModeState mineState = states.findByUserIdAndModeAndSeasonKey(user.id(), "LEAGUE", season)
                .orElseThrow(() -> new ApiException(409, "SEM_ELENCO", Msg.t("flairModes.monte_o_elenco_da_temporada")));
        Map<String, Object> a = Json.map(mineState.getStateJson());
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        long playedToday = entries.findByUserIdAndCreatedAtAfter(user.id(), dayStart).stream().filter(e -> "LEAGUE".equals(e.getMatch().getMode()) && "A".equals(e.getSide())).count();
        if (playedToday >= 3) {
            throw ApiException.conflict("LIMITE_LIGA", Msg.t("flairModes.voce_ja_jogou_3_rodadas"));
        }
        List<FlairModeState> others = states.findByModeAndSeasonKey("LEAGUE", season).stream()
                .filter(s -> !s.getUser().getId().equals(user.id()) && !ids(Json.map(s.getStateJson()).get("starters")).isEmpty()).toList();
        FlairModeState opp = others.stream().min(Comparator.comparingInt((FlairModeState s) -> num(Json.map(s.getStateJson()).get("played")))
                .thenComparing(s -> Math.floorMod(Objects.hash(s.getUser().getId(), today()), 97))).orElse(null);
        int matchday = num(a.get("played")) + 1;
        List<Theme> sits = new ArrayList<>();
        Random rnd = new Random(Objects.hash(season, matchday));
        List<Theme> pool = new ArrayList<>(FlairLooks.THEMES.values());
        java.util.Collections.shuffle(pool, rnd);
        sits.addAll(pool.subList(0, 5));
        List<Look> sa = looksById(ids(a.get("starters"))), ra = looksById(ids(a.get("reserves")));
        List<Card> ca = cardsById(ids(a.get("specials")));
        List<Look> sb, rb;
        List<Card> cb;
        User rival = null;
        Map<String, Object> b = null;
        if (opp != null) {
            rival = opp.getUser();
            b = Json.map(opp.getStateJson());
            sb = looksById(ids(b.get("starters")));
            rb = looksById(ids(b.get("reserves")));
            cb = cardsById(ids(b.get("specials")));
        } else {
            sb = pickSquad(houseLooks(user.id(), 10, seed("league", matchday)), 5);
            rb = List.of();
            cb = List.of();
        }
        List<Clash> rounds = FlairLooks.leagueMatch(sa, ra, ca, sb, rb, cb, sits);
        String w = overall(rounds);
        int hypeA = (int) Math.round(rounds.stream().mapToDouble(Clash::scoreA).sum()), hypeB = (int) Math.round(rounds.stream().mapToDouble(Clash::scoreB).sum());
        table(a, w, "A", hypeA);
        mineState.setStateJson(Json.write(a));
        if (opp != null) {
            table(b, w, "B", hypeB);
            opp.setStateJson(Json.write(b));
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("season", season);
        r.put("matchday", matchday);
        r.put("situations", sits);
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.flair_bots_amistoso_da_casa") : "@" + rival.getUsername()));
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        r.put("division", FlairLooks.division(num(a.get("points"))));
        Map<String, Object> div = FlairLooks.division(num(a.get("points")));
        if (!"BRONZE".equals(div.get("code"))) {
            trophy(user.id(), "LEAGUE", Msg.t("flairModes.fashion_league_divisao", div.get("label")), season, Map.of("points", a.get("points")));
        }
        return finish(user, "LEAGUE", "Rodada " + matchday, w, r, sa, rival, sb);
    }

    static void table(Map<String, Object> st, String winner, String side, int hype) {
        st.put("played", num(st.get("played")) + 1);
        st.put("hype", num(st.get("hype")) + hype);
        if ("DRAW".equals(winner)) {
            st.put("draws", num(st.get("draws")) + 1);
            st.put("points", num(st.get("points")) + 1);
        } else if (side.equals(winner)) {
            st.put("wins", num(st.get("wins")) + 1);
            st.put("points", num(st.get("points")) + 3);
        } else {
            st.put("losses", num(st.get("losses")) + 1);
        }
    }

    // ================================================================== 4. FLAIR Runway

    static final List<String> RUNWAY_THEMES = List.of("CYBERPUNK_FORMAL", "RED_CARPET", "PARIS_COUTURE", "FESTIVAL_NOITE", "SEOUL_KFASHION", "LONDON_VINTAGE");

    static Theme runwayTheme() {
        return FlairLooks.theme(RUNWAY_THEMES.get(Math.floorMod(today().get(IsoFields.WEEK_OF_WEEK_BASED_YEAR), RUNWAY_THEMES.size())));
    }

    static String runwaySeason() {
        return String.format("%02d", (today().getDayOfYear() - 1) / 28 + 1);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> runway(CurrentUser user) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("theme", runwayTheme());
        out.put("week", weekKey());
        out.put("season", runwaySeason());
        out.put("rule", Msg.t("flairModes.n8_looks_qualificacao_8_4"));
        out.put("entry", states.findByUserIdAndModeAndSeasonKey(user.id(), "RUNWAY", weekKey()).map(s -> Json.map(s.getStateJson())).orElse(null));
        return out;
    }

    @Transactional
    public Map<String, Object> enterRunway(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        if (states.findByUserIdAndModeAndSeasonKey(user.id(), "RUNWAY", weekKey()).isPresent()) {
            throw ApiException.conflict("JA_NA_RUNWAY", Msg.t("flairModes.voce_ja_desfilou_nesta_semana"));
        }
        Theme t = runwayTheme();
        Look mine = look(ownScheme(user, schemeId));
        long seed = seed("runway", weekKey());
        // 7 looks convidados da comunidade (um por pessoa), os mais compatíveis com o tema
        Map<String, Look> byOwner = new LinkedHashMap<>();
        houseLooks(user.id(), 40, seed).stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed())
                .forEach(l -> byOwner.putIfAbsent(l.owner(), l));
        List<Look> field = new ArrayList<>();
        field.add(mine);
        byOwner.values().stream().limit(7).forEach(field::add);
        List<Map<String, Object>> stages = new ArrayList<>();
        List<Look> alive = new ArrayList<>(field);
        // qualificação
        Map<Look, Double> q = new LinkedHashMap<>();
        alive.forEach(l -> q.put(l, FlairLooks.runwayScore(l, t, 1, seed)));
        List<Look> top4 = q.entrySet().stream().sorted(Map.Entry.<Look, Double>comparingByValue().reversed()).limit(4).map(Map.Entry::getKey).toList();
        stages.add(Map.of("stage", Msg.t("flairModes.qualificacao"), "results", q.entrySet().stream().sorted(Map.Entry.<Look, Double>comparingByValue().reversed())
                .map(e -> Map.of("title", e.getKey().title(), "owner", e.getKey().owner(), "score", e.getValue(), "you", e.getKey() == mine, "advanced", top4.contains(e.getKey()))).toList()));
        // semifinal
        List<Look> finalists = new ArrayList<>();
        List<Map<String, Object>> semis = new ArrayList<>();
        for (int[] pair : new int[][]{{0, 3}, {1, 2}}) {
            if (top4.size() <= pair[1]) {
                continue;
            }
            Look x = top4.get(pair[0]), y = top4.get(pair[1]);
            double sx = FlairLooks.runwayScore(x, t, 2, seed), sy = FlairLooks.runwayScore(y, t, 2, seed);
            Look win = sx >= sy ? x : y;
            finalists.add(win);
            semis.add(Map.of("a", x.title() + " (@" + x.owner() + ")", "b", y.title() + " (@" + y.owner() + ")", "scoreA", sx, "scoreB", sy, "winner", sx >= sy ? "A" : "B",
                    "you", x == mine || y == mine));
        }
        stages.add(Map.of("stage", "Semifinal", "results", semis));
        Look champion = null;
        if (finalists.size() == 2) {
            double sx = FlairLooks.runwayScore(finalists.get(0), t, 3, seed), sy = FlairLooks.runwayScore(finalists.get(1), t, 3, seed);
            champion = sx >= sy ? finalists.get(0) : finalists.get(1);
            stages.add(Map.of("stage", "Final", "results", List.of(Map.of("a", finalists.get(0).title() + " (@" + finalists.get(0).owner() + ")",
                    "b", finalists.get(1).title() + " (@" + finalists.get(1).owner() + ")", "scoreA", sx, "scoreB", sy, "winner", sx >= sy ? "A" : "B",
                    "you", finalists.contains(mine)))));
        }
        String place = champion == mine ? Msg.t("flairModes.campea_o") : finalists.contains(mine) ? "FINALISTA" : top4.contains(mine) ? "SEMIFINALISTA" : Msg.t("flairModes.qualificacao_2");
        String winner = champion == mine ? "A" : finalists.contains(mine) ? "DRAW" : "B";
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("field", field.stream().map(FlairModesService::lookView).toList());
        r.put("stages", stages);
        r.put("champion", champion == null ? null : Map.of("title", champion.title(), "owner", champion.owner()));
        r.put("place", place);
        r.put("scoreA", q.get(mine));
        r.put("scoreB", champion == null ? 0 : q.get(champion));
        String title = Msg.t("flairModes.flair_runway_season", (champion == mine ? "Winner" : "Finalist"), t.label(), runwaySeason());
        if (champion == mine || finalists.contains(mine)) {
            trophy(user.id(), "RUNWAY", title, weekKey(), Map.of("theme", t.label(), "look", mine.title()));
            r.put("card", title);
        }
        FlairModeState s = state(user.id(), "RUNWAY", weekKey());
        s.setStateJson(Json.write(Map.of("schemeId", schemeId.toString(), "place", place, "stages", stages, "theme", t.label(), "card", String.valueOf(r.get("card")))));
        return finish(user, "RUNWAY", t.label(), winner, r, List.of(mine), null, List.of());
    }

    // ================================================================== 5. Fashion World Tour (tabuleiro)

    @Transactional
    public Map<String, Object> tour(CurrentUser user) {
        FlairModeState s = state(user.id(), "TOUR", seasonKey());
        return tourView(s);
    }

    Map<String, Object> tourView(FlairModeState s) {
        Map<String, Object> st = Json.map(s.getStateJson());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", s.getSeasonKey());
        out.put("board", BOARD);
        out.put("cities", CITIES);
        out.put("position", num(st.get("position")));
        out.put("lap", num(st.get("lap")));
        out.put("points", num(st.get("points")));
        out.put("pending", st.get("pending"));
        out.put("lastRoll", st.get("lastRoll"));
        out.put("log", st.getOrDefault("log", List.of()));
        out.put("rollsLeft", Math.max(0, 6 - num(st.get("rolls_" + today()))));
        out.put("rule", Msg.t("flairModes.role_o_dado_6_por"));
        return out;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> roll(CurrentUser user) {
        guard.requireCanCreate(user);
        FlairModeState s = state(user.id(), "TOUR", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        if (st.get("pending") != null) {
            throw ApiException.conflict("CASA_PENDENTE", Msg.t("flairModes.resolva_o_desafio_da_casa"));
        }
        String rk = "rolls_" + today();
        if (num(st.get(rk)) >= 6) {
            throw ApiException.conflict("SEM_DADOS", Msg.t("flairModes.voce_ja_rolou_6_vezes"));
        }
        st.put(rk, num(st.get(rk)) + 1);
        int dice = DICE.nextInt(6) + 1;
        int pos = num(st.get("position")) + dice;
        List<Map<String, Object>> log = new ArrayList<>((List<Map<String, Object>>) st.getOrDefault("log", new ArrayList<>()));
        if (pos >= BOARD.size()) {
            pos -= BOARD.size();
            st.put("lap", num(st.get("lap")) + 1);
            st.put("points", num(st.get("points")) + 25);
            log.add(0, Map.of("text", Msg.k("flairModes.volta_completa_25"), "at", Instant.now().toString()));
            trophy(user.id(), "TOUR", Msg.t("flairModes.fashion_world_tour_volta", num(st.get("lap"))), seasonKey(), Map.of("points", st.get("points")));
        }
        Square sq = BOARD.get(pos);
        String text;
        switch (sq.type()) {
            case "BONUS", "START" -> {
                st.put("points", num(st.get("points")) + sq.reward());
                text = sq.emoji() + " " + sq.title() + ": +" + sq.reward();
            }
            case "AIRPORT" -> {
                int next = pos + 1;
                while (next < BOARD.size() && !BOARD.get(next).city().equals(BOARD.get(Math.min(BOARD.size() - 1, pos + 1)).city())) {
                    next++;
                }
                pos = Math.min(BOARD.size() - 1, pos + 1);
                sq = BOARD.get(pos);
                text = Msg.t("flairModes.voo_para", sq.city(), sq.emoji(), sq.title());
                if ("CHALLENGE".equals(sq.type())) {
                    st.put("pending", pos);
                }
            }
            default -> {
                st.put("pending", pos);
                text = sq.emoji() + " " + sq.title() + ": " + sq.rule();
            }
        }
        st.put("position", pos);
        st.put("lastRoll", dice);
        log.add(0, Map.of("text", "🎲 " + dice + " · " + text, "at", Instant.now().toString()));
        st.put("log", log.stream().limit(20).toList());
        s.setStateJson(Json.write(st));
        Map<String, Object> out = tourView(s);
        out.put("dice", dice);
        out.put("square", sq);
        return out;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> resolveTour(CurrentUser user, UUID schemeId) {
        FlairModeState s = state(user.id(), "TOUR", seasonKey());
        Map<String, Object> st = Json.map(s.getStateJson());
        if (st.get("pending") == null) {
            throw ApiException.conflict("SEM_DESAFIO", Msg.t("flairModes.nao_ha_desafio_pendente_role"));
        }
        Square sq = BOARD.get(num(st.get("pending")));
        Theme t = FlairLooks.theme(sq.theme());
        Look mine = look(ownScheme(user, schemeId));
        FlairLooks.Score sc = FlairLooks.score(mine, t);
        boolean pass = sc.total() >= sq.target();
        List<Map<String, Object>> log = new ArrayList<>((List<Map<String, Object>>) st.getOrDefault("log", new ArrayList<>()));
        int gained = pass ? sq.reward() : 5;
        st.put("points", num(st.get("points")) + gained);
        st.remove("pending");
        log.add(0, Map.of("text", (pass ? "✅ " : "➖ ") + sq.title() + " com \"" + mine.title() + "\": " + sc.total() + " / alvo " + sq.target() + " → +" + gained, "at", Instant.now().toString()));
        st.put("log", log.stream().limit(20).toList());
        s.setStateJson(Json.write(st));
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("square", sq);
        r.put("theme", t);
        r.put("look", lookView(mine));
        r.put("score", sc);
        r.put("pass", pass);
        r.put("gained", gained);
        r.put("scoreA", sc.total());
        r.put("scoreB", sq.target());
        Map<String, Object> out = finish(user, "TOUR", sq.title(), pass ? "A" : "B", r, List.of(mine), null, List.of());
        out.put("tour", tourView(s));
        return out;
    }

    // ================================================================== 6/7. Fashion Monopoly e FLAIR Conquest

    @Transactional(readOnly = true)
    public Map<String, Object> territories(CurrentUser user, String map) {
        String m = map == null ? "CONQUEST" : map.toUpperCase(Locale.ROOT);
        Map<String, FlairTerritory> owned = territories.findByMapCode(m).stream().collect(Collectors.toMap(FlairTerritory::getTerritoryCode, x -> x));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Territory t : TERRITORIES) {
            if (!t.map().equals(m)) {
                continue;
            }
            FlairTerritory ft = owned.get(t.code());
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("territory", t);
            v.put("theme", FlairLooks.theme(t.theme()));
            v.put("owner", ft == null || ft.getOwner() == null ? null : Views.user(ft.getOwner()));
            v.put("mine", ft != null && ft.getOwner() != null && ft.getOwner().getId().equals(user.id()));
            v.put("defenders", ft == null ? List.of() : looksById(ids(Json.map(ft.getDefenderJson()).get("schemeIds"))).stream().map(l -> Map.of("title", l.title(), "rating", l.rating())).toList());
            v.put("capturedAt", ft == null ? null : ft.getCapturedAt());
            v.put("defenses", ft == null ? 0 : ft.getDefenses());
            list.add(v);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("map", m);
        out.put("territories", list);
        out.put("mine", list.stream().filter(x -> Boolean.TRUE.equals(x.get("mine"))).count());
        out.put("rule", "CONQUEST".equals(m) ? Msg.t("flairModes.ataque_com_3_looks_contra")
                : Msg.t("flairModes.ataque_um_distrito_com_1"));
        return out;
    }

    @Transactional
    public Map<String, Object> attack(CurrentUser user, String map, String code, List<UUID> schemeIds) {
        guard.requireCanCreate(user);
        String m = map.toUpperCase(Locale.ROOT);
        Territory terr = territory(m, code.toUpperCase(Locale.ROOT));
        int need = "CONQUEST".equals(m) ? 3 : 1;
        if (schemeIds == null || schemeIds.size() != need) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", "CONQUEST".equals(m) ? "Ataque com exatamente 3 looks." : Msg.t("flairModes.ataque_com_1_look"));
        }
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        long today = entries.findByUserIdAndCreatedAtAfter(user.id(), dayStart).stream().filter(e -> m.equals(e.getMatch().getMode()) && "A".equals(e.getSide())).count();
        if (today >= 5) {
            throw ApiException.conflict("LIMITE_ATAQUES", Msg.t("flairModes.voce_ja_atacou_5_vezes"));
        }
        FlairTerritory ft = territories.findByMapCodeAndTerritoryCode(m, terr.code()).orElseGet(() -> {
            FlairTerritory x = new FlairTerritory();
            x.setMapCode(m);
            x.setTerritoryCode(terr.code());
            x.setDefenderJson("{}");
            return x;
        });
        if (ft.getOwner() != null && ft.getOwner().getId().equals(user.id())) {
            throw ApiException.conflict("JA_E_SEU", Msg.t("flairModes.esse_territorio_ja_e_seu"));
        }
        Theme t = FlairLooks.theme(terr.theme());
        List<Look> atk = schemeIds.stream().map(id -> look(ownScheme(user, id))).toList();
        List<Look> def = looksById(ids(Json.map(ft.getDefenderJson()).get("schemeIds")));
        User owner = ft.getOwner();
        if (def.size() < need) {
            List<Look> fill = owner == null ? houseLooks(user.id(), 10, seed(m, terr.code())) : publicLooksOf(user, owner);
            List<Look> sorted = fill.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
            List<Look> merged = new ArrayList<>(def);
            for (Look l : sorted) {
                if (merged.size() >= need) {
                    break;
                }
                if (merged.stream().noneMatch(x -> Objects.equals(x.schemeId(), l.schemeId()))) {
                    merged.add(l);
                }
            }
            def = merged;
        }
        if (def.isEmpty()) {
            throw new ApiException(409, "SEM_DEFENSOR", Msg.t("flairModes.ainda_nao_ha_looks_publicos"));
        }
        List<Clash> rounds = new ArrayList<>();
        List<Look> atkSorted = atk.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
        List<Look> defSorted = def.stream().sorted(Comparator.comparingDouble((Look l) -> FlairLooks.score(l, t).total()).reversed()).toList();
        for (int i = 0; i < need; i++) {
            Look a = atkSorted.get(i), d = defSorted.get(Math.min(i, defSorted.size() - 1));
            Clash c = FlairLooks.battle(a, d, t);
            double sb = c.scoreB();
            List<String> notes = new ArrayList<>(c.notes());
            if (owner != null && "MONOPOLY".equals(m) && d.styles().contains(terr.style())) {
                sb = Math.round(sb * 1.10 * 10) / 10.0;
                notes.add(Msg.t("flairModes.b_dono_do_distrito_cartas", terr.style()));
            }
            rounds.add(new Clash(c.label() + " · " + (i + 1), a.title(), d.title(), c.scoreA(), sb, FlairLooks.winner(c.scoreA(), sb), notes, c.breakdown()));
        }
        long wa = rounds.stream().filter(r -> "A".equals(r.winner())).count();
        boolean captured = "CONQUEST".equals(m) ? wa >= 2 : wa >= 1;
        if (captured) {
            ft.setOwner(users.findById(user.id()).orElseThrow());
            ft.setDefenderJson(Json.write(Map.of("schemeIds", schemeIds.stream().map(UUID::toString).toList())));
            ft.setCapturedAt(Instant.now());
            ft.setDefenses(0);
            territories.save(ft);
            String title = "CONQUEST".equals(m) ? Msg.t("flairModes.seu_lookbook_conquistou_a_regiao", terr.name()) : Msg.t("flairModes.voce_conquistou_o_distrito", terr.name());
            notifications.notify(user.id(), null, NotificationType.ACHIEVEMENT_UNLOCKED, "FLAIR_TERRITORY", ft.getId(), "🗺️ " + title,
                    Msg.k("flairModes.seus_looks_agora_defendem_o", terr.emoji()), Map.of("href", "/flair?tab=modos&mode=" + m));
            trophy(user.id(), m, ("CONQUEST".equals(m) ? Msg.t("flairModes.conquest") : Msg.t("flairModes.monopoly")) + terr.name(), seasonKey(), Map.of("territory", terr.code()));
        } else {
            ft.setDefenses(ft.getDefenses() + 1);
            territories.save(ft);
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("territory", terr);
        r.put("theme", t);
        r.put("captured", captured);
        r.put("defender", owner == null ? Msg.t("common.a_casa") : "@" + owner.getUsername());
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("scoreA", wa);
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        return finish(user, m, terr.name(), captured ? "A" : "B", r, atk, owner, def);
    }

    // ================================================================== 8. FLAIR Draft

    @Transactional
    public Map<String, Object> draftStart(CurrentUser user) {
        guard.requireCanCreate(user);
        List<Card> pool = houseCards(user.id(), 20, seed("draft", user.id(), System.nanoTime()));
        if (pool.size() < 12) {
            throw new ApiException(409, "POUCAS_PECAS", Msg.t("flairModes.a_comunidade_ainda_nao_tem"));
        }
        FlairMatch m = new FlairMatch();
        m.setMode("DRAFT");
        m.setStatus("OPEN");
        m.setPlayDate(today());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        List<String> themes = new ArrayList<>(FlairLooks.THEMES.keySet());
        java.util.Collections.shuffle(themes, new Random(seed("draft-themes", user.id())));
        m.setResultJson(Json.write(Map.of("pool", pool.stream().map(Card::id).toList(), "A", List.of(), "B", List.of(), "pick", 0, "themes", themes.subList(0, 3))));
        matches.save(m);
        return draftView(m);
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> draftView(FlairMatch m) {
        Map<String, Object> st = Json.map(m.getResultJson());
        List<UUID> pool = ids(st.get("pool"));
        Map<String, Card> cards = cardsById(pool).stream().collect(Collectors.toMap(Card::id, c -> c, (a, b) -> a, LinkedHashMap::new));
        List<String> a = Json.strings(Json.write(st.get("A"))), b = Json.strings(Json.write(st.get("B")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("status", m.getStatus());
        out.put("pool", cards.values().stream().filter(c -> !a.contains(c.id()) && !b.contains(c.id())).toList());
        out.put("mine", a.stream().map(cards::get).filter(Objects::nonNull).toList());
        out.put("theirs", b.stream().map(cards::get).filter(Objects::nonNull).toList());
        out.put("pick", num(st.get("pick")));
        out.put("turn", num(st.get("pick")) >= pool.size() ? "COMPOSE" : FlairLooks.draftTurn(num(st.get("pick"))));
        out.put("order", Msg.t("flairModes.a_b_b_a_a"));
        out.put("themes", Json.strings(Json.write(st.get("themes"))).stream().map(FlairLooks::theme).toList());
        if (st.get("result") != null) {
            out.put("result", st.get("result"));
        }
        return out;
    }

    FlairMatch ownDraft(CurrentUser user, UUID id, String mode) {
        FlairMatch m = matches.findById(id).orElseThrow(() -> ApiException.notFound(Msg.t("entity.partida")));
        if (!mode.equals(m.getMode()) || !m.getCreatedByUser().getId().equals(user.id())) {
            throw ApiException.notFound(Msg.t("entity.partida"));
        }
        return m;
    }

    @Transactional
    public Map<String, Object> draftPick(CurrentUser user, UUID id, UUID pieceId) {
        FlairMatch m = ownDraft(user, id, "DRAFT");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("DRAFT_FECHADO", Msg.t("flairModes.o_draft_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        List<String> pool = Json.strings(Json.write(st.get("pool")));
        List<String> a = new ArrayList<>(Json.strings(Json.write(st.get("A")))), b = new ArrayList<>(Json.strings(Json.write(st.get("B"))));
        int pick = num(st.get("pick"));
        if (!"A".equals(FlairLooks.draftTurn(pick))) {
            throw ApiException.conflict("VEZ_DO_OPONENTE", Msg.t("flairModes.aguarde_a_escolha_do_oponente"));
        }
        String pid = pieceId.toString();
        if (!pool.contains(pid) || a.contains(pid) || b.contains(pid)) {
            throw ApiException.badRequest("PECA_INDISPONIVEL", Msg.t("flairModes.essa_peca_nao_esta_mais"));
        }
        a.add(pid);
        pick++;
        Map<String, Card> cards = cardsById(ids(st.get("pool"))).stream().collect(Collectors.toMap(Card::id, c -> c, (x, y) -> x));
        // a IA escolhe na vez dela: equilibra categorias (3 partes de cima, 3 de baixo, 3 calçados, 1 acessório) e depois poder
        while (pick < pool.size() && "B".equals(FlairLooks.draftTurn(pick))) {
            Map<String, Long> have = b.stream().map(cards::get).filter(Objects::nonNull).collect(Collectors.groupingBy(c -> "full_body_piece".equals(c.category()) ? "upper_piece" : c.category(), Collectors.counting()));
            Map<String, Integer> want = Map.of("upper_piece", 3, "lower_piece", 3, "shoes_piece", 3, "accessory_piece", 1);
            List<Card> left = pool.stream().filter(x -> !a.contains(x) && !b.contains(x)).map(cards::get).filter(Objects::nonNull).toList();
            Card best = left.stream().max(Comparator.comparingDouble(c -> {
                String cat = "full_body_piece".equals(c.category()) ? "upper_piece" : c.category();
                return (have.getOrDefault(cat, 0L) < want.getOrDefault(cat, 1) ? 1000 : 0) + c.power();
            })).orElse(null);
            if (best == null) {
                break;
            }
            b.add(best.id());
            pick++;
        }
        st.put("A", a);
        st.put("B", b);
        st.put("pick", pick);
        m.setResultJson(Json.write(st));
        return draftView(m);
    }

    @Transactional
    public Map<String, Object> draftFinish(CurrentUser user, UUID id, List<List<UUID>> looks) {
        FlairMatch m = ownDraft(user, id, "DRAFT");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("DRAFT_FECHADO", Msg.t("flairModes.o_draft_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        List<String> pool = Json.strings(Json.write(st.get("pool")));
        if (num(st.get("pick")) < pool.size()) {
            throw ApiException.conflict("DRAFT_EM_ANDAMENTO", Msg.t("flairModes.termine_as_escolhas_antes_de"));
        }
        Set<String> a = new HashSet<>(Json.strings(Json.write(st.get("A"))));
        List<String> b = Json.strings(Json.write(st.get("B")));
        if (looks == null || looks.size() != 3) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.monte_exatamente_3_looks"));
        }
        Set<String> used = new HashSet<>();
        for (List<UUID> l : looks) {
            if (l == null || l.size() < 2) {
                throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.cada_look_precisa_de_ao"));
            }
            for (UUID p : l) {
                if (!a.contains(p.toString()) || !used.add(p.toString())) {
                    throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.use_so_as_suas_escolhas"));
                }
            }
        }
        Map<String, Card> cards = cardsById(ids(st.get("pool"))).stream().collect(Collectors.toMap(Card::id, c -> c, (x, y) -> x));
        List<Theme> themes = Json.strings(Json.write(st.get("themes"))).stream().map(FlairLooks::theme).toList();
        List<Card> aiLeft = new ArrayList<>(b.stream().map(cards::get).filter(Objects::nonNull).toList());
        List<Clash> rounds = new ArrayList<>();
        List<Look> mineLooks = new ArrayList<>(), theirLooks = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            Theme t = themes.get(i);
            List<Card> mc = looks.get(i).stream().map(x -> cards.get(x.toString())).toList();
            Look ml = lookOfCards(mc, "Look " + (i + 1), user.username());
            List<Card> ac = FlairLooks.bestLook(aiLeft, t, cs -> lookOfCards(cs, "IA", "CASA"));
            aiLeft.removeAll(ac);
            Look al = lookOfCards(ac, Msg.t("flairModes.look_ia", (i + 1)), "CASA");
            mineLooks.add(ml);
            theirLooks.add(al);
            rounds.add(FlairLooks.battle(ml, al, t));
        }
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("me", mineLooks.stream().map(FlairModesService::lookView).toList());
        r.put("opponent", Map.of("label", Msg.t("flairModes.ia_do_draft"), "looks", theirLooks.stream().map(FlairModesService::lookView).toList()));
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        st.put("result", r);
        m.setResultJson(Json.write(st));
        m.setStatus("FINISHED");
        m.setWinnerSide(w);
        Map<String, Object> out = finish(user, "DRAFT_RESULT", "Draft", w, r, List.of(), null, List.of());
        return out;
    }

    // ================================================================== 9. Deck Battle (TCG)

    static final Map<String, Integer> DECK_RULE = Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2, "wildcard", 1);

    @Transactional
    public Map<String, Object> deck(CurrentUser user) {
        Map<String, Object> st = Json.map(state(user.id(), "DECK", "ALL").getStateJson());
        List<Card> cards = cardsById(ids(st.get("cards")));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("cards", cards);
        out.put("rule", Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2, "wildcard", 1, "total", 12));
        out.put("valid", cards.size() == 12);
        out.put("suggestion", suggestDeck(user.id()).stream().map(Card::id).toList());
        return out;
    }

    List<Card> suggestDeck(UUID userId) {
        List<Card> mine = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(flair::card)
                .sorted(Comparator.comparingInt(Card::power).reversed()).toList();
        List<Card> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : Map.of("upper_piece", 4, "lower_piece", 3, "shoes_piece", 2, "accessory_piece", 2).entrySet()) {
            mine.stream().filter(c -> e.getKey().equals(c.category()) || "upper_piece".equals(e.getKey()) && "full_body_piece".equals(c.category()))
                    .filter(c -> !out.contains(c)).limit(e.getValue()).forEach(out::add);
        }
        mine.stream().filter(c -> !out.contains(c)).findFirst().ifPresent(out::add);
        return out;
    }

    @Transactional
    public Map<String, Object> saveDeck(CurrentUser user, List<UUID> pieceIds) {
        if (pieceIds == null || pieceIds.size() != 12 || new HashSet<>(pieceIds).size() != 12) {
            throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.o_deck_tem_12_cartas"));
        }
        List<Card> cards = new ArrayList<>();
        for (UUID p : pieceIds) {
            WardrobeItem w = pieces.findById(p).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + p);
            cards.add(flair.card(w));
        }
        Map<String, Long> have = cards.stream().collect(Collectors.groupingBy(c -> "full_body_piece".equals(c.category()) ? "upper_piece" : c.category(), Collectors.counting()));
        int spare = 0;
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece")) {
            long n = have.getOrDefault(cat, 0L);
            if (n < DECK_RULE.get(cat)) {
                throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.faltam_cartas_de", FlairService.CATEGORY_LABELS.getOrDefault(cat, cat), n, DECK_RULE.get(cat)));
            }
            spare += n - DECK_RULE.get(cat);
        }
        if (spare != 1) {
            throw ApiException.badRequest("DECK_INVALIDO", Msg.t("flairModes.composicao_4_superiores_3_inferiores"));
        }
        FlairModeState s = state(user.id(), "DECK", "ALL");
        s.setStateJson(Json.write(Map.of("cards", pieceIds.stream().map(UUID::toString).toList())));
        return deck(user);
    }

    @Transactional
    public Map<String, Object> deckStart(CurrentUser user) {
        guard.requireCanCreate(user);
        List<Card> deck = cardsById(ids(Json.map(state(user.id(), "DECK", "ALL").getStateJson()).get("cards")));
        if (deck.size() < 12) {
            throw new ApiException(409, "SEM_DECK", Msg.t("flairModes.monte_o_deck_de_12"));
        }
        long seed = seed("deck", user.id(), System.nanoTime());
        Theme t = FlairLooks.drawTheme(seed);
        List<Card> shuffled = new ArrayList<>(deck);
        java.util.Collections.shuffle(shuffled, new Random(seed));
        List<Card> hand = new ArrayList<>();
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece")) {
            shuffled.stream().filter(c -> cat.equals(c.category()) || "upper_piece".equals(cat) && "full_body_piece".equals(c.category())).findFirst().ifPresent(c -> {
                hand.add(c);
                shuffled.remove(c);
            });
        }
        shuffled.stream().limit(7 - hand.size()).forEach(hand::add);
        List<Card> houseHand = houseCards(user.id(), 7, seed + 1);
        FlairMatch m = new FlairMatch();
        m.setMode("DECK");
        m.setStatus("OPEN");
        m.setPlayDate(today());
        m.setTheme(t.label());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setResultJson(Json.write(Map.of("theme", t.code(), "hand", hand.stream().map(Card::id).toList(), "house", houseHand.stream().map(Card::id).toList())));
        matches.save(m);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", m.getId());
        out.put("challenge", t);
        out.put("hand", hand);
        out.put("hint", FlairLooks.bestLook(hand, t, cs -> lookOfCards(cs, "dica", user.username())).stream().map(Card::id).toList());
        out.put("rule", Msg.t("flairModes.monte_o_melhor_look_com"));
        return out;
    }

    @Transactional
    public Map<String, Object> deckPlay(CurrentUser user, UUID id, List<UUID> pieceIds) {
        FlairMatch m = ownDraft(user, id, "DECK");
        if (!"OPEN".equals(m.getStatus())) {
            throw ApiException.conflict("PARTIDA_FECHADA", Msg.t("flairModes.essa_partida_ja_terminou"));
        }
        Map<String, Object> st = Json.map(m.getResultJson());
        Set<String> hand = new HashSet<>(Json.strings(Json.write(st.get("hand"))));
        if (pieceIds == null || pieceIds.size() < 2 || pieceIds.size() > 5 || !pieceIds.stream().allMatch(p -> hand.contains(p.toString()))) {
            throw ApiException.badRequest("JOGADA_INVALIDA", Msg.t("flairModes.escolha_de_2_a_5"));
        }
        Theme t = FlairLooks.theme(String.valueOf(st.get("theme")));
        Look mine = lookOfCards(cardsById(pieceIds), Msg.t("flairModes.meu_look"), user.username());
        List<Card> house = cardsById(ids(st.get("house")));
        Look theirs = lookOfCards(FlairLooks.bestLook(house, t, cs -> lookOfCards(cs, "Casa", "CASA")), Msg.t("flairModes.look_da_casa"), "CASA");
        Clash c = FlairLooks.battle(mine, theirs, t);
        m.setStatus("FINISHED");
        m.setWinnerSide(c.winner());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("challenge", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", Msg.t("common.a_casa"), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", c.scoreA());
        r.put("scoreB", c.scoreB());
        return finish(user, "DECK_RESULT", t.label(), c.winner(), r, List.of(mine), null, List.of());
    }

    // ================================================================== 10. Combo Battle

    @Transactional
    public Map<String, Object> combo(CurrentUser user, UUID schemeId, String opponent) {
        guard.requireCanCreate(user);
        Look mine = look(ownScheme(user, schemeId));
        User rival = house(opponent) ? null : opponentUser(user, opponent);
        Theme t = FlairLooks.drawTheme(seed("combo", schemeId));
        List<Look> pool = rival == null ? houseLooks(user.id(), 10, seed("combo-house")) : publicLooksOf(user, rival);
        if (pool.isEmpty()) {
            throw new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.o_oponente_ainda_nao_tem"));
        }
        Look theirs = pool.stream().max(Comparator.comparingDouble(l -> FlairLooks.comboScore(l, t))).get();
        double sa = FlairLooks.comboScore(mine, t), sb = FlairLooks.comboScore(theirs, t);
        List<String> notes = new ArrayList<>();
        FlairLooks.synergies(mine.cards(), t).forEach(x -> notes.add("A: " + x.emoji() + " " + x.label() + " +" + x.bonus() + " " + FlairLooks.LABELS.get(x.stat())));
        FlairLooks.synergies(theirs.cards(), t).forEach(x -> notes.add("B: " + x.emoji() + " " + x.label() + " +" + x.bonus() + " " + FlairLooks.LABELS.get(x.stat())));
        if (notes.isEmpty()) {
            notes.add(Msg.t("flairModes.nenhum_combo_ativado_tente_tenis"));
        }
        Clash c = new Clash(Msg.t("flairModes.combo_battle_2", t.label()), mine.title(), theirs.title(), sa, sb, FlairLooks.winner(sa, sb), notes, List.of());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("me", lookView(mine));
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.a_casa", theirs.owner()) : "@" + rival.getUsername(), "look", lookView(theirs)));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        r.put("comboBook", List.of(Msg.t("flairModes.streetwear_combo_tenis_cargo_jeans"), Msg.t("flairModes.classic_formal_blazer_camisa_sapato"),
                Msg.t("flairModes.monochrome_3_pecas_da_mesma"), Msg.t("flairModes.brand_loyalty_3_pecas_da"),
                Msg.t("flairModes.mix_match_3_marcas_diferentes"), Msg.t("flairModes.vintage_revival_2_pecas_vintage")));
        return finish(user, "COMBO", t.label(), c.winner(), r, List.of(mine), rival, List.of(theirs));
    }

    // ================================================================== 11. Tag Team

    @Transactional
    public Map<String, Object> tagTeam(CurrentUser user, UUID schemeId, String partner, List<String> opponents) {
        guard.requireCanCreate(user);
        Look mine = look(ownScheme(user, schemeId));
        Theme t = FlairLooks.drawTheme(seed("tag", schemeId, partner));
        User p = opponentUser(user, partner);
        Look pl = publicLooksOf(user, p).stream().max(Comparator.comparingDouble(l -> FlairLooks.harmony(mine, l) * 0.4 + FlairLooks.score(l, t).total() * 0.6))
                .orElseThrow(() -> new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico_2", p.getUsername())));
        List<Look> opp = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<String> names = opponents == null ? List.of() : opponents.stream().filter(x -> x != null && !x.isBlank()).limit(2).toList();
        if (names.size() == 2) {
            for (String n : names) {
                User u = opponentUser(user, n);
                if (u.getId().equals(p.getId())) {
                    throw ApiException.badRequest("DUPLA_INVALIDA", Msg.t("flairModes.a_parceria_nao_pode_estar"));
                }
                opp.add(publicLooksOf(user, u).stream().max(Comparator.comparingDouble(l -> FlairLooks.score(l, t).total()))
                        .orElseThrow(() -> new ApiException(409, "SEM_LOOK_PUBLICO", Msg.t("flairModes.ainda_nao_tem_look_publico_2", u.getUsername()))));
                labels.add("@" + u.getUsername());
            }
        } else {
            houseLooks(user.id(), 20, seed("tag-house")).stream().filter(l -> !l.owner().equals(p.getUsername())).limit(2).forEach(l -> {
                opp.add(l);
                labels.add("@" + l.owner());
            });
        }
        if (opp.size() < 2) {
            throw new ApiException(409, "SEM_ADVERSARIOS", Msg.t("flairModes.nao_ha_looks_publicos_suficientes"));
        }
        double sa = FlairLooks.tagScore(mine, pl, t), sb = FlairLooks.tagScore(opp.get(0), opp.get(1), t);
        int ha = FlairLooks.harmony(mine, pl), hb = FlairLooks.harmony(opp.get(0), opp.get(1));
        Clash c = new Clash("🤝 " + t.emoji() + " " + t.label(), "@" + user.username() + " + @" + p.getUsername(), String.join(" + ", labels), sa, sb, FlairLooks.winner(sa, sb),
                List.of(Msg.t("flairModes.a_team_harmony", ha), Msg.t("flairModes.b_team_harmony", hb), Msg.t("flairModes.nota_da_dupla_80_media")), List.of());
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("theme", t);
        r.put("teamA", Map.of("looks", List.of(lookView(mine), lookView(pl)), "harmony", ha));
        r.put("teamB", Map.of("labels", labels, "looks", opp.stream().map(FlairModesService::lookView).toList(), "harmony", hb));
        r.put("rounds", List.of(clashView(c)));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        return finish(user, "TAG_TEAM", t.label(), c.winner(), r, List.of(mine, pl), null, opp);
    }

    // ================================================================== 12. Fashion Boss

    @Transactional
    public Map<String, Object> fightBoss(CurrentUser user, String code, List<UUID> schemeIds) {
        guard.requireCanCreate(user);
        FlairLooks.Boss boss = FlairLooks.BOSSES.get(code == null ? "" : code.toUpperCase(Locale.ROOT));
        if (boss == null) {
            throw ApiException.notFound("Boss");
        }
        if (schemeIds == null || schemeIds.isEmpty() || schemeIds.size() > 3) {
            throw ApiException.badRequest("LOOKS_INVALIDOS", Msg.t("flairModes.enfrente_o_boss_com_1"));
        }
        Theme t = FlairLooks.theme(boss.theme());
        Look bl = FlairLooks.bossLook(boss);
        double bs = FlairLooks.bossScore(bl, t);
        List<Look> mine = schemeIds.stream().map(id -> look(ownScheme(user, id))).toList();
        List<Clash> rounds = new ArrayList<>();
        for (Look l : mine) {
            FlairLooks.Score sc = FlairLooks.score(l, t);
            List<Map<String, Object>> bd = new ArrayList<>();
            for (String k : FlairLooks.STATS) {
                bd.add(Map.of("stat", k, "label", FlairLooks.LABELS.get(k), "weight", t.weights().getOrDefault(k, 0.8), "a", l.stats().get(k), "b", bl.stats().get(k)));
            }
            rounds.add(new Clash(t.emoji() + " " + t.label(), l.title(), bl.title(), sc.total(), bs, FlairLooks.winner(sc.total(), bs), sc.notes(), bd));
        }
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("boss", boss);
        r.put("theme", t);
        r.put("bossScore", bs);
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("lesson", boss.lesson());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        if ("A".equals(w)) {
            trophy(user.id(), "BOSS", Msg.t("flairModes.boss_derrotado", boss.name()), seasonKey(), Map.of("boss", boss.code()));
        }
        return finish(user, "BOSS", boss.name(), w, r, mine, null, List.of());
    }

    // ================================================================== 13. Wardrobe Wars

    FlairLooks.Wardrobe wardrobe(User u, boolean publicOnly) {
        List<WardrobeItem> ws = pieces.findByUserIdOrderByCreatedAtDesc(u.getId()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED)
                .filter(w -> !publicOnly || w.getVisibility() == Visibility.PUBLIC).toList();
        List<Scheme> ss = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(u.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> !publicOnly || s.getVisibility() == Visibility.PUBLIC && s.getStatus() == SchemeStatus.PUBLISHED).toList();
        List<Card> cards = ws.stream().map(flair::card).toList();
        double quality = ss.stream().filter(s -> s.getHypeScore() != null).mapToDouble(s -> s.getHypeScore().doubleValue()).average().orElse(0);
        int styles = (int) cards.stream().flatMap(c -> c.styles().stream()).distinct().count();
        int occ = (int) cards.stream().flatMap(c -> c.occasions().stream()).distinct().count();
        Set<Set<String>> combos = new HashSet<>();
        Set<String> usedPieces = new HashSet<>();
        for (Scheme s : ss) {
            Set<String> set = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem).filter(Objects::nonNull)
                    .map(w -> w.getId().toString()).collect(Collectors.toSet());
            if (!set.isEmpty()) {
                combos.add(set);
                usedPieces.addAll(set);
            }
        }
        double originality = ws.isEmpty() ? 0 : Math.min(100, combos.size() * 100.0 / ws.size());
        double collection = cards.stream().mapToInt(c -> Map.of("STANDARD", 1, "PREMIUM", 2, "LIMITED", 3, "RARE", 5).getOrDefault(c.rarity(), 1)).sum() * 2.0;
        double sustainability = ws.isEmpty() ? 0 : Math.min(100, ws.stream().mapToInt(WardrobeItem::getWearCount).average().orElse(0) * 6 + usedPieces.size() * 60.0 / ws.size());
        double eng = ss.stream().mapToLong(s -> s.getLikeCount() + 2 * s.getSaveCount() + 3 * s.getCommentCount()).sum();
        double community = Math.min(100, 18 * Math.log(1 + eng) / Math.log(2));
        return new FlairLooks.Wardrobe(u.getUsername(), quality, styles, occ, originality, collection, sustainability, community);
    }

    @Transactional
    public Map<String, Object> wardrobeWars(CurrentUser user, String opponent) {
        guard.requireCanCreate(user);
        User me = users.findById(user.id()).orElseThrow();
        User rival = opponentUser(user, opponent);
        FlairLooks.Wardrobe a = wardrobe(me, false), b = wardrobe(rival, true);
        List<Clash> rounds = FlairLooks.wardrobeWars(a, b);
        String w = overall(rounds);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("me", a);
        r.put("opponent", Map.of("label", "@" + rival.getUsername(), "wardrobe", b));
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("scoreA", rounds.stream().filter(x -> "A".equals(x.winner())).count());
        r.put("scoreB", rounds.stream().filter(x -> "B".equals(x.winner())).count());
        r.put("note", Msg.t("flairModes.do_oponente_contam_so_pecas"));
        return finish(user, "WARDROBE", Msg.t("flairModes.guarda_roupa_guarda_roupa_2"), w, r, List.of(), rival, List.of());
    }

    // ================================================================== 14. FLAIR Chess

    @Transactional(readOnly = true)
    public Map<String, Object> chessSuggest(CurrentUser user) {
        List<Card> mine = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(flair::card).toList();
        Map<String, Card> board = FlairLooks.autoBoard(mine);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("slots", FlairLooks.BOARD);
        out.put("cards", mine);
        out.put("suggestion", board.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().id(), (a, b) -> a, LinkedHashMap::new)));
        out.put("preview", FlairLooks.chess(board));
        out.put("rules", List.of(Msg.t("flairModes.cada_carta_vale_poder_10"), Msg.t("flairModes.hero_centro_vale_1_25"),
                Msg.t("flairModes.peca_clara_em_cima_calca"), Msg.t("flairModes.tenis_ao_lado_de_cargo"),
                Msg.t("flairModes.mesma_familia_de_cor_3")));
        return out;
    }

    @Transactional
    public Map<String, Object> chess(CurrentUser user, Map<String, UUID> placement) {
        guard.requireCanCreate(user);
        if (placement == null || placement.isEmpty()) {
            throw ApiException.badRequest("TABULEIRO_VAZIO", Msg.t("flairModes.coloque_cartas_no_tabuleiro"));
        }
        Map<String, Card> board = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (Map.Entry<String, UUID> e : placement.entrySet()) {
            if (!FlairLooks.BOARD.contains(e.getKey()) || e.getValue() == null) {
                continue;
            }
            if (!used.add(e.getValue())) {
                throw ApiException.badRequest("CARTA_REPETIDA", Msg.t("flairModes.cada_carta_ocupa_uma_posicao"));
            }
            WardrobeItem w = pieces.findById(e.getValue()).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            guard.requireOwner(user, w.getUser().getId(), "piece:" + e.getValue());
            board.put(e.getKey(), flair.card(w));
        }
        Map<String, Card> ai = FlairLooks.autoBoard(houseCards(user.id(), 12, seed("chess", user.id())));
        Map<String, Object> ea = FlairLooks.chess(board), eb = FlairLooks.chess(ai);
        double sa = ((Number) ea.get("total")).doubleValue(), sb = ((Number) eb.get("total")).doubleValue();
        String w = FlairLooks.winner(sa, sb);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("me", ea);
        r.put("opponent", Map.of("label", Msg.t("flairModes.ia_estrategista"), "board", eb, "cards", ai.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().name(), (x, y) -> x, LinkedHashMap::new))));
        r.put("rounds", List.of(clashView(new Clash(Msg.t("flairModes.tabuleiro_3_3"), "seu tabuleiro", "IA", sa, sb, w, List.of(), List.of()))));
        r.put("scoreA", sa);
        r.put("scoreB", sb);
        return finish(user, "CHESS", Msg.t("flairModes.fashion_strategy"), w, r, List.of(), null, List.of());
    }

    // ================================================================== 15. FLAIR Ultimate Team

    Map<String, Look> autoUltimate(List<Look> looks) {
        Map<String, Look> out = new LinkedHashMap<>();
        List<Look> left = new ArrayList<>(looks);
        for (String role : FlairLooks.ROLES.keySet()) {
            Optional<Look> best = left.stream().max(Comparator.comparingInt(l -> FlairLooks.roleValue(l, role)));
            best.ifPresent(l -> {
                out.put(role, l);
                left.remove(l);
            });
            if (best.isEmpty()) {
                out.put(role, null);
            }
        }
        return out;
    }

    @Transactional
    public Map<String, Object> ultimate(CurrentUser user) {
        Map<String, Object> st = Json.map(state(user.id(), "ULTIMATE", "ALL").getStateJson());
        Map<String, Look> roster = new LinkedHashMap<>();
        Object roles = st.get("roles");
        for (String role : FlairLooks.ROLES.keySet()) {
            Object id = roles instanceof Map<?, ?> rm ? rm.get(role) : null;
            roster.put(role, id == null ? null : schemes.findById(UUID.fromString(String.valueOf(id))).filter(s -> s.getStatus() != SchemeStatus.ARCHIVED).map(this::look).orElse(null));
        }
        Map<String, Look> suggestion = autoUltimate(ownSchemes(user.id()).stream().map(this::look).toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("roles", FlairLooks.ROLES.keySet());
        out.put("roster", roster.entrySet().stream().collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue() == null ? null : Map.of("look", lookView(e.getValue()),
                "value", FlairLooks.roleValue(e.getValue(), e.getKey()))), LinkedHashMap::putAll));
        out.put("team", FlairLooks.teamRating(roster));
        out.put("suggestion", suggestion.entrySet().stream().collect(LinkedHashMap::new, (m, e) -> m.put(e.getKey(), e.getValue() == null ? null : e.getValue().schemeId()), LinkedHashMap::putAll));
        out.put("roleHelp", Map.of("ICON", Msg.t("flairModes.look_principal_rating_geral"), "TREND", Msg.t("flairModes.foco_em_tendencias"), "SOCIAL", Msg.t("flairModes.maior_community_score"), "CREATIVE", "alta originalidade",
                "CLASSIC", Msg.t("flairModes.alta_consistencia_style_ai"), "WILD_CARD", Msg.t("flairModes.imprevisivel_o_maior_atributo_decide"), "SPECIAL", Msg.t("flairModes.look_para_eventos_raridade")));
        return out;
    }

    @Transactional
    public Map<String, Object> saveUltimate(CurrentUser user, Map<String, UUID> roles) {
        Map<String, String> clean = new LinkedHashMap<>();
        Set<UUID> used = new HashSet<>();
        for (String role : FlairLooks.ROLES.keySet()) {
            UUID id = roles == null ? null : roles.get(role);
            if (id == null) {
                continue;
            }
            if (!used.add(id)) {
                throw ApiException.badRequest("LOOK_REPETIDO", Msg.t("flairModes.cada_look_ocupa_uma_funcao"));
            }
            ownScheme(user, id);
            clean.put(role, id.toString());
        }
        state(user.id(), "ULTIMATE", "ALL").setStateJson(Json.write(Map.of("roles", clean)));
        return ultimate(user);
    }

    @Transactional
    public Map<String, Object> playUltimate(CurrentUser user, String opponent) {
        guard.requireCanCreate(user);
        Map<String, Object> view = ultimate(user);
        Map<String, Look> mine = new LinkedHashMap<>();
        Map<String, Object> st = Json.map(state(user.id(), "ULTIMATE", "ALL").getStateJson());
        Object roles = st.get("roles");
        for (String role : FlairLooks.ROLES.keySet()) {
            Object id = roles instanceof Map<?, ?> rm ? rm.get(role) : null;
            mine.put(role, id == null ? null : schemes.findById(UUID.fromString(String.valueOf(id))).map(this::look).orElse(null));
        }
        if (mine.values().stream().allMatch(Objects::isNull)) {
            mine = autoUltimate(ownSchemes(user.id()).stream().map(this::look).toList());
        }
        User rival = house(opponent) ? null : opponentUser(user, opponent);
        Map<String, Look> theirs = autoUltimate(rival == null ? houseLooks(user.id(), 14, seed("ut-house")) : publicLooksOf(user, rival));
        List<Clash> rounds = new ArrayList<>();
        for (String role : FlairLooks.ROLES.keySet()) {
            Look a = mine.get(role), b = theirs.get(role);
            double va = a == null ? 0 : FlairLooks.roleValue(a, role), vb = b == null ? 0 : FlairLooks.roleValue(b, role);
            rounds.add(new Clash(role.replace('_', ' '), a == null ? "—" : a.title(), b == null ? "—" : b.title(), va, vb, FlairLooks.winner(va, vb), List.of(), List.of()));
        }
        Map<String, Object> ta = FlairLooks.teamRating(mine), tb = FlairLooks.teamRating(theirs);
        String w = overall(rounds);
        long wa = rounds.stream().filter(x -> "A".equals(x.winner())).count(), wb = rounds.stream().filter(x -> "B".equals(x.winner())).count();
        if (wa == wb) {
            w = FlairLooks.winner(num(ta.get("chemistry")), num(tb.get("chemistry")));
        }
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("teamA", ta);
        r.put("teamB", tb);
        r.put("opponent", Map.of("label", rival == null ? Msg.t("flairModes.ultimate_team_da_casa") : "@" + rival.getUsername()));
        r.put("rounds", rounds.stream().map(FlairModesService::clashView).toList());
        r.put("scoreA", wa);
        r.put("scoreB", wb);
        r.put("tiebreak", wa == wb ? Msg.t("flairModes.empate_nas_funcoes_decide_a") : null);
        r.put("roster", view.get("roster"));
        return finish(user, "ULTIMATE", Msg.t("flairModes.flair_team"), w, r, mine.values().stream().filter(Objects::nonNull).toList(), rival,
                theirs.values().stream().filter(Objects::nonNull).toList());
    }
}
