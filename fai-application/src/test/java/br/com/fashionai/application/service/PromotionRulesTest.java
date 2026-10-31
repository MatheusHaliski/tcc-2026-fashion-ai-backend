package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/** Regras puras de {@link PromotionRules} com relógio fixo (sem {@code Instant.now()}). */
class PromotionRulesTest {
    private static final Instant NOW = Instant.parse("2026-10-31T23:59:59Z");
    private static final Duration SECOND = Duration.ofSeconds(1);

    @Test
    void tiposDeMarcaECelebridade() {
        assertThat(code(() -> PromotionRules.requireType(null))).isEqualTo("TIPO_OBRIGATORIO");
        for (PromotionType t : PromotionType.values()) {
            assertThatCode(() -> PromotionRules.requireTypeFor(t, true)).doesNotThrowAnyException();
        }
        EnumSet<PromotionType> celebOnly = EnumSet.complementOf(EnumSet.copyOf(PromotionRules.BRAND_TYPES));
        assertThat(celebOnly).containsExactlyInAnyOrder(PromotionType.SHOW, PromotionType.MEET_GREET, PromotionType.PRE_VENDA,
                PromotionType.CONTEUDO_EXCLUSIVO);
        celebOnly.forEach(t -> assertThat(code(() -> PromotionRules.requireTypeFor(t, false))).isEqualTo("TIPO_INVALIDO"));
        assertThat(PromotionRules.requiredSealKind(true)).isEqualTo("PREMIUM_SEAL");
        assertThat(PromotionRules.requiredSealKind(false)).isEqualTo("BRAND_SEAL");
    }

    @Test
    void descontoPeriodoELimite() {
        assertThat(PromotionRules.discountPercent(null)).isNull();
        assertThat(PromotionRules.discountPercent(1)).isEqualTo(1);
        assertThat(PromotionRules.discountPercent(90)).isEqualTo(90);
        assertThat(code(() -> PromotionRules.discountPercent(0))).isEqualTo("DESCONTO_INVALIDO");
        assertThat(code(() -> PromotionRules.discountPercent(91))).isEqualTo("DESCONTO_INVALIDO");
        assertThatCode(() -> PromotionRules.requirePeriod(NOW, NOW)).doesNotThrowAnyException();
        assertThatCode(() -> PromotionRules.requirePeriod(null, NOW)).doesNotThrowAnyException();
        assertThatCode(() -> PromotionRules.requirePeriod(NOW, null)).doesNotThrowAnyException();
        assertThat(code(() -> PromotionRules.requirePeriod(NOW, NOW.minus(SECOND)))).isEqualTo("PERIODO_INVALIDO");
        assertThat(PromotionRules.perUserLimit(null)).isEqualTo(1);
        assertThat(PromotionRules.perUserLimit(-3)).isEqualTo(1);
        assertThat(PromotionRules.perUserLimit(4)).isEqualTo(4);
    }

    @Test
    void linksDeLoja() {
        assertThat(PromotionRules.httpsOnly(" https://loja.com.br/p ")).isEqualTo("https://loja.com.br/p");
        assertThat(PromotionRules.httpsOnly("data:text/html,x")).isNull();
        assertThat(PromotionRules.httpsOnly("https://semponto")).isNull();
        assertThat(PromotionRules.storeUrl("")).isNull();
        assertThat(code(() -> PromotionRules.storeUrl("http://loja.com"))).isEqualTo("LINK_INVALIDO");
    }

    @Test
    void janelaDaPromocaoNoFusoUtcComLimitesExatos() {
        Promotion p = new Promotion();
        p.setStartsAt(NOW);
        p.setExpiresAt(NOW.plus(SECOND));
        assertThat(PromotionRules.unavailable(p, NOW)).isNull();                                  // começa exatamente agora
        assertThat(PromotionRules.unavailable(p, NOW.minus(SECOND))).isEqualTo(Msg.t("seal.a_promocao_comeca_em", NOW));
        assertThat(PromotionRules.unavailable(p, NOW.plus(SECOND))).isEqualTo(Msg.t("seal.promocao_expirada"));   // fim exclusivo
        p.setTotalQuota(1);
        p.setRedeemedCount(1);
        assertThat(PromotionRules.unavailable(p, NOW)).isEqualTo(Msg.t("seal.promocao_esgotada"));   // estoque 1 já usado
        p.setTotalQuota(null);
        Seal s = seal(SealStatus.INACTIVE);
        p.setSeal(s);
        assertThat(PromotionRules.unavailable(p, NOW)).isEqualTo(Msg.t("seal.o_selo_desta_promocao_esta"));
        p.setStatus(PromotionStatus.REDEEMED);
        assertThat(PromotionRules.unavailable(p, NOW)).isEqualTo(Msg.t("seal.promocao_2", Msg.t("seal.indisponivel")));
    }

    @Test
    void vinculoElegivelAprovadoValidoEDoSeloExigido() {
        Seal exigido = seal(SealStatus.ACTIVE);
        Promotion p = new Promotion();
        SealBond sugerido = bond(SealBondStatus.SUGGESTED, null, null, null);
        SealBond vencido = bond(SealBondStatus.APPROVED, null, NOW, null);                         // expira agora: inválido
        SealBond outroSelo = bond(SealBondStatus.APPROVED, seal(SealStatus.ACTIVE), null, null);
        SealBond certo = bond(SealBondStatus.APPROVED, exigido, NOW.plus(SECOND), null);
        assertThat(PromotionRules.eligibleBond(p, List.of(sugerido, vencido, outroSelo, certo), NOW)).isSameAs(outroSelo);
        p.setSeal(exigido);
        assertThat(PromotionRules.eligibleBond(p, List.of(sugerido, vencido, outroSelo, certo), NOW)).isSameAs(certo);
        assertThat(PromotionRules.eligibleBond(p, List.of(certo), NOW.plus(SECOND))).isNull();
        assertThat(PromotionRules.eligibleBond(p, List.of(), NOW)).isNull();
    }

    @Test
    void consentimentoDaParceira() {
        User marca = new User();
        marca.assignId(UUID.randomUUID());
        assertThat(PromotionRules.partnerBondValid(List.of(bond(SealBondStatus.APPROVED, null, NOW, marca)), marca.getId(), NOW)).isFalse();
        assertThat(PromotionRules.partnerBondValid(List.of(bond(SealBondStatus.APPROVED, null, null, marca)), marca.getId(), NOW)).isTrue();
        assertThat(PromotionRules.partnerBondValid(List.of(bond(SealBondStatus.APPROVED, null, null, marca)), UUID.randomUUID(), NOW)).isFalse();
    }

    @Test
    void prefixoDoCodigo() {
        assertThat(PromotionRules.codePrefix("maison", null)).isEqualTo("MAISO");
        assertThat(PromotionRules.codePrefix("a.b", null)).isEqualTo("AB");
        assertThat(PromotionRules.codePrefix("estrela", "loja.zeta")).isEqualTo("ESTREXLOJA");
        assertThat(PromotionRules.codePrefix("estrela", "PARC")).isEqualTo("ESTREXPARC");
        assertThat(PromotionRules.codePrefix("__", "z")).isEqualTo("XZ");
    }

    private static String code(Executable call) {
        ApiException e = catchThrowableOfType(() -> call.execute(), ApiException.class);
        assertThat(e).isNotNull();
        return e.code();
    }

    private static Seal seal(SealStatus status) {
        Seal s = new Seal();
        s.assignId(UUID.randomUUID());
        s.setStatus(status);
        return s;
    }

    private static SealBond bond(SealBondStatus status, Seal seal, Instant expiresAt, User target) {
        SealBond b = new SealBond();
        b.setStatus(status);
        b.setSeal(seal);
        b.setExpiresAt(expiresAt);
        b.setTargetOwner(target);
        return b;
    }
}
