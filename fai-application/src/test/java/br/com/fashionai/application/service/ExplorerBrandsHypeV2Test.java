package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.ports.AnalyticsQueryPort;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 1 (P1-04, P2-04) — Explorador › Marcas & lojas e Insights globais no HypeScore v2 só público. Inclui a
 * regressão de privacidade da V6: {@code vw_brand_usage.avg_hype} tirava a média de peças privadas também e era o
 * fallback do Hype da marca numa tela pública e anônima — peça privada nunca entra num agregado público.
 */
class ExplorerBrandsHypeV2Test {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private AnalyticsQueryPort analytics;
    private BrandProfileRepository brands;
    private SealBondRepository bonds;
    private HypeScoreCurrentRepository hype;
    private WardrobeItemRepository pieces;
    private SchemeRepository schemes;
    private ExplorerService explorer;
    private final List<HypeScoreCurrent> rows = new ArrayList<>();
    private final List<WardrobeItem> pieceRows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        analytics = mock(AnalyticsQueryPort.class);
        brands = mock(BrandProfileRepository.class);
        bonds = mock(SealBondRepository.class);
        hype = mock(HypeScoreCurrentRepository.class);
        pieces = mock(WardrobeItemRepository.class);
        schemes = mock(SchemeRepository.class);
        explorer = new ExplorerService(analytics, brands, bonds, mock(AiEngine.class), hype, config, pieces, schemes);
        when(hype.findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), eq("HYPE_V2"), eq(HypeStatus.AVAILABLE)))
                .thenAnswer(a -> rows.stream().filter(r -> r.getEntityType() == a.getArgument(0)).toList());
        when(hype.findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), anyCollection(), eq("HYPE_V2"))).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(1);
            return rows.stream().filter(r -> r.getEntityType() == a.getArgument(0) && ids.contains(r.getEntityId())).toList();
        });
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> {
            Collection<UUID> ids = a.getArgument(0);
            return pieceRows.stream().filter(w -> ids.contains(w.getId())).toList();
        });
    }

    private WardrobeItem piece(String brand, String color, String category, double score, boolean eligible) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setBrandName(brand);
        w.setColor(color);
        w.setCategory(category);
        pieceRows.add(w);
        HypeScoreCurrent c = SearchHypeV2Test.row(HypeEntityType.PIECE, w.getId(), score, eligible);
        c.setCategory(category);
        HypeDimensions d = new HypeDimensions();
        d.setTrend(BigDecimal.valueOf(score / 2 + 30));
        c.setDimensions(d);
        rows.add(c);
        return w;
    }

    private BrandProfile brand(String name) {
        User owner = new User();
        owner.assignId(UUID.randomUUID());
        owner.setProfileType(ProfileType.MARCA);
        BrandProfile b = new BrandProfile();
        b.assignId(UUID.randomUUID());
        b.setOwner(owner);
        b.setBrandName(name);
        b.setSlug(name.toLowerCase());
        b.setApprovalStatus(ApprovalStatus.APROVADO);
        return b;
    }

    private static Map<String, Object> usage(String brand, long all, long pub, double avgHypeWithPrivate) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("brand", brand);
        m.put("pieces", all);
        m.put("public_pieces", pub);
        m.put("owners", 3L);
        m.put("avg_hype", avgHypeWithPrivate);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> hypeOf(Map<String, Object> card) {
        return (Map<String, Object>) card.get("hype");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> cards(Map<String, Object> out) {
        return (List<Map<String, Object>>) out.get("brands");
    }

    // ------------------------------------------------------------------ privacidade (regressão V6)

    @Test
    void privatePieceNeverEntersTheBrandAggregateAndTheV6AverageIsGone() {
        BrandProfile nike = brand("Nike");
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(nike));
        // a view da V6 somava a peça privada (média 95 e 10 peças); a grade é pública e anônima
        when(analytics.brandUsage(anyInt())).thenReturn(List.of(usage("Nike", 10, 2, 95)));
        piece("Nike", "black", "upper_piece", 40, true);
        piece("Nike", "black", "upper_piece", 50, true);
        piece("Nike", "black", "upper_piece", 99, false);   // privada: mesmo se a consulta devolvesse, fica fora

        Map<String, Object> card = cards(explorer.brandsAndStores(null, null, null, null, "HYPE", null, null, null, null)).get(0);

        assertThat(hypeOf(card)).containsEntry("value", null).containsEntry("level", null).containsEntry("sufficient", false)
                .containsEntry("items", 2).containsEntry("minItems", 3);
        assertThat(card).containsEntry("hypeScore", null).containsEntry("stars", null).containsEntry("pieces", 2L);
        verify(hype, never()).findByEntityTypeAndAlgorithmVersion(any(), any());   // nunca lê a população inteira (privados inclusive)
    }

    @Test
    void privatePieceDoesNotPullTheBrandGroupAverageUp() {
        BrandProfile nike = brand("Nike");
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(nike));
        piece("Nike", "black", "upper_piece", 60, true);
        piece("nike ", "white", "upper_piece", 70, true);    // mesma marca normalizada
        piece("Nike", "black", "lower_piece", 80, true);
        piece("Nike", "black", "lower_piece", 100, false);   // privada

        Map<String, Object> h = hypeOf(cards(explorer.brandsAndStores(null, null, null, null, null, null, null, null, null)).get(0));
        assertThat(h).containsEntry("value", 70.0).containsEntry("level", "HOT").containsEntry("basis", "BRAND_GROUP").containsEntry("items", 3);
    }

    // ------------------------------------------------------------------ v2 aditivo, faixa mínima e ordenação

    @Test
    void bondedLooksWinWhenThereAreEnoughPublicOnesAndExpiredOrPrivateBondsAreIgnored() {
        BrandProfile brand = brand("Atelier");
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(brand));
        List<SealBond> approved = new ArrayList<>();
        double[] scores = {80, 70, 60};
        for (double s : scores) {
            approved.add(bond(lookWith(s, true), null));
        }
        approved.add(bond(lookWith(99, false), null));                              // look privado: Hype só pessoal
        approved.add(bond(lookWith(5, true), Instant.now().minusSeconds(60)));      // vínculo vencido
        when(bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(brand.getOwner().getId(), SealBondStatus.APPROVED)).thenReturn(approved);

        Map<String, Object> card = cards(explorer.brandsAndStores(null, null, null, null, null, null, null, null, null)).get(0);
        assertThat(hypeOf(card)).containsEntry("value", 70.0).containsEntry("basis", "BONDED_LOOKS").containsEntry("items", 3).containsEntry("level", "HOT");
        assertThat(card).containsEntry("schemes", 5L).containsEntry("hypeScore", 70L);
    }

    private Scheme lookWith(double score, boolean eligible) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        rows.add(SearchHypeV2Test.row(HypeEntityType.SCHEME, s.getId(), score, eligible));
        return s;
    }

    private static SealBond bond(Scheme s, Instant expiresAt) {
        SealBond b = new SealBond();
        b.assignId(UUID.randomUUID());
        b.setScheme(s);
        b.setStatus(SealBondStatus.APPROVED);
        b.setExpiresAt(expiresAt);
        return b;
    }

    @Test
    void sortByHypeKeepsBrandsWithoutDataLastAndMinLevelFiltersByBand() {
        BrandProfile low = brand("Baixa");
        BrandProfile none = brand("Sem dados");
        BrandProfile hot = brand("Quente");
        when(brands.findByApprovalStatusOrderByCreatedAtDesc(ApprovalStatus.APROVADO)).thenReturn(List.of(none, low, hot));
        for (int i = 0; i < 3; i++) {
            piece("Baixa", "black", "upper_piece", 30, true);
            piece("Quente", "black", "upper_piece", 59.6, true);   // 60 na tela = Em alta
        }

        List<Map<String, Object>> all = cards(explorer.brandsAndStores(null, null, null, null, "HYPE", null, null, null, null));
        assertThat(all).extracting(m -> m.get("name")).containsExactly("Quente", "Baixa", "Sem dados");

        List<Map<String, Object>> onlyHot = cards(explorer.brandsAndStores(null, null, null, null, null, null, null, null, "HOT"));
        assertThat(onlyHot).extracting(m -> m.get("name")).containsExactly("Quente");
        // hypeMin (deprecado) compara com o número v2 exibido; sem dado nunca passa
        List<Map<String, Object>> min30 = cards(explorer.brandsAndStores(null, null, null, null, null, null, null, 30, null));
        assertThat(min30).extracting(m -> m.get("name")).containsExactlyInAnyOrder("Quente", "Baixa");
        assertThatThrownBy(() -> explorer.brandsAndStores(null, null, null, null, null, null, null, null, "ICONE_DE_ESTILO"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void brandHypeRulesAreDescriptiveAndNeverZero() {
        assertThat(ExplorerService.brandHype(List.of(), List.of(), config)).containsEntry("value", null).containsEntry("basis", null);
        assertThat(ExplorerService.brandHype(List.of(90.0, 90.0), List.of(10.0, 20.0, 30.0), config))
                .containsEntry("basis", "BRAND_GROUP").containsEntry("value", 20.0).containsEntry("level", "NICHE");
        // BRAND_GROUP = média das 5 mais relevantes (constância, não pico)
        assertThat(ExplorerService.brandHype(List.of(), List.of(10.0, 90.0, 80.0, 70.0, 60.0, 50.0), config)).containsEntry("value", 70.0);
    }

    // ------------------------------------------------------------------ Insights globais (P2-04)

    @Test
    @SuppressWarnings("unchecked")
    void insightRankingsUseThePublicV2PopulationAndSeparateGrowthFromVolume() {
        for (int i = 0; i < 3; i++) {
            piece("Nike", "black", "upper_piece", 80, true);
            piece("Zara", "white", "lower_piece", 40, true);
        }
        piece("Nike", "red", "upper_piece", 99, false);       // privada: fora da cor, da marca e da categoria
        piece("Nike", "red", "upper_piece", 90, true);        // só 1 vermelha pública: grupo pequeno não entra
        Scheme summer = new Scheme();
        summer.assignId(UUID.randomUUID());
        summer.setSeason(Season.SUMMER);
        for (int i = 0; i < 3; i++) {
            rows.add(SearchHypeV2Test.row(HypeEntityType.SCHEME, summer.getId(), 66, true));
        }
        when(schemes.findByIdIn(anyCollection())).thenReturn(List.of(summer));
        when(analytics.brandUsage(anyInt())).thenReturn(List.of(usage("Zara", 50, 3, 99), usage("Nike", 9, 7, 10)));

        Map<String, Object> out = explorer.insights(null);
        Map<String, Object> rankings = (Map<String, Object>) out.get("rankings");
        assertThat((List<Map<String, Object>>) rankings.get("hypeByColor")).extracting(m -> m.get("label")).containsExactly("black", "white");
        assertThat(((List<Map<String, Object>>) rankings.get("hypeByColor")).get(0)).containsEntry("value", 80.0).containsEntry("level", "TRENDING").containsEntry("items", 3);
        assertThat(((List<Map<String, Object>>) rankings.get("hypeByBrand")).get(0)).containsEntry("label", "Nike").containsEntry("value", 82.5);
        assertThat(((List<Map<String, Object>>) rankings.get("hypeBySeason")).get(0)).containsEntry("label", "SUMMER").containsEntry("value", 66.0);
        // volume = só peças públicas (a view contava as privadas)
        assertThat((List<Map<String, Object>>) rankings.get("topBrands")).extracting(m -> m.get("label")).containsExactly("Nike", "Zara");
        Map<String, Object> v2 = (Map<String, Object>) out.get("hype");
        assertThat((List<Map<String, Object>>) v2.get("byCategory")).extracting(m -> m.get("label")).containsExactly("upper_piece", "lower_piece");
        assertThat((List<Map<String, Object>>) v2.get("growthByCategory")).first().satisfies(m -> assertThat(m).containsKey("value").doesNotContainKey("level"));
        assertThat(String.valueOf(out.get("aiInsight"))).contains("cresce");
        verify(analytics, never()).hypeByColor(anyInt());
        verify(analytics, never()).hypeByBrand(anyInt());
        verify(analytics, never()).hypeBySeason(any());
    }
}
