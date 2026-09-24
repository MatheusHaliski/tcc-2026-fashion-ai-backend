package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.flair.FlairEngine.Card;
import br.com.fashionai.application.flair.FlairEngine.Deck;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.FlairCoinEntry;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairMatch;
import br.com.fashionai.domain.model.FlairMatchEntry;
import br.com.fashionai.domain.model.FlairProfile;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.FlairTeam;
import br.com.fashionai.domain.model.FlairTeamMember;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.Model3dStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.FlairCoinEntryRepository;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairMatchEntryRepository;
import br.com.fashionai.domain.repository.FlairMatchRepository;
import br.com.fashionai.domain.repository.FlairProfileRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.FlairTeamMemberRepository;
import br.com.fashionai.domain.repository.FlairTeamRepository;
import br.com.fashionai.domain.repository.ReactionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * FLAIR (card Trello · jogo de cartas): as cartas são as peças e os decks são os esquemas do usuário. Jogos:
 * <ol>
 *   <li><b>Combinação da loja</b> — a loja participante define, no perfil (aba "Minhas combinações FLAIR"), o que o deck
 *   precisa ter (categorias, estilos, ocasiões, peças da marca, poder mínimo, raridade); quem completa ganha o cupom.
 *   Variações: COMBINACAO (um deck), COLECAO (o guarda-roupa inteiro) e DUELO_PATROCINADO (vitórias com peças da marca).</li>
 *   <li><b>Duelo de estilo 1×1</b> — 5 rodadas (EDGE, RANGE, CLOUT, GLOW, ART) contra o melhor deck público de outra
 *   pessoa ou contra "a Casa" (deck do dia montado com peças públicas).</li>
 *   <li><b>Batalha de ocasião do dia</b> — tema igual para todos (ocasião sorteada pela data), um deck por pessoa, placar do dia.</li>
 *   <li><b>Duelo de equipes 3×3 e Liga semanal</b> — equipes de até 5; os 3 melhores decks de cada lado se enfrentam.</li>
 *   <li><b>Quests</b> diárias e semanais, <b>álbum</b> de raridades por categoria e <b>rank</b> (Rookie → Legend).</li>
 * </ol>
 * Limites éticos: não há aposta de coins (o público começa aos 13 anos); a recompensa de duelo vem do sistema, com teto
 * diário; coins só compram itens cosméticos (skins de carta); nenhum aviso de "você vai perder".
 */
@Service
public class FlairService {
    static final String CASA = "CASA";
    static final int DUEL_REWARDS_PER_DAY = 5;
    static final List<String> ARENA_OCCASIONS = List.of("casual", "work", "party", "date", "travel", "festival", "formal", "beach", "sport", "night_out");
    static final Map<String, Integer> SKINS = Map.of("BRAND_FRAME", 300, "HOLOGRAFICO", 500, "CHAMPION", 800);
    static final Set<String> GAME_TYPES = Set.of("COMBINACAO", "COLECAO", "DUELO_PATROCINADO");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final FlairProfileRepository profiles;
    private final FlairCoinEntryRepository coins;
    private final FlairCombinationRepository combinations;
    private final FlairRedemptionRepository redemptions;
    private final FlairTeamRepository teams;
    private final FlairTeamMemberRepository members;
    private final FlairMatchRepository matches;
    private final FlairMatchEntryRepository entries;
    private final UserRepository users;
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final BrandProfileRepository brands;
    private final ReactionRepository reactions;
    private final SchemeService schemeService;
    private final InstitutionalService institutional;
    private final Guard guard;
    private final org.springframework.context.ApplicationEventPublisher events;

    public FlairService(FlairProfileRepository profiles, FlairCoinEntryRepository coins, FlairCombinationRepository combinations,
                        FlairRedemptionRepository redemptions, FlairTeamRepository teams, FlairTeamMemberRepository members,
                        FlairMatchRepository matches, FlairMatchEntryRepository entries, UserRepository users,
                        WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                        BrandProfileRepository brands, ReactionRepository reactions, SchemeService schemeService,
                        InstitutionalService institutional, Guard guard, org.springframework.context.ApplicationEventPublisher events) {
        this.events = events;
        this.profiles = profiles;
        this.coins = coins;
        this.combinations = combinations;
        this.redemptions = redemptions;
        this.teams = teams;
        this.members = members;
        this.matches = matches;
        this.entries = entries;
        this.users = users;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.brands = brands;
        this.reactions = reactions;
        this.schemeService = schemeService;
        this.institutional = institutional;
        this.guard = guard;
    }

    static LocalDate today() {
        return LocalDate.now(FaiPointsService.ZONE);
    }

    static String season() {
        return FlairEngine.season(today());
    }

    // ================================================================== cartas e decks

    FlairEngine.PieceInput input(WardrobeItem w) {
        BrandProfile bp = w.getBrandProfile();
        Object overall = Json.map(w.getPhotoQualityScoresJson()).get("overall");
        String brandName = w.getBrandName() != null && !w.getBrandName().isBlank() ? w.getBrandName() : bp != null ? bp.getBrandName() : null;
        return new FlairEngine.PieceInput(w.getId().toString(), w.getName(), w.getCategory(), w.getSubcategory(),
                w.getStudioImageUrl() != null ? Views.studioThumb(w.getStudioImageUrl()) : w.getThumbnailUrl() != null ? w.getThumbnailUrl() : w.getImageUrl(),
                Taxonomy.hex(w.getColor()), brandName, bp != null || w.getBrand() != null, bp == null ? null : bp.getOwner().getId().toString(),
                Json.csv(w.getStyleTags()), Json.csv(w.getOccasionTags()), w.getMaterial(), overall instanceof Number n ? n.doubleValue() : null,
                w.getStudioImageUrl() != null, w.getStudioDetailUrl() != null, w.getModel3dStatus() == Model3dStatus.COMPLETED,
                w.getMannequinImageUrl() != null, w.isDefaultImage(), w.getPrice() == null ? 0 : w.getPrice().doubleValue(),
                w.getHypeScore() == null ? 0 : w.getHypeScore().doubleValue(), Json.strings(w.getSealIdsJson()).size());
    }

    Card card(WardrobeItem w) {
        return FlairEngine.card(input(w), season());
    }

    Deck deck(Scheme s) {
        List<Card> cards = schemeItems.findBySchemeIdOrderBySortOrder(s.getId()).stream().map(SchemeItem::getWardrobeItem)
                .filter(Objects::nonNull).map(this::card).toList();
        return FlairEngine.deck(s.getId().toString(), s.getTitle(), cards, s.getSeason() == null ? null : s.getSeason().name(), season());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> cards(CurrentUser user) {
        List<Card> cs = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(this::card).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("season", season());
        out.put("cards", cs);
        out.put("album", album(cs));
        return out;
    }

    /** Álbum: para cada categoria, as 4 raridades — completa quem tem carta de cada. */
    static Map<String, Object> album(List<Card> cs) {
        List<String> cats = List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece", "full_body_piece");
        List<Map<String, Object>> rows = new ArrayList<>();
        int got = 0;
        for (String c : cats) {
            Map<String, Boolean> have = new LinkedHashMap<>();
            for (String r : FlairEngine.RARITIES) {
                boolean h = cs.stream().anyMatch(x -> c.equals(x.category()) && r.equals(x.rarity()));
                have.put(r, h);
                got += h ? 1 : 0;
            }
            rows.add(Map.of("category", c, "rarities", have));
        }
        return Map.of("slots", cats.size() * FlairEngine.RARITIES.size(), "collected", got, "rows", rows);
    }

    @Transactional(readOnly = true)
    public List<Deck> decks(CurrentUser user) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream()
                .map(this::deck).filter(d -> !d.cards().isEmpty()).sorted(Comparator.comparingInt(Deck::power).reversed()).toList();
    }

    @Transactional(readOnly = true)
    public Deck deckOf(CurrentUser viewer, UUID schemeId) {
        Scheme s = schemes.findById(schemeId).orElseThrow(() -> ApiException.notFound("Esquema"));
        if (!schemeService.canView(viewer, s)) {
            throw ApiException.notFound("Esquema");
        }
        return deck(s);
    }

    private Scheme ownDeckScheme(CurrentUser user, UUID schemeId) {
        Scheme s = schemeService.owned(user, schemeId);
        if (s.getStatus() == SchemeStatus.ARCHIVED) {
            throw ApiException.badRequest("DECK_ARQUIVADO", "Esse esquema está arquivado.");
        }
        return s;
    }

    // ================================================================== perfil, coins e rank

    FlairProfile profile(UUID userId) {
        return profiles.findByUserId(userId).orElseGet(() -> {
            FlairProfile p = new FlairProfile();
            p.setUser(users.findById(userId).orElseThrow());
            return profiles.save(p);
        });
    }

    /** Recompensa idempotente: (motivo, referência) paga uma vez só. */
    boolean award(UUID userId, int delta, int rankPoints, String reason, String ref) {
        if (coins.existsByUserIdAndReasonAndRef(userId, reason, ref)) {
            return false;
        }
        FlairCoinEntry e = new FlairCoinEntry();
        e.setUser(users.findById(userId).orElseThrow());
        e.setDelta(delta);
        e.setReason(reason);
        e.setRef(ref);
        coins.save(e);
        FlairProfile p = profile(userId);
        p.setCoins(p.getCoins() + delta);
        p.setRankPoints(p.getRankPoints() + rankPoints);
        return true;
    }

    @Transactional
    public Map<String, Object> me(CurrentUser user) {
        FlairProfile p = profile(user.id());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("coins", p.getCoins());
        out.put("rank", FlairEngine.rank(p.getRankPoints()));
        out.put("wins", p.getWins());
        out.put("losses", p.getLosses());
        out.put("draws", p.getDraws());
        out.put("skins", Json.strings(p.getSkinsJson()));
        out.put("activeSkin", p.getActiveSkin());
        out.put("skinShop", SKINS);
        out.put("season", season());
        out.put("team", members.findByUserId(user.id()).map(m -> teamView(m.getTeam(), user)).orElse(null));
        out.put("ledger", coins.findTop30ByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .map(e -> Map.of("delta", e.getDelta(), "reason", e.getReason(), "ref", e.getRef(), "at", e.getCreatedAt())).toList());
        out.put("recent", entries.findTop30ByUserIdOrderByCreatedAtDesc(user.id()).stream().limit(10).map(this::entryView).toList());
        out.put("ethics", "Sem apostas: coins vêm do sistema (duelos têm teto diário) e só compram itens cosméticos.");
        return out;
    }

    @Transactional
    public Map<String, Object> buySkin(CurrentUser user, String skin, boolean activate) {
        String code = skin == null ? "" : skin.toUpperCase(Locale.ROOT);
        Integer price = SKINS.get(code);
        if (price == null) {
            throw ApiException.notFound("Skin");
        }
        FlairProfile p = profile(user.id());
        List<String> owned = new ArrayList<>(Json.strings(p.getSkinsJson()));
        if (!owned.contains(code)) {
            if (p.getCoins() < price) {
                throw new ApiException(409, "COINS_INSUFICIENTES", "Faltam " + (price - p.getCoins()) + " coins para esta skin.");
            }
            award(user.id(), -price, 0, "SKIN", code);
            owned.add(code);
            p.setSkinsJson(Json.write(owned));
        }
        if (activate) {
            p.setActiveSkin(code);
        }
        return me(user);
    }

    // ================================================================== quests

    record Quest(String code, String label, String period, int coins, String rule) {
    }

    static final List<Quest> QUESTS = List.of(
            new Quest("SEASONAL_LOOK", "Look da estação", "DAY", 50, "Um deck com 3+ cartas em SYNC com a estação atual."),
            new Quest("BRAND_COLLECTOR", "Colecionador de marca", "DAY", 30, "Um deck com 3+ peças da mesma marca."),
            new Quest("VERSATILE_MASTER", "Mestre da versatilidade", "DAY", 40, "Um deck com RANGE médio acima de 70."),
            new Quest("GLOW_UP", "Glow up", "DAY", 45, "Um deck com GLOW médio acima de 65."),
            new Quest("STYLE_CURATOR", "Curadoria de estilo", "WEEK", 200, "Curtir 10 looks da comunidade nesta semana."),
            new Quest("WARDROBE_MAVEN", "Guarda-roupa em dia", "WEEK", 150, "Cadastrar 3 peças novas nesta semana."),
            new Quest("DUEL_CHAMPION", "Campeão de duelos", "WEEK", 200, "Vencer 5 duelos nesta semana."),
            new Quest("POWER_DECK", "Deck poderoso", "WEEK", 300, "Montar um deck com poder acima de 350."));

    static final Map<String, String> CATEGORY_LABELS = Map.of("upper_piece", "parte de cima", "lower_piece", "parte de baixo",
            "shoes_piece", "calçado", "accessory_piece", "acessório", "full_body_piece", "peça inteira");

    @Transactional(readOnly = true)
    public List<Map<String, Object>> quests(CurrentUser user) {
        List<Deck> ds = decks(user);
        LocalDate day = today(), weekStart = day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant since = weekStart.atStartOfDay(FaiPointsService.ZONE).toInstant();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Quest q : QUESTS) {
            double progress, target;
            switch (q.code()) {
                case "SEASONAL_LOOK" -> { progress = ds.stream().mapToLong(d -> d.cards().stream().filter(c -> c.stats().get("SYNC") == 100).count()).max().orElse(0); target = 3; }
                case "BRAND_COLLECTOR" -> { progress = ds.stream().mapToDouble(d -> d.brandMultiplier() >= 1.2 ? 3 : d.brandMultiplier() >= 1.1 ? 2 : d.topBrand() == null ? 0 : 1).max().orElse(0); target = 3; }
                case "VERSATILE_MASTER" -> { progress = ds.stream().mapToInt(d -> d.avg().get("RANGE")).max().orElse(0); target = 71; }
                case "GLOW_UP" -> { progress = ds.stream().mapToInt(d -> d.avg().get("GLOW")).max().orElse(0); target = 66; }
                case "STYLE_CURATOR" -> { progress = reactions.countByActorIdAndCreatedAtAfter(user.id(), since); target = 10; }
                case "WARDROBE_MAVEN" -> { progress = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getCreatedAt() != null && w.getCreatedAt().isAfter(since)).count(); target = 3; }
                case "DUEL_CHAMPION" -> { progress = entries.findByUserIdAndCreatedAtAfter(user.id(), since).stream().filter(e -> "DUEL".equals(e.getMatch().getMode()) && Objects.equals(e.getSide(), e.getMatch().getWinnerSide())).count(); target = 5; }
                default -> { progress = ds.stream().mapToInt(Deck::power).max().orElse(0); target = 351; }
            }
            String ref = "DAY".equals(q.period()) ? day.toString() : weekStart.toString();
            boolean claimed = coins.existsByUserIdAndReasonAndRef(user.id(), "QUEST_" + q.code(), ref);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", q.code());
            m.put("label", q.label());
            m.put("period", q.period());
            m.put("rule", q.rule());
            m.put("coins", q.coins());
            m.put("progress", Math.min(progress, target));
            m.put("target", target);
            m.put("done", progress >= target);
            m.put("claimed", claimed);
            out.add(m);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> claimQuest(CurrentUser user, String code) {
        Map<String, Object> q = quests(user).stream().filter(x -> x.get("code").equals(code)).findFirst().orElseThrow(() -> ApiException.notFound("Quest"));
        if (!Boolean.TRUE.equals(q.get("done"))) {
            throw new ApiException(409, "QUEST_INCOMPLETA", "Esta quest ainda não foi cumprida.");
        }
        LocalDate day = today();
        String ref = "DAY".equals(q.get("period")) ? day.toString() : day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).toString();
        if (!award(user.id(), (Integer) q.get("coins"), 10, "QUEST_" + code, ref)) {
            throw ApiException.conflict("QUEST_JA_RESGATADA", "Recompensa já resgatada neste período.");
        }
        return me(user);
    }

    // ================================================================== duelo 1×1 e treino contra a Casa

    /** Deck da Casa do dia: uma peça pública de cada categoria, sorteada pela data (igual para todos no dia). */
    Deck houseDeck() {
        List<WardrobeItem> pub = pieces.findAllPublic(PageRequest.of(0, 400));
        Random r = new Random(today().toEpochDay());
        List<Card> cs = new ArrayList<>();
        for (String cat : List.of("upper_piece", "lower_piece", "shoes_piece", "accessory_piece")) {
            List<WardrobeItem> c = pub.stream().filter(w -> cat.equals(w.getCategory())).toList();
            if (!c.isEmpty()) {
                cs.add(card(c.get(r.nextInt(c.size()))));
            }
        }
        return FlairEngine.deck(null, "Deck da Casa · " + today(), cs, season(), season());
    }

    /** Melhor deck público de outra pessoa (o que ela mostraria numa vitrine). */
    Optional<Map.Entry<Scheme, Deck>> bestPublicDeck(CurrentUser viewer, User owner) {
        return schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(owner.getId(), SchemeStatus.ARCHIVED).stream()
                .filter(s -> s.getStatus() == SchemeStatus.PUBLISHED && schemeService.canView(viewer, s))
                .map(s -> Map.entry(s, deck(s))).filter(e -> !e.getValue().cards().isEmpty())
                .max(Comparator.comparingInt(e -> e.getValue().power()));
    }

    @Transactional
    public Map<String, Object> duel(CurrentUser user, UUID schemeId, String opponent) {
        guard.requireCanCreate(user);
        Scheme mine = ownDeckScheme(user, schemeId);
        Deck a = deck(mine);
        if (a.cards().isEmpty()) {
            throw ApiException.badRequest("DECK_VAZIO", "Esse esquema não tem peças.");
        }
        boolean house = opponent == null || opponent.isBlank() || CASA.equalsIgnoreCase(opponent);
        User rival = null;
        Scheme rivalScheme = null;
        Deck b;
        if (house) {
            b = houseDeck();
        } else {
            rival = users.findByUsernameIgnoreCase(opponent.replaceFirst("^@", "")).orElseThrow(() -> ApiException.notFound("Oponente"));
            if (rival.getId().equals(user.id())) {
                throw ApiException.badRequest("DUELO_CONSIGO", "Escolha outra pessoa ou a Casa.");
            }
            var best = bestPublicDeck(user, rival).orElseThrow(() -> new ApiException(409, "SEM_DECK_PUBLICO", "@" + opponent + " ainda não tem um look público para duelar."));
            rivalScheme = best.getKey();
            b = best.getValue();
        }
        FlairEngine.DuelResult r = FlairEngine.duel(a, b);
        FlairMatch m = new FlairMatch();
        m.setMode(house ? "TREINO" : "DUEL");
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setWinnerSide(r.winner());
        m.setTheme(house ? CASA : "@" + rival.getUsername());
        m.setResultJson(Json.write(Map.of("rounds", r.rounds(), "winsA", r.winsA(), "winsB", r.winsB())));
        matches.save(m);
        entry(m, users.findById(user.id()).orElseThrow(), mine, "A", a, null);
        entry(m, rival, rivalScheme, "B", b, null);
        FlairProfile p = profile(user.id());
        String outcome = "DRAW".equals(r.winner()) ? "DRAW" : "A".equals(r.winner()) ? "WIN" : "LOSS";
        switch (outcome) {
            case "WIN" -> p.setWins(p.getWins() + 1);
            case "LOSS" -> p.setLosses(p.getLosses() + 1);
            default -> p.setDraws(p.getDraws() + 1);
        }
        // recompensa do sistema (nada sai do oponente), com teto diário de duelos premiados
        Instant dayStart = today().atStartOfDay(FaiPointsService.ZONE).toInstant();
        boolean rewarded = coins.countByUserIdAndReasonAndCreatedAtAfter(user.id(), "DUEL", dayStart) < DUEL_REWARDS_PER_DAY;
        int coinsWon = !rewarded ? 0 : "WIN".equals(outcome) ? (house ? 20 : 40) : "DRAW".equals(outcome) ? 15 : 5;
        if (coinsWon > 0) {
            award(user.id(), coinsWon, "WIN".equals(outcome) ? 25 : "DRAW".equals(outcome) ? 8 : 2, "DUEL", m.getId().toString());
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchId", m.getId());
        out.put("mode", m.getMode());
        out.put("me", a);
        out.put("opponent", Map.of("label", house ? "A Casa" : "@" + rival.getUsername(), "deck", b));
        out.put("rounds", r.rounds());
        out.put("score", Map.of("me", r.winsA(), "opponent", r.winsB()));
        out.put("outcome", outcome);
        out.put("coins", coinsWon);
        out.put("rewardCapReached", !rewarded);
        out.put("profile", me(user));
        rightsCheck(user.id());
        return out;
    }

    private void entry(FlairMatch m, User u, Scheme s, String side, Deck d, Double score) {
        FlairMatchEntry e = new FlairMatchEntry();
        e.setMatch(m);
        e.setUser(u);
        e.setScheme(s);
        e.setSide(side);
        e.setDeckPower(d.power());
        e.setScore(score == null ? null : BigDecimal.valueOf(score));
        e.setBrandPiecesJson(Json.write(d.cards().stream().map(Card::brandName).filter(Objects::nonNull).map(x -> x.toLowerCase(Locale.ROOT)).toList()));
        entries.save(e);
    }

    private Map<String, Object> entryView(FlairMatchEntry e) {
        FlairMatch m = e.getMatch();
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("matchId", m.getId());
        v.put("mode", m.getMode());
        v.put("theme", m.getTheme());
        v.put("date", m.getPlayDate());
        v.put("deck", e.getScheme() == null ? null : e.getScheme().getTitle());
        v.put("power", e.getDeckPower());
        v.put("score", e.getScore());
        v.put("outcome", m.getWinnerSide() == null ? null : m.getWinnerSide().equals("DRAW") ? "DRAW" : m.getWinnerSide().equals(e.getSide()) ? "WIN" : "LOSS");
        return v;
    }

    // ================================================================== batalha de ocasião do dia

    static String arenaTheme(LocalDate d) {
        return ARENA_OCCASIONS.get((int) Math.floorMod(d.toEpochDay(), ARENA_OCCASIONS.size()));
    }

    FlairMatch arenaMatch(LocalDate d, UUID creator) {
        return entries.findByMatchModeAndMatchPlayDateOrderByScoreDesc("ARENA", d).stream().map(FlairMatchEntry::getMatch).findFirst().orElseGet(() -> {
            FlairMatch m = new FlairMatch();
            m.setMode("ARENA");
            m.setStatus("OPEN");
            m.setPlayDate(d);
            m.setTheme(arenaTheme(d));
            m.setCreatedByUser(users.findById(creator).orElseThrow());
            return matches.save(m);
        });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> arena(CurrentUser viewer) {
        LocalDate d = today();
        List<FlairMatchEntry> es = entries.findByMatchModeAndMatchPlayDateOrderByScoreDesc("ARENA", d);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("date", d);
        out.put("theme", arenaTheme(d));
        out.put("rule", "Tema do dia igual para todos. Nota = 40% cobertura da ocasião + 20% RANGE + 20% EDGE + 20% GLOW + 30% dos combos. Um deck por pessoa por dia.");
        List<Map<String, Object>> board = new ArrayList<>();
        for (int i = 0; i < es.size(); i++) {
            FlairMatchEntry e = es.get(i);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("position", i + 1);
            m.put("user", Views.user(e.getUser()));
            m.put("deck", e.getScheme() == null ? null : e.getScheme().getTitle());
            m.put("score", e.getScore());
            m.put("power", e.getDeckPower());
            m.put("you", viewer != null && e.getUser() != null && e.getUser().getId().equals(viewer.id()));
            board.add(m);
        }
        out.put("leaderboard", board);
        return out;
    }

    @Transactional
    public Map<String, Object> joinArena(CurrentUser user, UUID schemeId) {
        guard.requireCanCreate(user);
        LocalDate d = today();
        if (entries.findFirstByUserIdAndMatchModeAndMatchPlayDate(user.id(), "ARENA", d).isPresent()) {
            throw ApiException.conflict("JA_NA_ARENA", "Você já inscreveu um deck na batalha de hoje. Volte amanhã para o novo tema.");
        }
        Scheme s = ownDeckScheme(user, schemeId);
        Deck deck = deck(s);
        double score = FlairEngine.occasionScore(deck, arenaTheme(d));
        FlairMatch m = arenaMatch(d, user.id());
        entry(m, users.findById(user.id()).orElseThrow(), s, "SOLO", deck, score);
        award(user.id(), 10 + (int) Math.round(score / 5), 5, "ARENA", d.toString());
        rightsCheck(user.id());
        return arena(user);
    }

    // ================================================================== equipes 3×3 e liga

    private Map<String, Object> teamView(FlairTeam t, CurrentUser viewer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("name", t.getName());
        m.put("code", t.getCode());
        m.put("color", t.getColor());
        m.put("points", t.getPoints());
        m.put("owner", Views.user(t.getOwner()));
        m.put("members", members.findByTeamIdOrderByCreatedAtAsc(t.getId()).stream().map(x -> Map.of("user", Views.user(x.getUser()), "role", x.getRole())).toList());
        m.put("mine", viewer != null && members.findByUserId(viewer.id()).map(x -> x.getTeam().getId().equals(t.getId())).orElse(false));
        return m;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> league(CurrentUser viewer) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("teams", teams.findTop20ByOrderByPointsDesc().stream().map(t -> teamView(t, viewer)).toList());
        out.put("mine", viewer == null ? null : members.findByUserId(viewer.id()).map(m -> teamView(m.getTeam(), viewer)).orElse(null));
        out.put("players", profiles.findTop20ByOrderByRankPointsDesc().stream().map(p -> Map.of("user", Views.user(p.getUser()), "rank", FlairEngine.rank(p.getRankPoints()), "wins", p.getWins())).toList());
        out.put("rule", "Equipes de até 5. No duelo de equipes, os 3 melhores decks de cada lado se enfrentam em pares (1º×1º, 2º×2º, 3º×3º). Vitória vale 3 pontos na liga; empate, 1.");
        if (viewer != null) {
            out.put("battles", members.findByUserId(viewer.id()).map(m -> matches.findTop20ByTeamAIdOrTeamBIdOrderByCreatedAtDesc(m.getTeam().getId(), m.getTeam().getId()).stream()
                    .map(x -> Map.of("id", x.getId(), "theme", String.valueOf(x.getTheme()), "winner", String.valueOf(x.getWinnerSide()), "date", String.valueOf(x.getPlayDate()),
                            "side", x.getTeamAId().equals(m.getTeam().getId()) ? "A" : "B")).toList()).orElse(List.of()));
        }
        return out;
    }

    @Transactional
    public Map<String, Object> createTeam(CurrentUser user, String name, String color) {
        guard.requireCanCreate(user);
        if (members.findByUserId(user.id()).isPresent()) {
            throw ApiException.conflict("JA_EM_EQUIPE", "Saia da equipe atual antes de criar outra.");
        }
        FlairTeam t = new FlairTeam();
        t.setName(InputSanitizer.required("name", InputSanitizer.moderated("name", name, 40), 3, 40));
        t.setColor(color != null && color.matches("#[0-9A-Fa-f]{6}") ? color.toUpperCase(Locale.ROOT) : "#2D55C9");
        String code;
        do {
            code = "T" + Long.toString(Math.abs(RANDOM.nextLong()), 36).toUpperCase(Locale.ROOT).substring(0, 6);
        } while (teams.findByCode(code).isPresent());
        t.setCode(code);
        t.setOwner(users.findById(user.id()).orElseThrow());
        teams.save(t);
        addMember(t, user.id(), "CAPITAO");
        return league(user);
    }

    private void addMember(FlairTeam t, UUID userId, String role) {
        FlairTeamMember m = new FlairTeamMember();
        m.setTeam(t);
        m.setUser(users.findById(userId).orElseThrow());
        m.setRole(role);
        members.save(m);
    }

    @Transactional
    public Map<String, Object> joinTeam(CurrentUser user, String code) {
        guard.requireCanCreate(user);
        FlairTeam t = teams.findByCode(code == null ? "" : code.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound("Equipe"));
        if (members.findByUserId(user.id()).isPresent()) {
            throw ApiException.conflict("JA_EM_EQUIPE", "Você já está numa equipe.");
        }
        if (members.countByTeamId(t.getId()) >= 5) {
            throw ApiException.conflict("EQUIPE_CHEIA", "A equipe já tem 5 integrantes.");
        }
        addMember(t, user.id(), "MEMBRO");
        return league(user);
    }

    @Transactional
    public Map<String, Object> leaveTeam(CurrentUser user) {
        members.findByUserId(user.id()).ifPresent(m -> {
            FlairTeam t = m.getTeam();
            members.delete(m);
            members.flush();
            if (members.countByTeamId(t.getId()) == 0) {
                teams.delete(t);
            }
        });
        return league(user);
    }

    /** Os 3 melhores decks de uma equipe (o melhor deck de cada integrante, os 3 mais fortes). */
    List<Map.Entry<Scheme, Deck>> teamDecks(FlairTeam t, CurrentUser viewer) {
        return members.findByTeamIdOrderByCreatedAtAsc(t.getId()).stream()
                .map(m -> bestPublicDeck(viewer, m.getUser()).orElse(null)).filter(Objects::nonNull)
                .sorted(Comparator.comparingInt((Map.Entry<Scheme, Deck> e) -> e.getValue().power()).reversed()).limit(3).toList();
    }

    @Transactional
    public Map<String, Object> teamBattle(CurrentUser user, String opponentCode) {
        guard.requireCanCreate(user);
        FlairTeam mine = members.findByUserId(user.id()).map(FlairTeamMember::getTeam).orElseThrow(() -> new ApiException(409, "SEM_EQUIPE", "Entre numa equipe para desafiar outra."));
        FlairTeam rival = teams.findByCode(opponentCode == null ? "" : opponentCode.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound("Equipe adversária"));
        if (rival.getId().equals(mine.getId())) {
            throw ApiException.badRequest("MESMA_EQUIPE", "Escolha outra equipe.");
        }
        boolean playedToday = matches.findTop20ByTeamAIdOrTeamBIdOrderByCreatedAtDesc(mine.getId(), mine.getId()).stream()
                .anyMatch(x -> today().equals(x.getPlayDate()) && (rival.getId().equals(x.getTeamAId()) || rival.getId().equals(x.getTeamBId())));
        if (playedToday) {
            throw ApiException.conflict("JA_DUELARAM_HOJE", "Suas equipes já se enfrentaram hoje. Revanche amanhã.");
        }
        List<Map.Entry<Scheme, Deck>> a = teamDecks(mine, user), b = teamDecks(rival, user);
        if (a.isEmpty() || b.isEmpty()) {
            throw new ApiException(409, "SEM_DECKS", "Cada equipe precisa de ao menos um integrante com look público.");
        }
        List<Map<String, Object>> duels = new ArrayList<>();
        int wa = 0, wb = 0;
        for (int i = 0; i < Math.max(a.size(), b.size()); i++) {
            Map.Entry<Scheme, Deck> x = i < a.size() ? a.get(i) : null, y = i < b.size() ? b.get(i) : null;
            String w;
            List<FlairEngine.Round> rounds = List.of();
            if (x == null) {
                w = "B";
            } else if (y == null) {
                w = "A";
            } else {
                FlairEngine.DuelResult r = FlairEngine.duel(x.getValue(), y.getValue());
                w = r.winner();
                rounds = r.rounds();
            }
            wa += "A".equals(w) ? 1 : 0;
            wb += "B".equals(w) ? 1 : 0;
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("slot", i + 1);
            d.put("a", x == null ? null : Map.of("user", Views.user(x.getKey().getUser()), "deck", x.getKey().getTitle(), "power", x.getValue().power()));
            d.put("b", y == null ? null : Map.of("user", Views.user(y.getKey().getUser()), "deck", y.getKey().getTitle(), "power", y.getValue().power()));
            d.put("winner", w);
            d.put("rounds", rounds);
            duels.add(d);
        }
        String winner = wa == wb ? "DRAW" : wa > wb ? "A" : "B";
        FlairMatch m = new FlairMatch();
        m.setMode("TEAM");
        m.setStatus("FINISHED");
        m.setPlayDate(today());
        m.setTheme(mine.getName() + " × " + rival.getName());
        m.setCreatedByUser(users.findById(user.id()).orElseThrow());
        m.setTeamAId(mine.getId());
        m.setTeamBId(rival.getId());
        m.setWinnerSide(winner);
        m.setResultJson(Json.write(Map.of("duels", duels, "winsA", wa, "winsB", wb)));
        matches.save(m);
        a.forEach(e -> entry(m, e.getKey().getUser(), e.getKey(), "A", e.getValue(), null));
        b.forEach(e -> entry(m, e.getKey().getUser(), e.getKey(), "B", e.getValue(), null));
        if ("DRAW".equals(winner)) {
            mine.setPoints(mine.getPoints() + 1);
            rival.setPoints(rival.getPoints() + 1);
        } else {
            FlairTeam w = "A".equals(winner) ? mine : rival;
            w.setPoints(w.getPoints() + 3);
            members.findByTeamIdOrderByCreatedAtAsc(w.getId()).forEach(x -> award(x.getUser().getId(), 30, 20, "TEAM_WIN", m.getId().toString()));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("matchId", m.getId());
        out.put("teamA", teamView(mine, user));
        out.put("teamB", teamView(rival, user));
        out.put("duels", duels);
        out.put("score", Map.of("a", wa, "b", wb));
        out.put("winner", winner);
        members.findByTeamIdOrderByCreatedAtAsc(mine.getId()).forEach(x -> rightsCheck(x.getUser().getId()));
        return out;
    }

    /** Card RF38 — uma vitória pode completar uma combinação: reavalia os direitos a cupom depois do commit. */
    public void rightsCheck(UUID userId) {
        events.publishEvent(new br.com.fashionai.application.events.DomainEvents.CouponRightsCheck(userId));
    }

    // ================================================================== combinações das lojas (cupons)

    private User brandOwner(CurrentUser user) {
        User u = users.findById(user.id()).orElseThrow();
        if (u.getProfileType() != ProfileType.MARCA && u.getProfileType() != ProfileType.CELEBRIDADE) {
            throw guard.deny(user, "flair:combinations", "Só perfis de marca ou celebridade (participantes) criam combinações FLAIR.");
        }
        return u;
    }

    public record CombinationForm(String name, String description, String gameType, List<String> requiredCategories,
                                  List<String> requiredStyles, List<String> requiredOccasions, Integer minBrandPieces,
                                  Integer minDeckPower, String minRarity, Integer minWins, String couponTitle,
                                  Integer discountPercent, BigDecimal discountAmount, BigDecimal minPurchase, Integer validDays,
                                  Integer stock, Boolean active, Instant startsAt, Instant endsAt, String accentColor, String storeUrl) {
    }

    @Transactional
    public Map<String, Object> saveCombination(CurrentUser user, UUID id, CombinationForm f) {
        User brand = brandOwner(user);
        FlairCombination c = id == null ? new FlairCombination() : combinations.findById(id).orElseThrow(() -> ApiException.notFound("Combinação"));
        if (id != null && !c.getBrand().getId().equals(brand.getId())) {
            throw guard.deny(user, "flair:combination:" + id, "Combinação de outra loja.");
        }
        c.setBrand(brand);
        c.setName(InputSanitizer.required("name", InputSanitizer.moderated("name", f.name(), 120), 3, 120));
        c.setDescription(f.description() == null ? null : InputSanitizer.clean(f.description(), 600));
        String type = f.gameType() == null ? "COMBINACAO" : f.gameType().toUpperCase(Locale.ROOT);
        if (!GAME_TYPES.contains(type)) {
            throw ApiException.badRequest("TIPO_INVALIDO", "Tipos: " + GAME_TYPES);
        }
        c.setGameType(type);
        c.setRequiredCategoriesJson(Json.write(clean(f.requiredCategories(), Taxonomy.SUBCATEGORIES.keySet())));
        c.setRequiredStylesJson(Json.write(clean(f.requiredStyles(), null)));
        c.setRequiredOccasionsJson(Json.write(clean(f.requiredOccasions(), null)));
        c.setMinBrandPieces(clamp(f.minBrandPieces(), 0, 10));
        c.setMinDeckPower(clamp(f.minDeckPower(), 0, 1000));
        c.setMinRarity(f.minRarity() == null || f.minRarity().isBlank() ? null : FlairEngine.RARITIES.contains(f.minRarity().toUpperCase(Locale.ROOT)) ? f.minRarity().toUpperCase(Locale.ROOT) : null);
        c.setMinWins("DUELO_PATROCINADO".equals(type) ? Math.max(1, clamp(f.minWins(), 1, 20)) : 0);
        if (Json.strings(c.getRequiredCategoriesJson()).isEmpty() && Json.strings(c.getRequiredStylesJson()).isEmpty()
                && Json.strings(c.getRequiredOccasionsJson()).isEmpty() && c.getMinBrandPieces() == 0 && c.getMinDeckPower() == 0
                && c.getMinRarity() == null && !"DUELO_PATROCINADO".equals(type)) {
            throw ApiException.badRequest("SEM_REQUISITOS", "Defina ao menos um requisito (categoria, estilo, ocasião, peças da marca, poder ou raridade).");
        }
        c.setCouponTitle(InputSanitizer.required("couponTitle", InputSanitizer.moderated("couponTitle", f.couponTitle(), 120), 3, 120));
        if (f.discountPercent() == null && f.discountAmount() == null) {
            throw ApiException.badRequest("DESCONTO_OBRIGATORIO", "Informe o desconto em % ou em R$.");
        }
        c.setDiscountPercent(f.discountPercent() == null ? null : clamp(f.discountPercent(), 1, 90));
        c.setDiscountAmount(f.discountAmount());
        c.setMinPurchase(f.minPurchase());
        c.setValidDays(clamp(f.validDays() == null ? 30 : f.validDays(), 7, 120));
        c.setStock(f.stock() == null ? null : Math.max(1, f.stock()));
        c.setActive(f.active() == null || f.active());
        c.setStartsAt(f.startsAt());
        c.setEndsAt(f.endsAt());
        c.setAccentColor(f.accentColor() != null && f.accentColor().matches("#[0-9A-Fa-f]{6}") ? f.accentColor().toUpperCase(Locale.ROOT) : null);
        c.setStoreUrl(SealService.storeUrl(f.storeUrl()));
        combinations.save(c);
        return combinationView(c, null, null);
    }

    @Transactional
    public void deleteCombination(CurrentUser user, UUID id) {
        User brand = brandOwner(user);
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound("Combinação"));
        if (!c.getBrand().getId().equals(brand.getId())) {
            throw guard.deny(user, "flair:combination:" + id, "Combinação de outra loja.");
        }
        if (c.getRedeemed() > 0) {
            c.setActive(false);                       // com cupons emitidos, só desativa (os cupons continuam válidos)
        } else {
            combinations.delete(c);
        }
    }

    private static List<String> clean(List<String> v, Set<String> allowed) {
        return v == null ? List.of() : v.stream().filter(x -> x != null && !x.isBlank()).map(x -> x.trim().toLowerCase(Locale.ROOT))
                .filter(x -> allowed == null || allowed.contains(x)).distinct().limit(6).toList();
    }

    private static int clamp(Integer v, int min, int max) {
        return v == null ? min : Math.max(min, Math.min(max, v));
    }

    boolean available(FlairCombination c) {
        Instant now = Instant.now();
        return c.isActive() && (c.getStartsAt() == null || !now.isBefore(c.getStartsAt())) && (c.getEndsAt() == null || now.isBefore(c.getEndsAt()))
                && (c.getStock() == null || c.getRedeemed() < c.getStock());
    }

    private String brandNameOf(User owner) {
        return brands.findByOwnerId(owner.getId()).map(BrandProfile::getBrandName).orElse(owner.getDisplayName());
    }

    private boolean isBrandCard(Card c, User owner, String brandName) {
        return owner.getId().toString().equals(c.brandOwner()) || c.brandName() != null && c.brandName().equalsIgnoreCase(brandName);
    }

    /** Requisitos da combinação contra um deck (ou contra o guarda-roupa, no tipo COLECAO). */
    List<Map<String, Object>> check(FlairCombination c, Deck deck, List<Card> wardrobe, CurrentUser user) {
        List<Card> cs = "COLECAO".equals(c.getGameType()) ? wardrobe : deck == null ? List.of() : deck.cards();
        String bn = brandNameOf(c.getBrand());
        List<Map<String, Object>> out = new ArrayList<>();
        for (String cat : Json.strings(c.getRequiredCategoriesJson())) {
            out.add(req("CATEGORY", cat, "Categoria: " + CATEGORY_LABELS.getOrDefault(cat, cat), cs.stream().anyMatch(x -> cat.equals(x.category()))));
        }
        for (String st : Json.strings(c.getRequiredStylesJson())) {
            out.add(req("STYLE", st, "Estilo: " + st, cs.stream().anyMatch(x -> x.styles().contains(st))));
        }
        for (String oc : Json.strings(c.getRequiredOccasionsJson())) {
            out.add(req("OCCASION", oc, "Ocasião: " + oc, cs.stream().anyMatch(x -> x.occasions().contains(oc))));
        }
        if (c.getMinBrandPieces() > 0) {
            long n = cs.stream().filter(x -> isBrandCard(x, c.getBrand(), bn)).count();
            out.add(req("BRAND", String.valueOf(n), c.getMinBrandPieces() + " peça(s) " + bn + " (" + n + ")", n >= c.getMinBrandPieces()));
        }
        if (c.getMinDeckPower() > 0 && !"COLECAO".equals(c.getGameType())) {
            int p = deck == null ? 0 : deck.power();
            out.add(req("POWER", String.valueOf(p), "Poder do deck ≥ " + c.getMinDeckPower() + " (" + p + ")", p >= c.getMinDeckPower()));
        }
        if (c.getMinRarity() != null) {
            int need = FlairEngine.RARITIES.indexOf(c.getMinRarity());
            out.add(req("RARITY", c.getMinRarity(), "Uma carta " + c.getMinRarity() + " ou melhor", cs.stream().anyMatch(x -> FlairEngine.RARITIES.indexOf(x.rarity()) >= need)));
        }
        if ("DUELO_PATROCINADO".equals(c.getGameType()) && user != null) {
            Instant since = today().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).atStartOfDay(FaiPointsService.ZONE).toInstant();
            long wins = entries.findByUserIdAndCreatedAtAfter(user.id(), since).stream()
                    .filter(e -> Objects.equals(e.getSide(), e.getMatch().getWinnerSide()) && FlairModesService.COMPETITIVE.contains(e.getMatch().getMode()))
                    .filter(e -> Json.strings(e.getBrandPiecesJson()).contains(bn.toLowerCase(Locale.ROOT))).count();
            out.add(req("WINS", String.valueOf(wins), c.getMinWins() + " vitória(s) nesta semana com peça " + bn + " no deck (" + wins + ")", wins >= c.getMinWins()));
        }
        return out;
    }

    private static Map<String, Object> req(String kind, String value, String label, boolean ok) {
        return Map.of("kind", kind, "value", value, "label", label, "ok", ok);
    }

    Map<String, Object> combinationView(FlairCombination c, CurrentUser viewer, Deck deck) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("brand", Views.user(c.getBrand()));
        m.put("brandName", brandNameOf(c.getBrand()));
        m.put("brandSlug", brands.findByOwnerId(c.getBrand().getId()).map(BrandProfile::getSlug).orElse(null));
        m.put("name", c.getName());
        m.put("description", c.getDescription());
        m.put("gameType", c.getGameType());
        m.put("requiredCategories", Json.strings(c.getRequiredCategoriesJson()));
        m.put("requiredStyles", Json.strings(c.getRequiredStylesJson()));
        m.put("requiredOccasions", Json.strings(c.getRequiredOccasionsJson()));
        m.put("minBrandPieces", c.getMinBrandPieces());
        m.put("minDeckPower", c.getMinDeckPower());
        m.put("minRarity", c.getMinRarity());
        m.put("minWins", c.getMinWins());
        m.put("coupon", Map.of("title", c.getCouponTitle(), "discountPercent", c.getDiscountPercent() == null ? "" : c.getDiscountPercent(),
                "discountAmount", c.getDiscountAmount() == null ? "" : c.getDiscountAmount(), "minPurchase", c.getMinPurchase() == null ? "" : c.getMinPurchase(), "validDays", c.getValidDays()));
        m.put("stock", c.getStock());
        m.put("redeemed", c.getRedeemed());
        m.put("active", c.isActive());
        m.put("available", available(c));
        m.put("startsAt", c.getStartsAt());
        m.put("endsAt", c.getEndsAt());
        m.put("accentColor", c.getAccentColor() == null ? "#2D55C9" : c.getAccentColor());
        m.put("storeUrl", c.getStoreUrl());
        if (viewer != null) {
            m.put("redemption", redemptions.findByCombinationIdAndUserId(c.getId(), viewer.id()).map(this::redemptionView).orElse(null));
        }
        return m;
    }

    /** Combinações ativas de todas as lojas, cada uma com o melhor deck do jogador e o checklist dos requisitos. */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> combinationsFor(CurrentUser user) {
        List<Deck> ds = user == null ? List.of() : decks(user);
        List<Card> wardrobe = user == null ? List.of() : pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream()
                .filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(this::card).toList();
        List<Map<String, Object>> out = new ArrayList<>();
        for (FlairCombination c : combinations.findByActiveTrueOrderByCreatedAtDesc()) {
            Map<String, Object> v = combinationView(c, user, null);
            if (user != null) {
                Deck best = null;
                List<Map<String, Object>> bestChecks = check(c, null, wardrobe, user);
                long bestOk = bestChecks.stream().filter(x -> Boolean.TRUE.equals(x.get("ok"))).count();
                if (!"COLECAO".equals(c.getGameType())) {
                    for (Deck d : ds) {
                        List<Map<String, Object>> ch = check(c, d, wardrobe, user);
                        long ok = ch.stream().filter(x -> Boolean.TRUE.equals(x.get("ok"))).count();
                        if (best == null || ok > bestOk || ok == bestOk && d.power() > best.power()) {
                            best = d;
                            bestChecks = ch;
                            bestOk = ok;
                        }
                    }
                }
                v.put("bestDeck", best == null ? null : Map.of("schemeId", best.schemeId(), "title", best.title(), "power", best.power()));
                v.put("checks", bestChecks);
                v.put("complete", !bestChecks.isEmpty() && bestChecks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok"))));
            }
            out.add(v);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> checkCombination(CurrentUser user, UUID id, UUID schemeId) {
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound("Combinação"));
        Deck d = schemeId == null ? null : deck(schemeService.owned(user, schemeId));
        List<Card> wardrobe = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(this::card).toList();
        List<Map<String, Object>> checks = check(c, d, wardrobe, user);
        return Map.of("combination", combinationView(c, user, d), "deck", d == null ? Map.of() : d, "checks", checks,
                "complete", !checks.isEmpty() && checks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok"))));
    }

    /** Troca o deck pelo cupom da loja: um por pessoa e combinação, com estoque e validade. */
    @Transactional
    public Map<String, Object> redeem(CurrentUser user, UUID id, UUID schemeId) {
        guard.requireCanCreate(user);
        FlairCombination c = combinations.findById(id).orElseThrow(() -> ApiException.notFound("Combinação"));
        if (!available(c)) {
            throw new ApiException(409, "COMBINACAO_INDISPONIVEL", "Esta combinação não está mais disponível.");
        }
        if (redemptions.findByCombinationIdAndUserId(c.getId(), user.id()).isPresent()) {
            throw ApiException.conflict("CUPOM_JA_EMITIDO", "Você já completou esta combinação.");
        }
        Scheme s = "COLECAO".equals(c.getGameType()) || schemeId == null ? null : ownDeckScheme(user, schemeId);
        Deck d = s == null ? null : deck(s);
        List<Card> wardrobe = pieces.findByUserIdOrderByCreatedAtDesc(user.id()).stream().filter(w -> w.getAvailabilityStatus() != AvailabilityStatus.ARCHIVED).map(this::card).toList();
        List<Map<String, Object>> checks = check(c, d, wardrobe, user);
        if (checks.isEmpty() || !checks.stream().allMatch(x -> Boolean.TRUE.equals(x.get("ok")))) {
            throw new ApiException(422, "COMBINACAO_INCOMPLETA", "O deck ainda não completa a combinação.", Map.of("checks", checks));
        }
        FlairRedemption r = new FlairRedemption();
        r.setCombination(c);
        r.setUser(users.findById(user.id()).orElseThrow());
        r.setScheme(s);
        String code;
        do {
            code = "FLR-" + token(4) + "-" + token(4);
        } while (redemptions.existsByCode(code));
        r.setCode(code);
        r.setStatus("EMITIDO");
        r.setDeckPower(d == null ? null : d.power());
        r.setExpiresAt(Instant.now().plus(c.getValidDays(), ChronoUnit.DAYS));
        redemptions.save(r);
        c.setRedeemed(c.getRedeemed() + 1);
        award(user.id(), 0, 50, "REDEMPTION", c.getId().toString());
        return redemptionView(r);
    }

    private static String token(int n) {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < n; i++) {
            b.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        }
        return b.toString();
    }

    Map<String, Object> redemptionView(FlairRedemption r) {
        FlairCombination c = r.getCombination();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("status", r.getStatus().equals("EMITIDO") && r.getExpiresAt().isBefore(Instant.now()) ? "EXPIRADO" : r.getStatus());
        m.put("expiresAt", r.getExpiresAt());
        m.put("usedAt", r.getUsedAt());
        m.put("createdAt", r.getCreatedAt());
        m.put("deck", r.getScheme() == null ? null : r.getScheme().getTitle());
        m.put("deckPower", r.getDeckPower());
        m.put("user", Views.user(r.getUser()));
        m.put("combination", Map.of("id", c.getId(), "name", c.getName(), "brandName", brandNameOf(c.getBrand()), "coupon", c.getCouponTitle(),
                "discountPercent", c.getDiscountPercent() == null ? "" : c.getDiscountPercent(), "discountAmount", c.getDiscountAmount() == null ? "" : c.getDiscountAmount(),
                "minPurchase", c.getMinPurchase() == null ? "" : c.getMinPurchase(), "accentColor", c.getAccentColor() == null ? "#2D55C9" : c.getAccentColor()));
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> vouchers(CurrentUser user) {
        return redemptions.findByUserIdOrderByCreatedAtDesc(user.id()).stream().map(this::redemptionView).toList();
    }

    /** Aba "Minhas combinações FLAIR" (dono) / "Combinações FLAIR" (visitante) do perfil da loja. */
    @Transactional(readOnly = true)
    public Map<String, Object> brandTab(CurrentUser viewer, String slug) {
        User owner = institutional.institutionalUser(slug);
        boolean admin = viewer != null && viewer.id().equals(owner.getId());
        List<FlairCombination> cs = combinations.findByBrandIdOrderByCreatedAtDesc(owner.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("admin", admin);
        out.put("brandName", brandNameOf(owner));
        out.put("participating", owner.getProfileType() == ProfileType.MARCA || owner.getProfileType() == ProfileType.CELEBRIDADE);
        out.put("combinations", cs.stream().filter(c -> admin || available(c)).map(c -> combinationView(c, viewer, null)).toList());
        if (admin) {
            List<FlairRedemption> rs = redemptions.findByCombinationBrandIdOrderByCreatedAtDesc(owner.getId());
            out.put("redemptions", rs.stream().limit(100).map(this::redemptionView).toList());
            out.put("stats", Map.of("issued", rs.size(), "used", rs.stream().filter(r -> "USADO".equals(r.getStatus())).count()));
            out.put("gameTypes", List.of(Map.of("id", "COMBINACAO", "label", "Combinação (um deck)"), Map.of("id", "COLECAO", "label", "Coleção (guarda-roupa inteiro)"),
                    Map.of("id", "DUELO_PATROCINADO", "label", "Duelo patrocinado (vitórias com peça da marca)")));
        }
        return out;
    }

    /** No caixa: a loja confere o código e marca o cupom como usado. */
    @Transactional
    public Map<String, Object> validateCode(CurrentUser user, String code) {
        User brand = brandOwner(user);
        FlairRedemption r = redemptions.findByCode(code == null ? "" : code.trim().toUpperCase(Locale.ROOT)).orElseThrow(() -> ApiException.notFound("Cupom"));
        if (!r.getCombination().getBrand().getId().equals(brand.getId())) {
            throw ApiException.notFound("Cupom");
        }
        if ("USADO".equals(r.getStatus())) {
            throw ApiException.conflict("CUPOM_USADO", "Cupom já usado em " + r.getUsedAt() + ".");
        }
        if (r.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.conflict("CUPOM_EXPIRADO", "Cupom expirado.");
        }
        r.setStatus("USADO");
        r.setUsedAt(Instant.now());
        return redemptionView(r);
    }
}
