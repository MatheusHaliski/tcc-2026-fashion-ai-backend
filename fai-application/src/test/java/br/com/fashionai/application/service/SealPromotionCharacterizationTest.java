package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Caracterização das promoções de selo (RF20.CA11–CA13 / RF21.CA21–CA23 / RNF12) pelo {@link SealService} real:
 * validação do formulário (códigos e ordem), motivos de indisponibilidade, elegibilidade por vínculo aprovado, link
 * https da loja e resgate com prefixo do código, limite por pessoa e esgotamento da cota. Escrita antes da extração de
 * {@code PromotionRules} e mantida depois, sem alteração, como regressão.
 */
class SealPromotionCharacterizationTest {
    private static final Duration DAY = Duration.ofDays(1);
    private Kit kit;
    private SealService seals;
    private User brand;
    private User celeb;
    private User partner;
    private User ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        seals = kit.build(SealService.class);
        brand = save(institutional("maison", ProfileType.MARCA));
        celeb = save(institutional("estrela", ProfileType.CELEBRIDADE));
        partner = save(institutional("loja.zeta", ProfileType.MARCA));
        ana = save(Kit.user("ana"));
        when(kit.dep(PromotionRepository.class).findForRedeem(any()))
                .thenAnswer(inv -> kit.dep(PromotionRepository.class).findById(inv.getArgument(0)));
    }

    // ------------------------------------------------------------------ formulário

    @Test
    void formularioRecusaComOsMesmosCodigosENaMesmaOrdem() {
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(null, 10, null, null, null, null)))).isEqualTo("TIPO_OBRIGATORIO");
        // marca não usa tipo exclusivo de celebridade; o tipo é checado antes do desconto
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.SHOW, 95, null, null, null, null)))).isEqualTo("TIPO_INVALIDO");
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.CUPOM_LOJA, 0, null, null, null, null)))).isEqualTo("DESCONTO_INVALIDO");
        Instant now = Instant.now();
        // desconto antes do período
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.CUPOM_LOJA, 91, now, now.minus(DAY), null, null)))).isEqualTo("DESCONTO_INVALIDO");
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.CUPOM_LOJA, 90, now, now.minus(DAY), null, null)))).isEqualTo("PERIODO_INVALIDO");
        // período antes da parceira, parceira antes do link
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.CUPOM_LOJA, 1, null, null, partner.getId(), "http://x.com")))).isEqualTo("PARCEIRA_INVALIDA");
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), form(PromotionType.CUPOM_LOJA, 1, null, null, null, "http://x.com")))).isEqualTo("LINK_INVALIDO");
        assertThat(code(() -> seals.createPromotion(Kit.as(celeb), form(PromotionType.SHOW, null, null, null, brand.getId(), null)))).isEqualTo("PARCERIA_NAO_AUTORIZADA");
        assertThat(code(() -> seals.createPromotion(Kit.as(celeb), form(PromotionType.SHOW, null, null, null, ana.getId(), null)))).isEqualTo("PARCEIRA_INVALIDA");
        assertThat(promotions()).isEmpty();
    }

    @Test
    void formularioValidoNormalizaLimiteSeloExigidoVisibilidadeELink() {
        Instant now = Instant.now();
        Map<String, Object> b = seals.createPromotion(Kit.as(brand), new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "  Cupom  ", null, null, 1,
                null, null, now, now, null, 0, null, null, "  https://loja.example.com/x  "));
        assertThat(b).containsEntry("requiredSealKind", "BRAND_SEAL").containsEntry("perUserLimit", 1)
                .containsEntry("storeUrl", "https://loja.example.com/x").containsEntry("discountPercent", 1);
        assertThat(promotions().get(0).getVisibility()).isEqualTo(Visibility.PUBLIC);
        Map<String, Object> c = seals.createPromotion(Kit.as(celeb), new SealService.PromotionForm(PromotionType.MEET_GREET, "Encontro", null, null, 90,
                null, null, null, null, 5, 3, null, Visibility.FOLLOWERS, null));
        assertThat(c).containsEntry("requiredSealKind", "PREMIUM_SEAL").containsEntry("perUserLimit", 3).containsEntry("remaining", 5)
                .containsEntry("storeUrl", null).containsEntry("eligible", false)
                .containsEntry("unavailableReason", Msg.t("seal.e_preciso_ter_um_selo"));
    }

    @Test
    void parceiraAceitaQuandoAprovouVinculoValidoDaCelebridade() {
        bond(celeb, partner, SealBondStatus.APPROVED, null, Instant.now().minus(DAY));
        assertThat(code(() -> seals.createPromotion(Kit.as(celeb), form(PromotionType.SHOW, null, null, null, partner.getId(), null)))).isEqualTo("PARCERIA_NAO_AUTORIZADA");
        bond(celeb, partner, SealBondStatus.APPROVED, null, null);
        Map<String, Object> v = seals.createPromotion(Kit.as(celeb), form(PromotionType.SHOW, null, null, null, partner.getId(), null));
        assertThat(v).containsEntry("partnerBrandUserId", partner.getId());
    }

    @Test
    void seloDaPromocaoPrecisaEstarAtivo() {
        Seal s = seal(brand, SealStatus.INACTIVE);
        assertThat(code(() -> seals.createPromotion(Kit.as(brand), new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "Cupom", null, null, 10,
                s.getId(), null, null, null, null, null, null, null, null)))).isEqualTo("SELO_INATIVO");
    }

    // ------------------------------------------------------------------ links

    @Test
    void linkDaLojaSoHttpsComHost() {
        assertThat(SealService.httpsOnly(null)).isNull();
        assertThat(SealService.httpsOnly(" https://loja.example.com/a?b=1 ")).isEqualTo("https://loja.example.com/a?b=1");
        assertThat(SealService.httpsOnly("HTTPS://Loja.Example.com")).isEqualTo("HTTPS://Loja.Example.com");
        assertThat(SealService.httpsOnly("http://loja.example.com")).isNull();
        assertThat(SealService.httpsOnly("https://localhost/x")).isNull();
        assertThat(SealService.httpsOnly("javascript:alert(1)")).isNull();
        assertThat(SealService.httpsOnly("https://a.com/" + "x".repeat(501))).isNull();
        assertThat(SealService.httpsOnly("https://a.com/x y")).isNull();
        assertThat(SealService.storeUrl(null)).isNull();
        assertThat(SealService.storeUrl("   ")).isNull();
        assertThat(SealService.storeUrl(" https://a.com ")).isEqualTo("https://a.com");
        assertThat(code(() -> SealService.storeUrl("ftp://a.com"))).isEqualTo("LINK_INVALIDO");
    }

    // ------------------------------------------------------------------ disponibilidade

    @Test
    void motivosDeIndisponibilidadeNaOrdem() {
        Instant now = Instant.now();
        Promotion p = promotion(brand, null);
        assertThat(SealService.unavailable(p, now)).isNull();
        p.setExpiresAt(now);                                             // termina exatamente agora: expirada
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.promocao_expirada"));
        p.setStartsAt(now.plusSeconds(1));                               // ainda não começou vem antes de expirada
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.a_promocao_comeca_em", now.plusSeconds(1)));
        p.setStartsAt(now);
        p.setExpiresAt(now.plusSeconds(1));
        assertThat(SealService.unavailable(p, now)).isNull();
        p.setTotalQuota(2);
        p.setRedeemedCount(2);
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.promocao_esgotada"));
        p.setTotalQuota(3);
        p.setSeal(seal(brand, SealStatus.INACTIVE));
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.o_selo_desta_promocao_esta"));
        p.setStatus(PromotionStatus.EXPIRED);
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.promocao_2", "expirada"));
        p.setStatus(PromotionStatus.REVOKED);
        assertThat(SealService.unavailable(p, now)).isEqualTo(Msg.t("seal.promocao_2", Msg.t("seal.indisponivel")));
    }

    @Test
    void elegiveisExigemVinculoAprovadoValidoDoMesmoSeloEEmissorAtivo() {
        Seal s = seal(brand, SealStatus.ACTIVE);
        Promotion livre = promotion(brand, null);
        Promotion doSelo = promotion(brand, s);
        Promotion daCeleb = promotion(celeb, null);
        bond(ana, brand, SealBondStatus.APPROVED, seal(brand, SealStatus.ACTIVE), null);   // outro selo da marca
        bond(ana, celeb, SealBondStatus.APPROVED, null, Instant.now().minus(DAY));           // vínculo vencido
        assertThat(seals.eligiblePromotions(ana.getId())).containsExactly(livre);
        bond(ana, brand, SealBondStatus.APPROVED, s, Instant.now().plus(DAY));
        assertThat(seals.eligiblePromotions(ana.getId())).containsExactlyInAnyOrder(livre, doSelo);
        bond(ana, celeb, SealBondStatus.APPROVED, null, null);
        brand.setStatus(AccountStatus.SUSPENDED);
        assertThat(seals.eligiblePromotions(ana.getId())).containsExactly(daCeleb);
    }

    // ------------------------------------------------------------------ resgate

    @Test
    void resgateSemVinculoOuComSeloRevogado() {
        Promotion p = promotion(brand, null);
        ApiException none = catchThrowableOfType(() -> seals.redeem(Kit.as(ana), p.getId()), ApiException.class);
        assertThat(none.code()).isEqualTo("SELO_INVALIDO");
        assertThat(none.getMessage()).isEqualTo(Msg.t("seal.e_preciso_ter_um_selo"));
        bond(ana, brand, SealBondStatus.REVOKED, null, null);
        ApiException revoked = catchThrowableOfType(() -> seals.redeem(Kit.as(ana), p.getId()), ApiException.class);
        assertThat(revoked.getMessage()).isEqualTo(Msg.t("seal.seu_selo_deste_perfil_foi"));
        brand.setStatus(AccountStatus.SUSPENDED);
        assertThat(code(() -> seals.redeem(Kit.as(ana), p.getId()))).isEqualTo("PROMOCAO_INDISPONIVEL");
    }

    @Test
    void resgateGeraCodigoComPrefixoLimitaPorPessoaEEsgotaACota() {
        Promotion p = promotion(celeb, null);
        p.setPartnerBrandUserId(partner.getId());
        p.setTotalQuota(2);
        p.setExpiresAt(Instant.now().plus(DAY));
        bond(ana, celeb, SealBondStatus.APPROVED, null, null);
        Map<String, Object> r = seals.redeem(Kit.as(ana), p.getId());
        assertThat(String.valueOf(r.get("code"))).matches("ESTREXLOJA-[A-HJ-NP-Z2-9]{8}");
        assertThat(r).containsEntry("issuerUserId", celeb.getId()).containsEntry("partnerBrandUserId", partner.getId())
                .containsEntry("expiresAt", p.getExpiresAt());
        assertThat(p.getRedeemedCount()).isEqualTo(1);
        assertThat(code(() -> seals.redeem(Kit.as(ana), p.getId()))).isEqualTo("LIMITE_POR_USUARIO");

        User bia = save(Kit.user("bia"));
        bond(bia, celeb, SealBondStatus.APPROVED, null, null);
        seals.redeem(Kit.as(bia), p.getId());
        assertThat(p.getStatus()).isEqualTo(PromotionStatus.REDEEMED);
        assertThat(MemoryRepository.<PromotionRedemption>rows(kit.dep(PromotionRedemptionRepository.class))).hasSize(2);
        User caio = save(Kit.user("caio"));
        bond(caio, celeb, SealBondStatus.APPROVED, null, null);
        assertThat(code(() -> seals.redeem(Kit.as(caio), p.getId()))).isEqualTo("PROMOCAO_INDISPONIVEL");
    }

    @Test
    void resgateSemParceiraUsaCincoLetrasDoEmissor() {
        Promotion p = promotion(brand, null);
        bond(ana, brand, SealBondStatus.APPROVED, null, null);
        assertThat(String.valueOf(seals.redeem(Kit.as(ana), p.getId()).get("code"))).matches("MAISO-[A-HJ-NP-Z2-9]{8}");
    }

    @Test
    void vitrineDoPerfilMostraElegibilidadeDoVisitante() {
        Promotion p = promotion(brand, null);
        Promotion pausada = promotion(brand, null);
        pausada.setStatus(PromotionStatus.REVOKED);
        CurrentUser viewer = Kit.as(ana);
        assertThat(seals.promotionsOf(viewer, brand.getId())).singleElement().satisfies(v -> assertThat(v)
                .containsEntry("id", p.getId()).containsEntry("eligible", false).containsEntry("eligibleBondId", null));
        SealBond b = bond(ana, brand, SealBondStatus.APPROVED, null, null);
        assertThat(seals.promotionsOf(viewer, brand.getId())).singleElement().satisfies(v -> assertThat(v)
                .containsEntry("eligible", true).containsEntry("unavailableReason", null).containsEntry("eligibleBondId", b.getId()));
        assertThat(seals.promotionsOf(Kit.as(brand), brand.getId())).hasSize(2);
        brand.setStatus(AccountStatus.SUSPENDED);
        assertThat(seals.promotionsOf(viewer, brand.getId())).isEmpty();
    }

    // ------------------------------------------------------------------ apoio

    private static String code(Executable call) {
        ApiException e = catchThrowableOfType(() -> call.execute(), ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        return e.code();
    }

    private static SealService.PromotionForm form(PromotionType type, Integer pct, Instant starts, Instant ends, UUID partnerId, String store) {
        return new SealService.PromotionForm(type, "Promo", "desc", "regras", pct, null, null, starts, ends, null, null, partnerId, null, store);
    }

    private static User institutional(String username, ProfileType type) {
        User u = Kit.user(username);
        u.setProfileType(type);
        return u;
    }

    private User save(User u) {
        return kit.dep(UserRepository.class).save(u);
    }

    private List<Promotion> promotions() {
        return MemoryRepository.rows(kit.dep(PromotionRepository.class));
    }

    private Promotion promotion(User owner, Seal seal) {
        Promotion p = new Promotion();
        p.setOwnerUserId(owner.getId());
        p.setType(PromotionType.CUPOM_LOJA);
        p.setTitle("Promo " + owner.getUsername());
        p.setSeal(seal);
        return kit.dep(PromotionRepository.class).save(p);
    }

    private Seal seal(User owner, SealStatus status) {
        Seal s = new Seal();
        s.setOwner(owner);
        s.setName("Selo " + owner.getUsername());
        s.setStatus(status);
        return kit.dep(SealRepository.class).save(s);
    }

    private SealBond bond(User requester, User target, SealBondStatus status, Seal seal, Instant expiresAt) {
        SealBond b = new SealBond();
        b.setRequestedBy(requester);
        b.setTargetOwner(target);
        b.setStatus(status);
        b.setSeal(seal);
        b.setExpiresAt(expiresAt);
        b.setScheme(Kit.look(requester, "Look"));            // o vínculo exige um alvo (look) para persistir
        return kit.dep(SealBondRepository.class).save(b);
    }
}
