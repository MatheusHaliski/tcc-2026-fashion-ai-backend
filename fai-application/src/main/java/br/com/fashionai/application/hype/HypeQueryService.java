package br.com.fashionai.application.hype;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.SchemeService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * HypeScore v2 — leitura. Nada aqui recalcula: lê o estado gravado pelo {@link HypeSnapshotService} (e o cache por
 * geração). Toda leitura respeita a visibilidade de quem pede; ranking e tendência públicos usam só entidades
 * {@code publicEligible}. A compatibilidade com o DNA de estilo vem SEMPRE num campo separado do Hype.
 * <p>
 * Fachada: cada caso de uso fica num colaborador do pacote (cards e detalhe, Em alta, agregados, painel pessoal, ranking
 * regional, filtros, posições e globo) sobre a base comum {@link HypeReadCore}; as transações ficam aqui.
 */
@Service
public class HypeQueryService {
    public static final int MAX_BATCH = 100;
    /** Peça esquecida: a régua única do app (RoomService.FORGOTTEN_DAYS, também usada pelo Copilot e pelo Meu Quarto). */
    static final int FORGOTTEN_DAYS = br.com.fashionai.application.service.RoomService.FORGOTTEN_DAYS;
    /** Itens públicos mínimos para uma marca/pessoa entrar no ranking (um item viral sozinho não representa o grupo). */
    static final int MIN_GROUP_ITEMS = 3;
    /** O valor do grupo é a média dos seus N itens mais relevantes (constância, não um pico isolado). */
    static final int GROUP_TOP_ITEMS = 5;
    /** Chaves por lote de GET /api/hype/groups (ver {@link HypeGroupChips}). */
    public static final int MAX_GROUP_KEYS = MAX_BATCH;
    public static final int RANKING_MAX_SIZE = 48;
    static final String NO_REGION = "OUTRAS";
    /** Janela das posições do item (análise completa): o HypeScore atual. */
    static final int POSITIONS_WINDOW = 7;
    /** Itens públicos mínimos para o país acender no globo (abaixo disso ele aparece apagado e sem card). */
    public static final int GLOBE_MIN_ITEMS = 3;
    /** Candidatos ao destaque guardados por país (o primeiro visível para quem vê vira o "top"). */
    static final int GLOBE_TOP_CANDIDATES = 8;

    private final HypeScoreConfig config;
    private final HypeReadCore core;
    private final HypeEntityReads entities;
    private final HypeTrending trending;
    private final HypeGroupRanking groupRanking;
    private final HypeGroupChips groupChips;
    private final HypePersonalHype personal;
    private final HypeRegionalRanking regional;
    private final HypeRankingFacets facets;
    private final HypeRankingPositions positions;
    private final HypeGlobe globe;

    /** Construtor de 11 argumentos (testes e stubs existentes): sem o repositório de perfis de marca, o agregado não leva {@code slug}. */
    public HypeQueryService(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                            WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, StyleDnaRepository dnas,
                            Guard guard, WardrobeService wardrobe, SchemeService schemeService, HypeCache cache) {
        this(config, current, snapshots, pieces, schemes, schemeItems, dnas, guard, wardrobe, schemeService, cache, null);
    }

    @Autowired
    public HypeQueryService(HypeScoreConfig config, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                            WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems, StyleDnaRepository dnas,
                            Guard guard, WardrobeService wardrobe, SchemeService schemeService, HypeCache cache, BrandProfileRepository brandProfiles) {
        this.config = config;
        this.core = new HypeReadCore(config, current, snapshots, pieces, schemes, schemeItems, dnas, guard, wardrobe, schemeService, cache, brandProfiles);
        this.entities = new HypeEntityReads(core);
        this.trending = new HypeTrending(core);
        this.groupRanking = new HypeGroupRanking(core);
        this.groupChips = new HypeGroupChips(core, groupRanking);
        this.personal = new HypePersonalHype(core);
        this.regional = new HypeRegionalRanking(core);
        this.facets = new HypeRankingFacets(core);
        this.positions = new HypeRankingPositions(core);
        this.globe = new HypeGlobe(core, new HypeGlobeAggregate(core));
    }

    /**
     * RF53 · P3-12 — preferências de quem pediu para não aparecer em "Criadores em alta". Por setter (os construtores de
     * 11 e 12 argumentos continuam valendo); sem ele, ninguém saiu do ranking.
     */
    @Autowired(required = false)
    public void setPreferences(UserPreferencesRepository preferences) {
        core.preferences = preferences;
    }

    /** Ids de quem saiu de "Criadores em alta" (uma consulta por montagem da tabela, que vai para o cache por geração). */
    Set<UUID> creatorOptOuts() {
        return groupRanking.creatorOptOuts();
    }

    @Autowired(required = false)
    public void setFashionDrops(AuraHypeDropService fashionDrops) {
        core.fashionDrops = fashionDrops;
    }

    // ================================================================== cards, detalhe e histórico
    @Transactional(readOnly = true)
    public Map<String, Object> summaries(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        return entities.summaries(viewer, type, ids);
    }

    /** Resumo do card (frente: score + seta; verso: dimensões). Sem linha = NOT_CALCULATED; linha antiga = stale. */
    Map<String, Object> summary(HypeScoreCurrent c, Instant now) {
        return core.summary(c, now);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(CurrentUser viewer, HypeEntityType type, UUID id) {
        return entities.detail(viewer, type, id);
    }

    public static StyleCompatibility.Profile profileOf(StyleDna d) {
        return HypeStyleProfiles.profileOf(d);
    }

    public static StyleCompatibility.Profile profileOf(WardrobeItem w) {
        return HypeStyleProfiles.profileOf(w);
    }

    public static StyleCompatibility.Profile profileOf(Scheme s, List<SchemeItem> items) {
        return HypeStyleProfiles.profileOf(s, items);
    }

    public static List<String> colorsOf(WardrobeItem w) {
        return HypeStyleProfiles.colorsOf(w);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> history(CurrentUser viewer, HypeEntityType type, UUID id, int days) {
        return entities.history(viewer, type, id, days);
    }

    // ================================================================== Em alta: itens, marcas e criadores
    @Transactional(readOnly = true)
    public Map<String, Object> trending(CurrentUser viewer, HypeEntityType type, int window, String category, String style, String occasion, int limit) {
        return trending.trending(viewer, type, window, category, style, occasion, limit);
    }

    Map<String, Object> rank(HypeEntityType type, int win, String category, String style, String occasion, int lim) {
        return trending.rank(type, win, category, style, occasion, lim);
    }

    /** Recortes agregados do "Em alta": a unidade é a marca (peças) ou a pessoa criadora (peças + looks). */
    public enum RankGroup {
        BRAND, CREATOR;

        public static RankGroup parse(String raw) {
            String t = raw == null ? "" : raw.trim().toUpperCase(Locale.ROOT);
            return switch (t) {
                case "BRAND", "BRANDS", "MARCA", "MARCAS" -> BRAND;
                case "CREATOR", "CREATORS", "CRIADOR", "CRIADORES", "USER", "USERS" -> CREATOR;
                default -> null;
            };
        }
    }

    public Map<String, Object> trendingGroups(CurrentUser viewer, RankGroup group, int window, String category, String style, String occasion, int limit) {
        return groupRanking.trendingGroups(viewer, group, window, category, style, occasion, limit);
    }

    /** Chave do agregado de marca: o nome normalizado (minúsculas, sem espaços nas pontas), igual ao ranking. */
    public static String brandKey(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> groups(CurrentUser viewer, RankGroup group, Collection<String> rawKeys, int window) {
        return groupChips.groups(viewer, group, rawKeys, window);
    }

    // ================================================================== painel pessoal (Perfil → Insights, Histórico → Hype)
    /** Dias sem uso: último uso registrado (ou o cadastro, se nunca foi usada). */
    public static long idleDays(WardrobeItem w, LocalDate today) {
        LocalDate ref = w.getLastWornDate() != null ? w.getLastWornDate()
                : w.getCreatedAt() == null ? today : w.getCreatedAt().atZone(HypeSignalRecorder.ZONE).toLocalDate();
        return Math.max(0, ChronoUnit.DAYS.between(ref, today));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> wardrobe(CurrentUser user) {
        return personal.wardrobe(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> movers(CurrentUser user, int days) {
        return personal.movers(user, days);
    }

    /** Subiu/caiu = direção calculada (fora da faixa "estável"), não o sinal do delta: −1,9 pts é estável, não queda. */
    static boolean isMoving(HypeScoreCurrent c) {
        return HypePersonalHype.isMoving(c);
    }

    // ================================================================== ranking por região, filtros, posições e globo
    @Transactional(readOnly = true)
    public Map<String, Object> ranking(CurrentUser viewer, HypeEntityType type, int window, String region, String country, String category,
                                       String subcategory, int page, int size) {
        return regional.ranking(viewer, type, window, region, country, category, subcategory, page, size);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> rankingFacets(HypeEntityType type, int window, String region, String category) {
        return facets.rankingFacets(type, window, region, category);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> positions(CurrentUser viewer, HypeEntityType type, UUID id) {
        return positions.positions(viewer, type, id);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> globe(CurrentUser viewer, HypeEntityType type, int window, String category, String subcategory, String minLevel) {
        return globe.globe(viewer, type, window, category, subcategory, minLevel);
    }

    // ================================================================== uso por outros serviços
    /** Estado atual de várias entidades do dono (ordenações do guarda-roupa, Copilot). */
    @Transactional(readOnly = true)
    public Map<UUID, HypeScoreCurrent> currentOf(HypeEntityType type, Collection<UUID> ids) {
        return core.currentOf(type, ids);
    }

    public HypeScoreConfig config() {
        return config;
    }
}
