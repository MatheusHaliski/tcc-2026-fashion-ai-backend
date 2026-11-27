package br.com.fashionai.application.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Circuito Aura (fase 1) — cupom por Hype: faixa válida/inválida, oferta antiga sem exigência, Hype insuficiente,
 * Hype privado ou desatualizado que não conta e a faixa da emissão conservada depois que o card cai de faixa.
 */
class CouponHypeTest {
    private Kit kit;
    /** Hype atual de cada card (id → linha), lido pelos dois emissores. */
    private final Map<UUID, HypeScoreCurrent> hype = new HashMap<>();

    @BeforeEach
    void setUp() {
        kit = new Kit();
    }

    static HypeScoreCurrent row(UUID id, HypeLevel level, boolean publicEligible, Instant calculatedAt) {
        HypeScoreCurrent r = new HypeScoreCurrent();
        r.setEntityId(id);
        r.setStatus(level == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        r.setScore(level == null ? null : BigDecimal.valueOf(10 + 15L * level.ordinal()));
        r.setLevel(level);
        r.setPublicEligible(publicEligible);
        r.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        r.setCalculatedAt(calculatedAt);
        return r;
    }

    private static ApiException refused(Runnable call, int status) {
        ApiException e = catchThrowableOfType(call::run, ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        assertThat(e.status()).isEqualTo(status);
        return e;
    }

    private User marca(String username) {
        User u = Kit.user(username);
        u.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(u);
    }

    private static SealService.PromotionForm promo(String faixa) {
        return new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "Cupom da loja", null, null, 10, null, null, null, null, null, null, null, null, null, null,
                null, null, faixa);
    }

    private static FlairService.CombinationForm combo(String faixa) {
        return new FlairService.CombinationForm("Combo de inverno", null, "COLECAO", List.of("full_body_piece"), List.of(), List.of(), 0, 0, null, 0,
                "10% na loja", 10, null, null, 30, 5, true, null, null, null, null, null, null, faixa);
    }

    @Test
    void faixaValidaVaziaEInvalida() {
        assertThat(CouponHypeRules.resolve(null)).isNull();
        assertThat(CouponHypeRules.resolve("  ")).isNull();
        assertThat(CouponHypeRules.resolve(" hot ")).isEqualTo("HOT");
        for (HypeLevel level : HypeLevel.values()) {
            assertThat(CouponHypeRules.resolve(level.name())).isEqualTo(level.name());
        }
        ApiException e = refused(() -> CouponHypeRules.resolve("LENDARIO"), 400);
        assertThat(e.code()).isEqualTo("FAIXA_HYPE_INVALIDA");
        assertThat(e.getMessage()).contains("LOW_SIGNAL", "VIRAL");
    }

    @Test
    void ofertaSemExigenciaAtendeSempreECardSemFaixaNuncaAtendeUmaExigencia() {
        assertThat(CouponHypeRules.meets(null, null)).isTrue();
        assertThat(CouponHypeRules.meets("HOT", null)).isFalse();
        assertThat(CouponHypeRules.meets("HOT", HypeLevel.RELEVANT)).isFalse();
        assertThat(CouponHypeRules.meets("HOT", HypeLevel.HOT)).isTrue();
        assertThat(CouponHypeRules.meets("HOT", HypeLevel.VIRAL)).isTrue();
        CouponHypeRules.require(null, null);
        ApiException e = refused(() -> CouponHypeRules.require("HOT", HypeLevel.RELEVANT), 409);
        assertThat(e.code()).isEqualTo("HYPE_INSUFICIENTE");
        assertThat(e.getMessage()).contains("Em alta", "Relevante");
        assertThat(refused(() -> CouponHypeRules.require("HOT", null), 409).getMessage()).contains("público e atualizado");
    }

    @Test
    void soContaHypePublicoEAtualizado() {
        UUID id = UUID.randomUUID();
        CouponHypeGate gate = new CouponHypeGate(HypeScoreConfig::defaults, (type, ids) -> hype);

        hype.put(id, row(id, HypeLevel.TRENDING, true, Instant.now()));
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id))).isEqualTo(HypeLevel.TRENDING);
        hype.put(id, row(id, HypeLevel.TRENDING, false, Instant.now()));                              // privado: Hype pessoal
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id))).isNull();
        hype.put(id, row(id, HypeLevel.TRENDING, true, Instant.now().minus(30, ChronoUnit.DAYS)));    // nota vencida
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id))).isNull();
        hype.put(id, row(id, null, true, Instant.now()));                                             // dados insuficientes
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id))).isNull();
        HypeScoreCurrent outraVersao = row(id, HypeLevel.VIRAL, true, Instant.now());
        outraVersao.setAlgorithmVersion("HYPE_V1");
        hype.put(id, outraVersao);
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id))).isNull();
        // entre vários cards vale a melhor faixa que conta
        UUID outro = UUID.randomUUID();
        hype.put(id, row(id, HypeLevel.NICHE, true, Instant.now()));
        hype.put(outro, row(outro, HypeLevel.HOT, true, Instant.now()));
        assertThat(gate.best(HypeEntityType.PIECE, List.of(id, outro))).isEqualTo(HypeLevel.HOT);
        assertThat(gate.best(HypeEntityType.PIECE, List.of())).isNull();
    }

    @SuppressWarnings("unchecked")
    private SealService sealsWithHype() {
        SealService seals = kit.build(SealService.class);
        when(kit.dep(PromotionRepository.class).findForRedeem(any()))
                .thenAnswer(inv -> kit.dep(PromotionRepository.class).findById(inv.getArgument(0)));
        HypeQueryService query = mock(HypeQueryService.class);
        when(query.config()).thenReturn(HypeScoreConfig.defaults());
        when(query.currentOf(any(), any())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            ((Collection<UUID>) inv.getArgument(1)).forEach(id -> {
                if (hype.containsKey(id)) {
                    out.put(id, hype.get(id));
                }
            });
            return out;
        });
        ObjectProvider<HypeQueryService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(query);
        when(provider.getObject()).thenReturn(query);
        seals.setHypeQuery(provider);
        return seals;
    }

    private Scheme bond(User dono, User emissor) {
        SealBond vinculo = new SealBond();
        vinculo.setRequestedBy(dono);
        vinculo.setTargetOwner(emissor);
        vinculo.setStatus(SealBondStatus.APPROVED);
        Scheme look = Kit.look(dono, "Look de " + dono.getUsername());
        vinculo.setScheme(look);
        kit.dep(SealBondRepository.class).save(vinculo);
        return look;
    }

    @Test
    void promocaoDeSeloExigeAFaixaNoCardDoVinculoEGuardaAFaixaDaEmissao() {
        SealService seals = sealsWithHype();
        User emissor = marca("loja.alfa");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        Supplier<List<PromotionRedemption>> cupons = () -> MemoryRepository.rows(kit.dep(PromotionRedemptionRepository.class));

        assertThat(refused(() -> seals.createPromotion(Kit.as(emissor), promo("LENDARIO")), 400).code()).isEqualTo("FAIXA_HYPE_INVALIDA");
        Map<String, Object> criada = seals.createPromotion(Kit.as(emissor), promo("hot"));
        assertThat(criada).containsEntry("minHypeLevel", "HOT");
        UUID id = (UUID) criada.get("id");
        UUID look = bond(ana, emissor).getId();

        // sem Hype, abaixo da faixa, privado e desatualizado: 409 e nada é emitido
        Function<HypeScoreCurrent, ApiException> tenta = linha -> {
            if (linha == null) {
                hype.remove(look);
            } else {
                hype.put(look, linha);
            }
            return refused(() -> seals.redeem(Kit.as(ana), id), 409);
        };
        assertThat(tenta.apply(null).code()).isEqualTo("HYPE_INSUFICIENTE");
        ApiException abaixo = tenta.apply(row(look, HypeLevel.RELEVANT, true, Instant.now()));
        assertThat(abaixo.code()).isEqualTo("HYPE_INSUFICIENTE");
        assertThat(abaixo.getMessage()).contains("Em alta", "Relevante");
        assertThat(tenta.apply(row(look, HypeLevel.VIRAL, false, Instant.now())).code()).isEqualTo("HYPE_INSUFICIENTE");
        assertThat(tenta.apply(row(look, HypeLevel.VIRAL, true, Instant.now().minus(30, ChronoUnit.DAYS))).code()).isEqualTo("HYPE_INSUFICIENTE");
        assertThat(cupons.get()).isEmpty();
        assertThat(seals.eligiblePromotions(ana.getId())).isEmpty();
        // a vitrine mostra a oferta travada, com a faixa exigida
        Map<String, Object> travada = seals.promotionsOf(Kit.as(ana), emissor.getId()).get(0);
        assertThat(travada).containsEntry("eligible", false).containsEntry("hypeMet", false).containsEntry("minHypeLevel", "HOT");
        assertThat(String.valueOf(travada.get("unavailableReason"))).startsWith("Travado: falta chegar a Em alta");

        // card público, atualizado e na faixa: emite e grava a faixa
        hype.put(look, row(look, HypeLevel.TRENDING, true, Instant.now()));
        assertThat(seals.eligiblePromotions(ana.getId())).hasSize(1);
        Map<String, Object> cupom = seals.redeem(Kit.as(ana), id);
        assertThat(cupom).containsEntry("hypeLevelSnapshot", "TRENDING");
        assertThat(cupons.get()).hasSize(1);

        // o card cai de faixa (e até fica privado): o cupom emitido continua valendo, com a faixa da emissão
        hype.put(look, row(look, HypeLevel.NICHE, false, Instant.now()));
        assertThat(cupons.get().get(0).getHypeLevelSnapshot()).isEqualTo("TRENDING");
        assertThat(CouponTermsSnapshotWriter.read(new java.util.LinkedHashMap<>(), cupons.get().get(0))).containsEntry("hypeLevelSnapshot", "TRENDING");
    }

    @Test
    void ofertaAntigaSemFaixaSegueComoSempre() {
        SealService seals = sealsWithHype();
        User emissor = marca("loja.beta");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        Map<String, Object> criada = seals.createPromotion(Kit.as(emissor), promo(null));
        assertThat(criada).containsEntry("minHypeLevel", null).containsEntry("hypeMet", true);
        bond(ana, emissor);   // o look do vínculo nem tem Hype calculado

        Map<String, Object> cupom = seals.redeem(Kit.as(ana), (UUID) criada.get("id"));

        assertThat(cupom).containsEntry("hypeLevelSnapshot", null);
    }

    @Test
    void combinacaoFlairExigeUmaCartaNaFaixaEGuardaAFaixaDaEmissao() {
        kit.with(HypeScoreConfig.defaults());
        World world = new World(kit);
        kit.atelier();
        HypeLevel[] faixa = {null};
        boolean[] publico = {true};
        when(kit.dep(HypeScoreCurrentRepository.class).findByEntityTypeAndEntityIdInAndAlgorithmVersion(any(), any(), any())).thenAnswer(inv -> {
            Collection<UUID> ids = inv.getArgument(1);
            return faixa[0] == null ? List.of() : ids.stream().map(id -> row(id, faixa[0], publico[0], Instant.now())).toList();
        });
        FlairService flair = kit.real(FlairService.class);
        CurrentUser loja = Kit.as(marca("loja.gama"));
        CurrentUser ana = Kit.as(world.me);
        Supplier<List<FlairRedemption>> cupons = () -> MemoryRepository.rows(kit.dep(FlairRedemptionRepository.class));

        assertThat(refused(() -> flair.saveCombination(loja, null, combo("LENDARIO")), 400).code()).isEqualTo("FAIXA_HYPE_INVALIDA");
        Map<String, Object> criada = flair.saveCombination(loja, null, combo("HOT"));
        assertThat(((Map<?, ?>) criada.get("coupon")).get("minHypeLevel")).isEqualTo("HOT");
        UUID id = (UUID) criada.get("id");

        // nenhuma carta com Hype que conte; depois abaixo da faixa; depois Hype privado: 409 e nada emitido
        assertThat(refused(() -> flair.redeem(ana, id, null), 409).code()).isEqualTo("HYPE_INSUFICIENTE");
        faixa[0] = HypeLevel.RELEVANT;
        assertThat(refused(() -> flair.redeem(ana, id, null), 409).getMessage()).contains("Em alta", "Relevante");
        faixa[0] = HypeLevel.VIRAL;
        publico[0] = false;
        assertThat(refused(() -> flair.redeem(ana, id, null), 409).code()).isEqualTo("HYPE_INSUFICIENTE");
        assertThat(cupons.get()).isEmpty();
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> checks = (List<Map<String, Object>>) flair.checkCombination(ana, id, null).get("checks");
        assertThat(checks).anySatisfy(c -> assertThat(c).containsEntry("kind", "HYPE").containsEntry("ok", false).containsEntry("required", "HOT"));

        publico[0] = true;
        faixa[0] = HypeLevel.HOT;
        Map<String, Object> cupom = flair.redeem(ana, id, null);
        assertThat(cupom).containsEntry("hypeLevelSnapshot", "HOT");

        faixa[0] = HypeLevel.LOW_SIGNAL;   // a faixa cai depois: o cupom fica
        assertThat(flair.vouchers(ana).get(0)).containsEntry("hypeLevelSnapshot", "HOT");
        assertThat(cupons.get()).hasSize(1);
    }

    @Test
    void combinacaoSemFaixaNaoGanhaRequisitoDeHypeNemRegistro() {
        World world = new World(kit);
        kit.atelier();
        FlairService flair = kit.real(FlairService.class);
        CurrentUser loja = Kit.as(marca("loja.delta"));
        UUID id = (UUID) flair.saveCombination(loja, null, combo(null)).get("id");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> checks = (List<Map<String, Object>>) flair.checkCombination(Kit.as(world.me), id, null).get("checks");
        assertThat(checks).noneSatisfy(c -> assertThat(c).containsEntry("kind", "HYPE"));
        assertThat(flair.redeem(Kit.as(world.me), id, null)).containsEntry("hypeLevelSnapshot", null);
    }
}
