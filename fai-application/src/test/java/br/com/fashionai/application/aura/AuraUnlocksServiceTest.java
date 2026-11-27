package br.com.fashionai.application.aura;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import br.com.fashionai.application.aura.AuraUnlocks.Family;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.Kind;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.SealHypeOffersService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Circuito Aura — o serviço de leitura: visibilidade igual à do Hype, fontes somadas e Hype que não conta. */
class AuraUnlocksServiceTest {
    private final HypeQueryService hype = mock(HypeQueryService.class);
    private final SealHypeOffersService sealOffers = mock(SealHypeOffersService.class);
    private final UUID id = UUID.randomUUID();
    private final CurrentUser viewer = mock(CurrentUser.class);
    private final Map<String, Object> visibleItems = new LinkedHashMap<>();
    private List<Map<String, Object>> campaigns = List.of();

    @BeforeEach
    void setUp() {
        when(hype.config()).thenReturn(HypeScoreConfig.defaults());
        when(hype.summaries(any(), eq(HypeEntityType.PIECE), eq(List.of(id)))).thenAnswer(inv -> Map.of("items", visibleItems));
        when(sealOffers.offers(any(), eq(HypeEntityType.PIECE), eq(id), anyInt(), anyInt())).thenAnswer(inv -> Map.of("items", campaigns));
        visibleItems.put(id.toString(), Map.of());
    }

    static HypeScoreCurrent row(HypeStatus status, Double score, HypeLevel level, boolean publicEligible, Instant calculatedAt) {
        HypeScoreCurrent r = new HypeScoreCurrent();
        r.setStatus(status);
        r.setScore(score == null ? null : BigDecimal.valueOf(score));
        r.setLevel(level);
        r.setPublicEligible(publicEligible);
        r.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        r.setCalculatedAt(calculatedAt);
        return r;
    }

    private void current(HypeScoreCurrent row) {
        when(hype.currentOf(HypeEntityType.PIECE, List.of(id))).thenReturn(row == null ? Map.of() : Map.of(id, row));
    }

    private AuraUnlocksService service(AuraUnlockProvider... providers) {
        return new AuraUnlocksService(hype, sealOffers, List.of(providers));
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Map<String, Object> out, String key) {
        return (List<Map<String, Object>>) out.get(key);
    }

    @Test
    void cardEmAltaMostraFaixaDeJogoCampanhasEAsFontesExtras() {
        current(row(HypeStatus.AVAILABLE, 64.0, HypeLevel.HOT, true, Instant.now()));
        campaigns = List.of(
                Map.of("seal", Map.of("name", "Selo Rua", "policy", Map.of("hype", Map.of("minLevel", "HOT"))), "eligible", true, "issuerProfileUrl", "/brands/rua"),
                Map.of("seal", Map.of("name", "Selo Pico", "policy", Map.of("hype", Map.of("minLevel", "TRENDING"))), "eligible", false),
                Map.of("seal", Map.of("name", "Selo Longe", "policy", Map.of("hype", Map.of("minLevel", "VIRAL"))), "eligible", false));
        AuraUnlockProvider arte = (v, t, i, s) -> List.of(
                AuraUnlocks.byLevel(Kind.AURA_REWARD, Family.METAMORPHOSE, "Prisma âmbar", "arte", "/arts-store", HypeLevel.TRENDING, s));

        Map<String, Object> out = service(arte).unlocks(viewer, HypeEntityType.PIECE, id);

        assertThat(out).containsEntry("level", "HOT").containsEntry("counts", true).containsEntry("entityId", id.toString());
        assertThat(list(out, "unlocked")).extracting(m -> m.get("kind") + ":" + m.get("title"))
                .containsExactly("FLAIR_BAND:Joga como Em alta no FLAIR", "SEAL_CAMPAIGN:Selo Rua");
        // "quase lá": só a campanha da faixa seguinte; a de duas faixas acima fica fora
        assertThat(list(out, "next")).extracting(m -> m.get("kind") + ":" + m.get("title") + ":" + m.get("requiredLevel"))
                .containsExactly("FLAIR_BAND:Faixa Tendência no FLAIR:TRENDING", "SEAL_CAMPAIGN:Selo Pico:TRENDING", "AURA_REWARD:Prisma âmbar:TRENDING");
        assertThat(out.get("nextLevel")).isEqualTo(Map.of("level", "TRENDING", "missingPoints", 11.0));
    }

    @Test
    void itemQueQuemPedeNaoPodeVerRespondeComoInexistenteSemConsultarMaisNada() {
        visibleItems.clear();   // privado de outra pessoa: o resumo de Hype não o devolve

        assertThatThrownBy(() -> service().unlocks(viewer, HypeEntityType.PIECE, id))
                .isInstanceOf(ApiException.class).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        verify(hype, never()).currentOf(any(), any());
        verify(sealOffers, never()).offers(any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    void donoVeOItemPrivadoComoHypePessoalQueNaoDestravaJogoNemCupom() {
        current(row(HypeStatus.AVAILABLE, 80.0, HypeLevel.TRENDING, false, Instant.now()));
        AuraUnlockProvider cupom = (v, t, i, s) -> List.of(AuraUnlocks.byLevel(Kind.COUPON, Family.HYPE, "Cupom", "d", "/coupons", HypeLevel.HOT, s));

        Map<String, Object> out = service(cupom).unlocks(viewer, HypeEntityType.PIECE, id);

        assertThat(out).containsEntry("level", "TRENDING").containsEntry("publicEligible", false).containsEntry("counts", false);
        assertThat(list(out, "unlocked")).extracting(m -> m.get("title")).containsExactly("Joga como Sinal baixo no FLAIR");
        assertThat(list(out, "next")).extracting(m -> m.get("kind")).contains("COUPON");
    }

    @Test
    void hypeDesatualizadoNaoConta() {
        current(row(HypeStatus.AVAILABLE, 80.0, HypeLevel.TRENDING, true, Instant.now().minus(30, ChronoUnit.DAYS)));

        Map<String, Object> out = service().unlocks(viewer, HypeEntityType.PIECE, id);

        assertThat(out).containsEntry("stale", true).containsEntry("counts", false);
    }

    @Test
    void semDadosSuficientesNaoMostraNotaNemDistancia() {
        current(row(HypeStatus.INSUFFICIENT_DATA, 0.0, null, true, Instant.now()));

        Map<String, Object> out = service().unlocks(viewer, HypeEntityType.PIECE, id);

        assertThat(out).containsEntry("status", "INSUFFICIENT_DATA");
        assertThat(out.get("score")).isNull();
        assertThat(out.get("nextLevel")).isNull();

        current(null);
        assertThat(service().unlocks(viewer, HypeEntityType.PIECE, id)).containsEntry("status", "NOT_CALCULATED");
    }

    @Test
    void campanhaSemFaixaDeclaradaEntraSemFaixaExigida() {
        assertThat(AuraUnlockSources.requiredLevel(Map.of("policy", Map.of("hype", Map.of("minScore", 60))))).isNull();
        assertThat(AuraUnlockSources.requiredLevel(Map.of("policy", Map.of("hype", Map.of("minLevel", "XPTO"))))).isNull();
        Item item = AuraUnlockSources.sealCampaigns(List.of(Map.of("seal", Map.of("name", "S"), "eligible", false)), AuraUnlocksTest.hot()).get(0);
        assertThat(item.requiredLevel()).isNull();
        assertThat(item.met()).isFalse();
    }
}
