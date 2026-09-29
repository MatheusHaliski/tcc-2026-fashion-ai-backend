package br.com.fashionai.application.ai;

import br.com.fashionai.application.audit.AuditService;
import br.com.fashionai.application.ports.RateLimitPort;
import br.com.fashionai.domain.model.enums.AiCallResult;
import br.com.fashionai.domain.repository.AiInferenceLogRepository;
import br.com.fashionai.domain.repository.UserConsentRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Teto diário de gasto com IA: global (inclui chamadas do sistema) e por usuário, somado do ai_inference_log. */
class AiBudgetTest {
    private static final Instant NOW = Instant.parse("2026-09-28T15:30:00Z");
    private static final Instant DAY = Instant.parse("2026-09-28T00:00:00Z");

    private static AiBudget budget(AiInferenceLogRepository logs, String global, String user) {
        return new AiBudget(logs, new BigDecimal(global), new BigDecimal(user), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void somaODiaUtcMaisAChamadaPendente() {
        AiInferenceLogRepository logs = mock(AiInferenceLogRepository.class);
        UUID ana = UUID.randomUUID();
        when(logs.sumEstimatedCostSince(DAY)).thenReturn(new BigDecimal("4.98"));
        when(logs.sumEstimatedCostByUserSince(ana, DAY)).thenReturn(new BigDecimal("0.10"));
        AiBudget b = budget(logs, "5.00", "0.50");

        assertThat(b.check(ana, new BigDecimal("0.01"))).isEqualTo(AiBudget.Verdict.OK);
        assertThat(b.check(ana, new BigDecimal("0.035"))).isEqualTo(AiBudget.Verdict.GLOBAL_EXHAUSTED);
        // chamada do sistema (job sem usuário) também conta no teto global
        assertThat(b.check(null, new BigDecimal("0.05"))).isEqualTo(AiBudget.Verdict.GLOBAL_EXHAUSTED);
    }

    @Test
    void tetoPorUsuarioNaoAtingeOutrasPessoasNemOSistema() {
        AiInferenceLogRepository logs = mock(AiInferenceLogRepository.class);
        UUID ana = UUID.randomUUID();
        when(logs.sumEstimatedCostSince(any())).thenReturn(new BigDecimal("1.00"));
        when(logs.sumEstimatedCostByUserSince(eq(ana), any())).thenReturn(new BigDecimal("0.49"));
        when(logs.sumEstimatedCostByUserSince(eq(UUID.fromString("00000000-0000-0000-0000-000000000001")), any())).thenReturn(BigDecimal.ZERO);
        AiBudget b = budget(logs, "5.00", "0.50");

        assertThat(b.check(ana, new BigDecimal("0.05"))).isEqualTo(AiBudget.Verdict.USER_EXHAUSTED);
        assertThat(b.check(UUID.fromString("00000000-0000-0000-0000-000000000001"), new BigDecimal("0.05"))).isEqualTo(AiBudget.Verdict.OK);
        assertThat(b.check(null, new BigDecimal("0.05"))).isEqualTo(AiBudget.Verdict.OK);
    }

    @Test
    void zeroOuNegativoDesligaOTeto() {
        AiInferenceLogRepository logs = mock(AiInferenceLogRepository.class);
        when(logs.sumEstimatedCostSince(any())).thenReturn(new BigDecimal("999"));
        when(logs.sumEstimatedCostByUserSince(any(), any())).thenReturn(new BigDecimal("999"));
        assertThat(budget(logs, "0", "-1").check(UUID.randomUUID(), BigDecimal.ONE)).isEqualTo(AiBudget.Verdict.OK);
    }

    @Test
    void semComoSomarOGastoNaoArriscaChamadaRemota() {
        AiInferenceLogRepository logs = mock(AiInferenceLogRepository.class);
        when(logs.sumEstimatedCostSince(any())).thenThrow(new IllegalStateException("banco fora"));
        assertThat(budget(logs, "5.00", "0.50").check(null, BigDecimal.ZERO)).isEqualTo(AiBudget.Verdict.GLOBAL_EXHAUSTED);
    }

    @Test
    void inicioDoDiaEmUtc() {
        assertThat(AiBudget.startOfUtcDay(Instant.parse("2026-09-28T23:59:59Z"))).isEqualTo(DAY);
        assertThat(AiBudget.startOfUtcDay(Instant.parse("2026-09-29T00:00:00Z"))).isEqualTo(Instant.parse("2026-09-29T00:00:00Z"));
    }

    // ------------------------------------------------------------------ motor: teto estourado não chama provedor pago

    private static final class FakeProvider implements AiProviderPort {
        final List<AiRequest> calls = new ArrayList<>();

        @Override
        public String providerId() {
            return "claude";
        }

        @Override
        public boolean available() {
            return true;
        }

        @Override
        public AiResponse invoke(AiRequest request) {
            calls.add(request);
            return new AiResponse("claude", request.model(), 5, new BigDecimal("0.03"), "{\"ok\":true}", 10, 10);
        }
    }

    private static AiEngine engine(FakeProvider provider, AiBudget budget, RateLimitPort rateLimit) {
        UserConsentRepository consents = mock(UserConsentRepository.class);
        when(consents.findByUserIdAndPurpose(any(), any())).thenReturn(Optional.empty());
        AuditService audit = event -> {
        };
        return new AiEngine(List.of(provider), rateLimit, consents, mock(AiInferenceLogRepository.class), audit, budget, true, false);
    }

    private static AiEngine.TextCall<String> logoCall(UUID userId) {
        // BRAND_LOGO_FINDER não trata dado pessoal: sem consentimento a exigir, o teto é o único freio
        return new AiEngine.TextCall<>(userId, AiCapability.BRAND_LOGO_FINDER, "s", "p", List.of(), 100, List.of(),
                text -> "remoto", () -> "local", null, true);
    }

    @Test
    void motorPulaOProvedorQuandoOTetoGlobalEstoura() {
        FakeProvider provider = new FakeProvider();
        AiBudget budget = mock(AiBudget.class);
        when(budget.check(any(), any())).thenReturn(AiBudget.Verdict.GLOBAL_EXHAUSTED);
        RateLimitPort rateLimit = mock(RateLimitPort.class);
        AiOutcome<String> out = engine(provider, budget, rateLimit).text(logoCall(null));

        assertThat(out.value()).isEqualTo("local");
        assertThat(out.result()).isEqualTo(AiCallResult.FALLBACK_LOCAL);
        assertThat(provider.calls).isEmpty();
        verify(rateLimit, never()).tryAcquire(any(), anyString(), anyInt(), any());   // cota do usuário não é consumida
    }

    @Test
    void motorPulaOProvedorQuandoOTetoDoUsuarioEstoura() {
        FakeProvider provider = new FakeProvider();
        AiBudget budget = mock(AiBudget.class);
        when(budget.check(any(), any())).thenReturn(AiBudget.Verdict.USER_EXHAUSTED);
        AiOutcome<String> out = engine(provider, budget, mock(RateLimitPort.class)).text(logoCall(UUID.randomUUID()));

        assertThat(out.value()).isEqualTo("local");
        assertThat(out.result()).isEqualTo(AiCallResult.RATE_LIMITED);
        assertThat(provider.calls).isEmpty();
    }

    @Test
    void dentroDoTetoOProvedorEChamadoComOCustoEstimadoDoCatalogo() {
        FakeProvider provider = new FakeProvider();
        AiBudget budget = mock(AiBudget.class);
        when(budget.check(any(), any())).thenReturn(AiBudget.Verdict.OK);
        RateLimitPort rateLimit = mock(RateLimitPort.class);
        when(rateLimit.status(any(), anyString(), anyInt(), any())).thenReturn(new RateLimitPort.QuotaStatus(20, 0, NOW));
        when(rateLimit.tryAcquire(any(), anyString(), anyInt(), any())).thenReturn(true);
        UUID ana = UUID.randomUUID();
        AiOutcome<String> out = engine(provider, budget, rateLimit).text(logoCall(ana));

        assertThat(out.value()).isEqualTo("remoto");
        assertThat(provider.calls).hasSize(1);
        verify(budget).check(ana, AiCatalog.spec(AiCapability.BRAND_LOGO_FINDER).primary().costPerCallUsd());
    }

    @Test
    void custoEstimadoUsaOPrimeiroProvedorRemoto() {
        assertThat(AiEngine.estimatedCost(AiCatalog.spec(AiCapability.STUDIO_ENHANCER))).isEqualByComparingTo("0.1000");
        // primário local (rembg é auto-hospedado: custo 0) — o custo real do remove.bg entra no log depois
        assertThat(AiEngine.estimatedCost(AiCatalog.spec(AiCapability.FLAT_LAY_STANDARDIZER))).isEqualByComparingTo("0");
        assertThat(AiEngine.estimatedCost(AiCatalog.spec(AiCapability.SEALBOND_MATCHER))).isEqualByComparingTo("0.0300");
    }

    @Test
    void capacidadesPagasPorImagemTemCotaBaixa() {
        for (AiCapability c : List.of(AiCapability.STUDIO_ENHANCER, AiCapability.BRAND_LOGO_FINDER, AiCapability.FLAT_LAY_STANDARDIZER,
                AiCapability.TRY_ON, AiCapability.TRY_ON_POLISH, AiCapability.BACKGROUND_GENERATOR)) {
            assertThat(AiCatalog.spec(c).dailyQuotaPerUser()).as(c.name()).isLessThanOrEqualTo(30);
        }
    }
}
