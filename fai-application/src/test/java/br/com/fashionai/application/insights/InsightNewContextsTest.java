package br.com.fashionai.application.insights;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.RenderCachePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.service.ExplorerService;
import br.com.fashionai.application.service.LookbookService;
import br.com.fashionai.application.service.RoomService;
import br.com.fashionai.application.service.WardrobeService;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.Follow;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.FollowStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.FollowRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Lote A5 (P3-15): faixas de insights no feed, na busca, nos perfis de marca/celebridade e de pessoa (públicos: só
 * agregados de itens públicos elegíveis, bloqueio respeitado) e no editor de look (pessoal: Hype sempre com DNA e uso).
 */
@SuppressWarnings("unchecked")
class InsightNewContextsTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private HypeQueryService hype;
    private HypeScoreCurrentRepository current;
    private RenderCachePort cachePort;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private StyleDnaRepository dnas;
    private UserRepository users;
    private BrandProfileRepository brands;
    private CelebrityProfileRepository celebrities;
    private SealBondRepository bonds;
    private FollowRepository follows;
    private InsightService service;

    private final List<HypeScoreCurrent> publicPieces = new ArrayList<>();
    private final List<HypeScoreCurrent> publicLooks = new ArrayList<>();
    private final List<WardrobeItem> catalog = new ArrayList<>();
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final LocalDate today = LocalDate.now(RoomService.ZONE);

    @BeforeEach
    void setUp() {
        hype = mock(HypeQueryService.class);
        when(hype.config()).thenReturn(config);
        current = mock(HypeScoreCurrentRepository.class);
        cachePort = mock(RenderCachePort.class);
        when(cachePort.get(any())).thenReturn(Optional.empty());
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        dnas = mock(StyleDnaRepository.class);
        users = mock(UserRepository.class);
        brands = mock(BrandProfileRepository.class);
        celebrities = mock(CelebrityProfileRepository.class);
        bonds = mock(SealBondRepository.class);
        follows = mock(FollowRepository.class);
        when(follows.findByFollowerIdAndFollowingId(any(), any())).thenReturn(Optional.empty());
        UserPreferencesRepository preferences = mock(UserPreferencesRepository.class);
        when(preferences.findByUserId(any())).thenReturn(Optional.empty());
        when(dnas.findByUserId(any())).thenReturn(Optional.empty());
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.PIECE, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(publicPieces);
        when(current.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(HypeEntityType.SCHEME, "HYPE_V2", HypeStatus.AVAILABLE)).thenReturn(publicLooks);
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> catalog.stream().filter(w -> ((java.util.Collection<?>) inv.getArgument(0)).contains(w.getId())).toList());
        when(pieces.findById(any())).thenAnswer(inv -> catalog.stream().filter(w -> w.getId().equals(inv.getArgument(0))).findFirst());
        when(users.findById(any())).thenReturn(Optional.empty());
        when(users.findByUsernameIgnoreCase(anyString())).thenReturn(Optional.empty());
        when(brands.findBySlug(anyString())).thenReturn(Optional.empty());
        when(celebrities.findBySlug(anyString())).thenReturn(Optional.empty());
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(any(), any())).thenReturn(List.of());
        service = new InsightService(hype, current, new HypeCache(cachePort), pieces, schemes, mock(SchemeItemRepository.class), dnas, preferences,
                mock(LookbookService.class), mock(ExplorerService.class), mock(WardrobeService.class), mock(AiEngine.class), users, brands, celebrities, bonds,
                new Guard(e -> {
                }, follows));
    }

    // ================================================================== fixtures
    static HypeScoreCurrent row(HypeEntityType type, UUID owner, double score, double popularity, double trend, boolean eligible, String styles, String occasions) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(UUID.randomUUID());
        c.setOwnerId(owner);
        c.setAlgorithmVersion("HYPE_V2");
        c.setStatus(HypeStatus.AVAILABLE);
        c.setScore(BigDecimal.valueOf(score));
        c.setLevel(HypeScoreConfig.defaults().level(score));
        HypeDimensions d = new HypeDimensions();
        d.setPopularity(BigDecimal.valueOf(popularity));
        d.setTrend(BigDecimal.valueOf(trend));
        c.setDimensions(d);
        c.setPublicEligible(eligible);
        c.setCategory("upper_piece");
        c.setStyles(styles);
        c.setOccasions(occasions);
        c.setSignalsJson(Json.write(Map.of("windowCurrent", trend >= 60 ? 12 : 4, "windowPrevious", trend >= 60 ? 3 : 4)));
        c.setCalculatedAt(Instant.now());
        c.setWindowStart(Instant.now());
        c.setWindowEnd(Instant.now());
        return c;
    }

    static User user(String username, ProfileType type) {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername(username);
        u.setDisplayName(username.substring(0, 1).toUpperCase() + username.substring(1));
        u.setProfileType(type);
        u.setStatus(AccountStatus.ACTIVE);
        u.setProfileVisibility(Visibility.PUBLIC);
        return u;
    }

    /** Peça pública no catálogo com a marca e a linha de Hype correspondente. */
    HypeScoreCurrent brandPiece(User owner, String brand, String name, double score, double trend, boolean eligible) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName(name);
        w.setBrandName(brand);
        catalog.add(w);
        HypeScoreCurrent c = row(HypeEntityType.PIECE, owner.getId(), score, 40, trend, eligible, "streetwear", "casual");
        c.setEntityId(w.getId());
        publicPieces.add(c);
        return c;
    }

    static List<Map<String, Object>> items(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("items");
    }

    static List<String> codes(Map<String, Object> out) {
        return items(out).stream().map(m -> String.valueOf(m.get("code"))).toList();
    }

    static Map<String, Object> item(Map<String, Object> out, String code) {
        return items(out).stream().filter(m -> code.equals(m.get("code"))).findFirst().orElseThrow(() -> new AssertionError("sem " + code + " em " + codes(out)));
    }

    static String text(Map<String, Object> item) {
        return String.valueOf(item.get("text"));
    }

    void block(UUID a, UUID b) {
        Follow f = new Follow();
        f.setStatus(FollowStatus.BLOQUEADO);
        when(follows.findByFollowerIdAndFollowingId(a, b)).thenReturn(Optional.of(f));
    }

    // ================================================================== contextos
    @Test
    void novosContextosPublicosEPessoais() {
        for (String ctx : List.of("FEED", "SEARCH", "BRAND_PROFILE", "CREATOR_PROFILE")) {
            assertThat(InsightContext.parse(ctx).isPublic()).as(ctx).isTrue();
        }
        assertThat(InsightContext.parse("look-editor").isPublic()).isFalse();
        assertThat(InsightContext.BRAND_PROFILE.isProfile()).isTrue();
        assertThat(InsightContext.FEED.isProfile()).isFalse();
        assertThatThrownBy(() -> service.insights(null, "LOOK_EDITOR", null, null, null, null, null, List.of(), false))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.status()).isEqualTo(401));
    }

    // ================================================================== feed
    @Test
    void feedFalaDeCrescimentoEDaFaixaEmAltaSoComLooksPublicos() {
        UUID a = UUID.randomUUID();
        publicLooks.add(row(HypeEntityType.SCHEME, a, 82, 30, 80, true, "streetwear", "party"));
        publicLooks.add(row(HypeEntityType.SCHEME, a, 64, 30, 78, true, "streetwear", "party"));
        publicLooks.add(row(HypeEntityType.SCHEME, a, 40, 90, 45, true, "classic", "work"));
        publicLooks.add(row(HypeEntityType.SCHEME, a, 38, 90, 45, true, "classic", "work"));
        publicLooks.add(row(HypeEntityType.SCHEME, a, 99, 99, 99, false, "minimalist", "beach"));   // vazou do repositório: nunca entra

        Map<String, Object> out = service.insights(null, "FEED", 7, null, null, null, null, null, false);

        assertThat(out).containsEntry("context", "FEED");
        assertThat(text(item(out, "FEED_STYLE_RISING"))).contains("Streetwear").contains("looks públicos");
        assertThat(text(item(out, "FEED_HOT_SHARE"))).startsWith("2 de 4 looks públicos").contains("50%").contains("não curtidas");
        assertThat(text(item(out, "FEED_TREND_VS_POPULARITY"))).contains("Clássico").contains("Streetwear").contains("Popularidade não é tendência");
        items(out).forEach(m -> assertThat(text(m)).doesNotContain("Minimalista").doesNotContain("Praia").doesNotContain("{"));
        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(cachePort, atLeastOnce()).put(key.capture(), anyString(), any());
        assertThat(key.getAllValues()).anyMatch(k -> k.startsWith("hype:g0:insights:FEED:7:"));   // público: cache por geração
    }

    // ================================================================== busca
    @Test
    void buscaMostraOQueOFiltroEmAltaAlcancaEAMarcaQueMaisCresce() {
        UUID a = UUID.randomUUID();
        publicPieces.add(row(HypeEntityType.PIECE, a, 80, 30, 80, true, "streetwear", "casual"));
        publicPieces.add(row(HypeEntityType.PIECE, a, 30, 30, 50, true, "streetwear", "casual"));
        publicLooks.add(row(HypeEntityType.SCHEME, a, 91, 30, 50, true, "streetwear", "casual"));
        when(hype.trendingGroups(isNull(), eq(HypeQueryService.RankGroup.BRAND), eq(1), any(), any(), any(), anyInt()))
                .thenReturn(Map.of("items", List.of(Map.of("key", "nike", "name", "Nike", "value", 71.0, "items", 4))));

        Map<String, Object> out = service.insights(null, "SEARCH", 7, null, null, null, null, null, false);

        assertThat(text(item(out, "SEARCH_HOT_SHARE"))).startsWith("2 de 3 peças e looks públicos");
        Map<String, Object> brand = item(out, "SEARCH_BRAND_RISING");
        assertThat(text(brand)).contains("Nike").contains("71");
        assertThat(((Map<String, Object>) brand.get("action")).get("href")).isEqualTo("/search?tab=MARCAS&q=Nike");
    }

    // ================================================================== perfil de marca
    @Test
    void perfilDaMarcaTrazOHypeAgregadoComOEstiloEOsLooksComSeloSoPublicos() {
        User nikeOwner = user("nike", ProfileType.MARCA);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(nikeOwner);
        bp.setBrandName("Nike");
        bp.setSlug("nike");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        when(brands.findBySlug("nike")).thenReturn(Optional.of(bp));
        User ana = user("ana", ProfileType.PESSOAL);
        brandPiece(ana, "Nike", "Tênis", 80, 75, true);
        brandPiece(ana, " nike", "Jaqueta", 70, 70, true);
        brandPiece(ana, "NIKE", "Boné", 60, 40, true);
        brandPiece(ana, "Nike", "Privada", 99, 99, false);    // fora: não elegível
        brandPiece(ana, "Adidas", "Outra marca", 95, 95, true);
        when(hype.groups(isNull(), eq(HypeQueryService.RankGroup.BRAND), eq(List.of("nike")), eq(7)))
                .thenReturn(Map.of("items", Map.of("nike", Map.of("key", "nike", "sufficient", true, "value", 70.0, "level", "HOT", "items", 3))));
        Scheme bonded = new Scheme();
        bonded.assignId(UUID.randomUUID());
        SealBond b = new SealBond();
        b.setScheme(bonded);
        b.setStatus(SealBondStatus.APPROVED);
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(nikeOwner.getId(), SealBondStatus.APPROVED)).thenReturn(List.of(b));
        HypeScoreCurrent bondedHype = row(HypeEntityType.SCHEME, ana.getId(), 88, 30, 60, true, "streetwear", "casual");
        bondedHype.setEntityId(bonded.getId());
        when(hype.currentOf(eq(HypeEntityType.SCHEME), anyCollection())).thenReturn(Map.of(bonded.getId(), bondedHype));

        Map<String, Object> out = service.insights(null, "BRAND_PROFILE", null, null, null, null, "nike", null, false);

        Map<String, Object> h = item(out, "PROFILE_HYPE");
        assertThat(text(h)).contains("Nike").contains("Hype 70 (Em alta)").contains("3 peças públicas").contains("Streetwear").contains("não qualidade");
        assertThat(((Map<String, Object>) h.get("action")).get("href")).isEqualTo("/explorer?tab=trending&type=BRAND");
        assertThat(text(item(out, "PROFILE_GROWTH"))).contains("trend médio 62").contains("Crescimento, não volume");   // (75 + 70 + 40) ÷ 3
        assertThat(text(item(out, "PROFILE_BONDED_LOOKS"))).contains("1 look(s)").contains("88").contains("O selo não aumenta o Hype");
        items(out).forEach(m -> assertThat(text(m)).doesNotContain("Privada").doesNotContain("Adidas"));
    }

    @Test
    void marcaSemBaseDizInsuficienteNuncaZeroESlugDesconhecidoNaoQuebra() {
        User owner = user("tiny", ProfileType.MARCA);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(owner);
        bp.setBrandName("Tiny");
        bp.setSlug("tiny");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        when(brands.findBySlug("tiny")).thenReturn(Optional.of(bp));
        brandPiece(user("ana", ProfileType.PESSOAL), "Tiny", "Única", 90, 90, true);
        when(hype.groups(any(), any(), anyCollection(), anyInt())).thenReturn(Map.of("items", Map.of("tiny", Map.of("key", "tiny", "sufficient", false, "items", 1))));

        Map<String, Object> out = service.insights(null, "BRAND_PROFILE", null, null, null, null, "tiny", null, false);
        assertThat(codes(out)).contains("PROFILE_HYPE_INSUFFICIENT").doesNotContain("PROFILE_HYPE", "PROFILE_GROWTH");
        assertThat(text(item(out, "PROFILE_HYPE_INSUFFICIENT"))).contains("1 peça(s)").contains("a partir de 3").doesNotContain("Hype 0");

        assertThat(items(service.insights(null, "BRAND_PROFILE", null, null, null, null, "nao-existe", null, false))).isEmpty();
        bp.setApprovalStatus(ApprovalStatus.PENDENTE);    // marca em validação não tem tela pública
        assertThat(items(service.insights(null, "BRAND_PROFILE", null, null, null, null, "tiny", null, false))).isEmpty();
    }

    @Test
    void celebridadeUsaOsItensPublicosDelaComoCriadora() {
        User star = user("star", ProfileType.CELEBRIDADE);
        CelebrityProfile cp = new CelebrityProfile();
        cp.setOwner(star);
        cp.setStageName("Star");
        cp.setSlug("star");
        cp.setVerificationStatus(ApprovalStatus.APROVADO);
        when(celebrities.findBySlug("star")).thenReturn(Optional.of(cp));
        for (int i = 0; i < 3; i++) {
            publicLooks.add(row(HypeEntityType.SCHEME, star.getId(), 70 + i, 30, 50, true, "glam", "party"));
        }
        when(hype.groups(isNull(), eq(HypeQueryService.RankGroup.CREATOR), eq(List.of(star.getId().toString())), eq(7)))
                .thenReturn(Map.of("items", Map.of(star.getId().toString(), Map.of("sufficient", true, "value", 71.0, "level", "HOT", "items", 3))));
        Map<String, Object> out = service.insights(null, "BRAND_PROFILE", null, null, null, null, "star", null, false);
        assertThat(text(item(out, "PROFILE_HYPE"))).contains("Os itens públicos de Star").contains("Glam");
        assertThat(text(item(out, "PROFILE_TOP_OCCASION"))).contains("3 de 3");
    }

    // ================================================================== perfil pessoal
    @Test
    void perfilPessoalMostraOHypeDeCriadorEOItemQueMaisCresceERespeitaBloqueioEPrivacidade() {
        User bia = user("bia", ProfileType.PESSOAL);
        when(users.findByUsernameIgnoreCase("bia")).thenReturn(Optional.of(bia));
        HypeScoreCurrent rising = brandPiece(bia, null, "Jaqueta jeans", 66, 81, true);
        brandPiece(bia, null, "Saia", 55, 40, true);
        brandPiece(bia, null, "Bota", 50, 45, true);
        brandPiece(bia, null, "Diário íntimo", 99, 99, false);   // não elegível: nunca aparece
        when(hype.groups(isNull(), eq(HypeQueryService.RankGroup.CREATOR), anyCollection(), eq(7)))
                .thenReturn(Map.of("items", Map.of(bia.getId().toString(), Map.of("sufficient", true, "value", 57.0, "level", "RELEVANT", "items", 3))));

        Map<String, Object> out = service.insights(null, "CREATOR_PROFILE", null, null, null, null, "@bia", null, false);
        assertThat(text(item(out, "PROFILE_HYPE"))).contains("Bia").contains("Hype 57 (Relevante)").contains("3 itens públicos");
        Map<String, Object> item = item(out, "PROFILE_RISING_ITEM");
        assertThat(text(item)).contains("Jaqueta jeans").contains("trend 81").contains("não curtidas");
        assertThat(((Map<String, Object>) item.get("action")).get("href")).isEqualTo("/pieces/" + rising.getEntityId());
        items(out).forEach(m -> assertThat(text(m)).doesNotContain("Diário íntimo"));

        block(me.id(), bia.getId());   // bloqueio: nada (como se o perfil não existisse)
        assertThat(items(service.insights(me, "CREATOR_PROFILE", null, null, null, null, "bia", null, false))).isEmpty();

        bia.setProfileVisibility(Visibility.FOLLOWERS);   // perfil fechado não tem agregado público
        assertThat(items(service.insights(null, "CREATOR_PROFILE", null, null, null, null, "bia", null, false))).isEmpty();
    }

    // ================================================================== editor de look
    WardrobeItem mine(String name, int wears, Integer daysSinceWorn) {
        User u = new User();
        u.assignId(uid);
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory("upper_piece");
        w.setSubcategory("t_shirt");
        w.setColor("black");
        w.setStyleTags("casual");
        w.setOccasionTags("casual");
        w.setWearCount(wears);
        w.setLastWornDate(daysSinceWorn == null ? null : today.minusDays(daysSinceWorn));
        w.markCreatedAt(Instant.now().minusSeconds(400L * 86400));
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setDisponivel(true);
        return w;
    }

    @Test
    void editorDeLookLeAsPecasEscolhidasComDnaEUsoAoLadoDoHype() {
        WardrobeItem a = mine("Camiseta preta", 4, 3);
        WardrobeItem b = mine("Calça", 2, 10);
        WardrobeItem semHype = mine("Cinto", 1, 5);
        when(pieces.findByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of(a, b, semHype));
        Map<UUID, HypeScoreCurrent> own = new HashMap<>();
        HypeScoreCurrent ha = row(HypeEntityType.PIECE, uid, 80, 40, 50, false, "casual", "casual");
        ha.setEntityId(a.getId());
        HypeScoreCurrent hb = row(HypeEntityType.PIECE, uid, 60, 40, 50, false, "casual", "casual");
        hb.setEntityId(b.getId());
        own.put(a.getId(), ha);
        own.put(b.getId(), hb);
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenReturn(own);
        StyleDna dna = new StyleDna();
        dna.setStyleKeywords("casual");
        dna.setColorPalette("black");
        dna.setOccasionKeywords("casual");
        when(dnas.findByUserId(uid)).thenReturn(Optional.of(dna));

        UUID alheia = UUID.randomUUID();   // peça de outra pessoa: ignorada
        Map<String, Object> out = service.insights(me, "LOOK_EDITOR", null, null, null, null, null, List.of(a.getId(), b.getId(), semHype.getId(), alheia), false);

        Map<String, Object> sel = item(out, "LOOK_EDITOR_SELECTION");
        assertThat(codes(out).get(0)).isEqualTo("LOOK_EDITOR_SELECTION");
        assertThat(text(sel)).startsWith("Peças escolhidas (3)").contains("Hype médio 70 entre as 2").contains("% de compatibilidade").contains("7 usos")
                .contains("contexto, não nota");
        assertThat((List<String>) sel.get("basis")).contains("HYPE_V2", "STYLE_DNA", "WARDROBE_USAGE");

        // só peças sem Hype: o texto diz "sem Hype calculado", nunca "Hype 0"
        Map<String, Object> none = service.insights(me, "LOOK_EDITOR", null, null, null, null, null, List.of(semHype.getId()), false);
        assertThat(text(item(none, "LOOK_EDITOR_SELECTION"))).contains("ainda sem Hype calculado").doesNotContain("Hype 0");
    }
}
