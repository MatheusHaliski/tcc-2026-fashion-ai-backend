package br.com.fashionai.application.service;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import br.com.fashionai.application.aura.AuraUnlocks;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.aura.AuraUnlocks.State;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Circuito Aura (fase 1) — as ofertas com Hype mínimo vistas da carteira ("travado: falta chegar a ...") e do card
 * ("O que este card destrava"). Só leitura: a oferta travada nunca emite cupom.
 */
class CouponHypeOffersTest {
    private Kit kit;
    private final Map<UUID, HypeScoreCurrent> hype = new HashMap<>();
    private SealService seals;
    private CouponHypeOffers offers;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        kit = new Kit();
        HypeQueryService query = mock(HypeQueryService.class);
        when(query.config()).thenReturn(HypeScoreConfig.defaults());
        when(query.currentOf(any(), any())).thenAnswer(inv -> {
            Map<UUID, HypeScoreCurrent> out = new HashMap<>();
            ((Collection<UUID>) inv.getArgument(1)).stream().filter(hype::containsKey).forEach(id -> out.put(id, hype.get(id)));
            return out;
        });
        ObjectProvider<HypeQueryService> provider = kit.dep(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(query);
        when(provider.getObject()).thenReturn(query);
        seals = kit.build(SealService.class);
        seals.setHypeQuery(provider);
        offers = kit.build(CouponHypeOffers.class);
    }

    private User marca(String username) {
        User u = Kit.user(username);
        u.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(u);
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

    private void promo(User emissor, String faixa) {
        seals.createPromotion(Kit.as(emissor), new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "Cupom " + faixa, null, null, 10,
                null, null, null, null, null, null, null, null, null, null, null, null, faixa));
    }

    private void hypeOf(UUID id, HypeLevel level, boolean publico) {
        HypeScoreCurrent row = CouponHypeTest.row(id, level, publico, Instant.now());
        row.setEntityType(HypeEntityType.SCHEME);
        hype.put(id, row);
    }

    @Test
    void carteiraMostraSoOCupomTravadoPeloHypeComAFaixaAtual() {
        User emissor = marca("loja.zeta");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        promo(emissor, "HOT");
        promo(emissor, null);   // oferta sem exigência nunca aparece como travada
        UUID look = bond(ana, emissor).getId();
        hypeOf(look, HypeLevel.RELEVANT, true);

        List<Map<String, Object>> travados = offers.locked(Kit.as(ana));

        assertThat(travados).hasSize(1);
        assertThat(travados.get(0)).containsEntry("source", "SELO").containsEntry("minHypeLevel", "HOT")
                .containsEntry("hypeCurrentLevel", "RELEVANT").containsEntry("title", "Cupom HOT");
        assertThat(String.valueOf(travados.get(0).get("reason"))).startsWith("Travado: falta chegar a Em alta");
        assertThat(offers.lockedView(Kit.as(ana))).containsKey("items");

        hypeOf(look, HypeLevel.TRENDING, false);   // privado: Hype pessoal não destrava, continua travado e sem faixa
        assertThat(offers.locked(Kit.as(ana)).get(0)).containsEntry("hypeCurrentLevel", null);
        hypeOf(look, HypeLevel.TRENDING, true);    // chegou à faixa: sai da lista de travados
        assertThat(offers.locked(Kit.as(ana))).isEmpty();
    }

    @Test
    void oCardListaOCupomDoEmissorDoSeloComAFaixaExigida() {
        User emissor = marca("loja.eta");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        promo(emissor, "TRENDING");
        UUID look = bond(ana, emissor).getId();

        State relevante = new State(HypeStatus.AVAILABLE, 40.0, HypeLevel.RELEVANT, true, true);
        List<Item> itens = offers.items(Kit.as(ana), HypeEntityType.SCHEME, look, relevante);
        assertThat(itens).singleElement().satisfies(i -> {
            assertThat(i.kind()).isEqualTo(AuraUnlocks.Kind.COUPON);
            assertThat(i.family()).isEqualTo(AuraUnlocks.Family.HYPE);
            assertThat(i.requiredLevel()).isEqualTo(HypeLevel.TRENDING);
            assertThat(i.met()).isFalse();
        });
        State viral = new State(HypeStatus.AVAILABLE, 95.0, HypeLevel.VIRAL, true, true);
        assertThat(offers.items(Kit.as(ana), HypeEntityType.SCHEME, look, viral)).singleElement().satisfies(i -> assertThat(i.met()).isTrue());
        // outro card, sem vínculo com o emissor: nada a destravar
        assertThat(offers.items(Kit.as(ana), HypeEntityType.SCHEME, UUID.randomUUID(), viral)).isEmpty();
    }

    @Test
    void combinacaoFlairSoApareceTravadaQuandoOHypeEOUnicoRequisitoQueFalta() {
        Map<String, Object> hypeCheck = Map.of("kind", "HYPE", "ok", false, "required", "HOT", "value", "NICHE");
        Map<String, Object> soHype = new HashMap<>(Map.of("available", true, "checks", List.of(Map.of("kind", "CATEGORY", "ok", true), hypeCheck)));
        assertThat(CouponHypeOffers.onlyHypeMissing(soHype)).isEqualTo(hypeCheck);
        Map<String, Object> faltaMais = new HashMap<>(Map.of("available", true, "checks", List.of(Map.of("kind", "CATEGORY", "ok", false), hypeCheck)));
        assertThat(CouponHypeOffers.onlyHypeMissing(faltaMais)).isNull();
        Map<String, Object> jaEmitido = new HashMap<>(soHype);
        jaEmitido.put("redemption", Map.of("code", "FLR-1"));
        assertThat(CouponHypeOffers.onlyHypeMissing(jaEmitido)).isNull();
    }
}
