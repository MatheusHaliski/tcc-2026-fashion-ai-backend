package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.CouponMinimumRules.Minimum;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.FlairCombination;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.FlairCombinationRepository;
import br.com.fashionai.domain.repository.FlairRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Exercício 15 — valor mínimo de compra do cupom: validação forte do valor e da moeda contratada, e a cópia dos dois
 * para o cupom na emissão, nos dois emissores (promoção de selo e combinação FLAIR).
 */
class CouponMinimumTest {
    private Kit kit;

    @BeforeEach
    void setUp() {
        kit = new Kit();
    }

    private static BigDecimal n(String v) {
        return v == null ? null : new BigDecimal(v);
    }

    private static String code(Runnable call) {
        ApiException e = catchThrowableOfType(call::run, ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        assertThat(e.status()).isEqualTo(400);
        return e.code();
    }

    private User marca(String username) {
        User u = Kit.user(username);
        u.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(u);
    }

    private static SealService.PromotionForm promo(String minimo, String moeda) {
        return new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "Cupom da loja", null, null, 10, null, null, null, null, null, null, null, null, null, null,
                n(minimo), moeda, null);
    }

    private static FlairService.CombinationForm combo(String minimo, String moeda) {
        return new FlairService.CombinationForm("Combo de inverno", null, "COLECAO", List.of("full_body_piece"), List.of(), List.of(), 0, 0, null, 0,
                "10% na loja", 10, null, n(minimo), 30, 5, true, null, null, null, null, null, moeda, null);
    }

    @Test
    void zeroECinquentaValemNegativoTresCasasEstouroEMoedaRuimVoltam400() {
        assertThat(CouponMinimumRules.resolve(null, "BRL", null, null)).isEqualTo(new Minimum(null, null));
        assertThat(CouponMinimumRules.resolve(n("0"), "brl", null, null)).isEqualTo(new Minimum(n("0.00"), "BRL"));
        assertThat(CouponMinimumRules.resolve(n("50.00"), "USD", null, null)).isEqualTo(new Minimum(n("50.00"), "USD"));
        assertThat(CouponMinimumRules.resolve(n("50.5"), " EUR ", null, null).amount()).isEqualByComparingTo("50.50");
        assertThat(CouponMinimumRules.resolve(n("50.500"), "BRL", null, null).amount()).isEqualByComparingTo("50.50");   // zeros à direita não são 3 casas
        assertThat(CouponMinimumRules.resolve(n("99999999.99"), "BRL", null, null).amount()).isEqualByComparingTo("99999999.99");
        assertThat(code(() -> CouponMinimumRules.resolve(n("-1"), "BRL", null, null))).isEqualTo("MINIMO_COMPRA_INVALIDO");
        assertThat(code(() -> CouponMinimumRules.resolve(n("10.005"), "BRL", null, null))).isEqualTo("MINIMO_COMPRA_INVALIDO");   // não arredonda
        assertThat(code(() -> CouponMinimumRules.resolve(n("100000000"), "BRL", null, null))).isEqualTo("MINIMO_COMPRA_INVALIDO");
        assertThat(code(() -> CouponMinimumRules.resolve(n("50"), "XYZ", null, null))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        assertThat(code(() -> CouponMinimumRules.resolve(n("50"), "R$", null, null))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        assertThat(code(() -> CouponMinimumRules.resolve(n("50"), null, null, null))).isEqualTo("MOEDA_MINIMO_INVALIDA");
    }

    @Test
    void ofertaAntigaSemMoedaContinuaSemMoedaEnquantoOValorNaoMuda() {
        assertThat(CouponMinimumRules.resolve(n("100"), null, n("100.00"), null)).isEqualTo(new Minimum(n("100.00"), null));
        assertThat(code(() -> CouponMinimumRules.resolve(n("120"), null, n("100.00"), null))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        assertThat(code(() -> CouponMinimumRules.resolve(n("100"), "", n("100.00"), "BRL"))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        assertThat(CouponMinimumRules.inBrl(n("100"), null)).isEqualByComparingTo("100");
        assertThat(CouponMinimumRules.inBrl(n("100"), "BRL")).isEqualByComparingTo("100");
        assertThat(CouponMinimumRules.inBrl(n("100"), "USD")).isNull();
    }

    @Test
    void promocaoDeSeloGuardaMinimoEMoedaEOCupomConservaACondicaoDaEmissao() {
        SealService seals = kit.build(SealService.class);
        when(kit.dep(PromotionRepository.class).findForRedeem(any()))
                .thenAnswer(inv -> kit.dep(PromotionRepository.class).findById(inv.getArgument(0)));
        User emissor = marca("loja.alfa");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        User bia = kit.dep(UserRepository.class).save(Kit.user("bia"));

        assertThat(code(() -> seals.createPromotion(Kit.as(emissor), promo("-1", "BRL")))).isEqualTo("MINIMO_COMPRA_INVALIDO");
        assertThat(code(() -> seals.createPromotion(Kit.as(emissor), promo("50", null)))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        Map<String, Object> criada = seals.createPromotion(Kit.as(emissor), promo("50.00", "USD"));
        assertThat((BigDecimal) criada.get("minPurchase")).isEqualByComparingTo("50.00");
        assertThat(criada).containsEntry("minPurchaseCurrency", "USD");
        UUID id = (UUID) criada.get("id");

        for (User u : List.of(ana, bia)) {
            SealBond vinculo = new SealBond();
            vinculo.setRequestedBy(u);
            vinculo.setTargetOwner(emissor);
            vinculo.setStatus(SealBondStatus.APPROVED);
            vinculo.setScheme(Kit.look(u, "Look"));
            kit.dep(SealBondRepository.class).save(vinculo);
        }
        Map<String, Object> cupom = seals.redeem(Kit.as(ana), id);
        assertThat((BigDecimal) cupom.get("minPurchaseSnapshot")).isEqualByComparingTo("50.00");
        assertThat(cupom).containsEntry("minPurchaseCurrencySnapshot", "USD").containsEntry("minPurchaseSnapshotStatus", "REGISTRADO");

        // a oferta muda depois da emissão: o cupom da Ana continua com 50,00 USD; o da Bia sai com a regra nova
        seals.updatePromotion(Kit.as(emissor), id, promo("80", "BRL"));
        PromotionRedemption daAna = MemoryRepository.<PromotionRedemption>rows(kit.dep(PromotionRedemptionRepository.class)).get(0);
        assertThat(daAna.getMinPurchaseSnapshot()).isEqualByComparingTo("50.00");
        assertThat(daAna.getMinPurchaseCurrencySnapshot()).isEqualTo("USD");
        Map<String, Object> daBia = seals.redeem(Kit.as(bia), id);
        assertThat((BigDecimal) daBia.get("minPurchaseSnapshot")).isEqualByComparingTo("80.00");
        assertThat(daBia).containsEntry("minPurchaseCurrencySnapshot", "BRL");

        // cupom antigo (sem snapshot) de uma oferta que hoje tem mínimo: condição da emissão não registrada
        daAna.setMinPurchaseSnapshot(null);
        daAna.setMinPurchaseCurrencySnapshot(null);
        assertThat(CouponTermsSnapshotWriter.read(new java.util.LinkedHashMap<>(), daAna))
                .containsEntry("minPurchaseSnapshot", null).containsEntry("minPurchaseSnapshotStatus", "NAO_REGISTRADO");
        // oferta sem mínimo: nulo continua nulo (não vira zero) e o cupom fica SEM_MINIMO
        seals.updatePromotion(Kit.as(emissor), id, promo(null, null));
        assertThat(CouponTermsSnapshotWriter.read(new java.util.LinkedHashMap<>(), daAna)).containsEntry("minPurchaseSnapshotStatus", "SEM_MINIMO");
    }

    @Test
    void combinacaoFlairValidaOMinimoEOCupomConservaACondicaoDaEmissao() {
        World world = new World(kit);
        kit.atelier();
        FlairService flair = kit.real(FlairService.class);
        CurrentUser loja = Kit.as(marca("loja.gama"));
        CurrentUser ana = Kit.as(world.me);

        assertThat(code(() -> flair.saveCombination(loja, null, combo("10.005", "BRL")))).isEqualTo("MINIMO_COMPRA_INVALIDO");
        assertThat(code(() -> flair.saveCombination(loja, null, combo("-0.01", "BRL")))).isEqualTo("MINIMO_COMPRA_INVALIDO");
        assertThat(code(() -> flair.saveCombination(loja, null, combo("50", "XYZ")))).isEqualTo("MOEDA_MINIMO_INVALIDA");
        assertThat(MemoryRepository.rows(kit.dep(FlairCombinationRepository.class))).isEmpty();
        Map<String, Object> zero = flair.saveCombination(loja, null, combo("0", "BRL"));
        assertThat((BigDecimal) ((Map<?, ?>) zero.get("coupon")).get("minPurchase")).isEqualByComparingTo("0");   // zero é mínimo declarado
        Map<String, Object> semMinimo = flair.saveCombination(loja, null, combo(null, null));
        assertThat(((Map<?, ?>) semMinimo.get("coupon")).get("minPurchase")).isEqualTo("");                       // nulo não vira zero

        Map<String, Object> criada = flair.saveCombination(loja, null, combo("50.00", "EUR"));
        assertThat(((Map<?, ?>) criada.get("coupon")).get("minPurchaseCurrency")).isEqualTo("EUR");
        UUID id = (UUID) criada.get("id");
        Map<String, Object> cupom = flair.redeem(ana, id, null);
        assertThat((BigDecimal) cupom.get("minPurchaseSnapshot")).isEqualByComparingTo("50.00");
        assertThat(cupom).containsEntry("minPurchaseCurrencySnapshot", "EUR");

        flair.saveCombination(loja, id, combo("200", "BRL"));
        Map<String, Object> naCarteira = flair.vouchers(ana).get(0);
        assertThat((BigDecimal) naCarteira.get("minPurchaseSnapshot")).isEqualByComparingTo("50.00");
        assertThat(naCarteira).containsEntry("minPurchaseCurrencySnapshot", "EUR").containsEntry("minPurchaseSnapshotStatus", "REGISTRADO");
        // o resumo da combinação dentro do cupom também é o da emissão, não o atual (200)
        assertThat((BigDecimal) ((Map<?, ?>) naCarteira.get("combination")).get("minPurchase")).isEqualByComparingTo("50.00");

        // combinação antiga, gravada sem moeda: reenviar o mesmo valor sem moeda é aceito e a moeda segue não confirmada
        FlairCombination antiga = kit.dep(FlairCombinationRepository.class).findById(id).orElseThrow();
        antiga.setMinPurchaseCurrency(null);
        flair.saveCombination(loja, id, combo("200.00", null));
        assertThat(antiga.getMinPurchaseCurrency()).isNull();
        assertThat(MemoryRepository.<FlairRedemption>rows(kit.dep(FlairRedemptionRepository.class))).hasSize(1);
    }
}
