package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.CelebrityProfile;
import br.com.fashionai.domain.model.CouponRight;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.RedemptionStatus;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.CelebrityProfileRepository;
import br.com.fashionai.domain.repository.CouponRightRepository;
import br.com.fashionai.domain.repository.PromotionRedemptionRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Cupons Fashion AI (RF38): o direito nasce quando o look ganha o selo da marca (política de promoção) ou o deck
 * completa uma combinação FLAIR; a pessoa resgata ou dispensa, o cupom vai para a carteira, e a marca vê os emitidos,
 * as promoções e confere o código no caixa.
 */
class CouponServiceTest {
    private Kit kit;
    private World world;
    private FlairService flair;
    private CouponService coupons;
    private CurrentUser ana;
    private User loja;
    private User celeb;
    private Promotion promo;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        flair = kit.real(FlairService.class);
        coupons = kit.build(CouponService.class);
        ana = Kit.as(world.me);
        loja = Kit.user("lojaz");
        loja.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(loja);
        BrandProfile bp = new BrandProfile();
        bp.setOwner(loja);
        bp.setBrandName("Loja Z");
        bp.setSlug("loja-z");
        bp.setStoreUrl("https://lojaz.example.com");
        kit.dep(BrandProfileRepository.class).save(bp);
        celeb = Kit.user("estrela");
        celeb.setProfileType(ProfileType.CELEBRIDADE);
        kit.dep(UserRepository.class).save(celeb);
        CelebrityProfile cp = new CelebrityProfile();
        cp.setOwner(celeb);
        cp.setStageName("Estrela");
        cp.setSlug("estrela");
        kit.dep(CelebrityProfileRepository.class).save(cp);

        promo = new Promotion();
        promo.setOwnerUserId(celeb.getId());
        promo.setTitle("15% no look da Estrela");
        promo.setDescription("Ganhe 15% com o selo");
        promo.setDiscountPercent(15);
        kit.dep(PromotionRepository.class).save(promo);
        SealService seals = kit.dep(SealService.class);
        when(seals.eligiblePromotions(world.me.getId())).thenReturn(List.of(promo));
        when(seals.redeem(any(), eq(promo.getId()))).thenAnswer(i -> {
            PromotionRedemption r = new PromotionRedemption();
            r.setPromotion(promo);
            r.setUser(world.me);
            r.setCode("SEL-ABCD-1234");
            r.setIssuerUserId(celeb.getId());
            r.setPartnerBrandUserId(loja.getId());
            r.setRedeemedAt(Instant.now());
            r.setExpiresAt(Instant.now().plusSeconds(86_400));
            kit.dep(PromotionRedemptionRepository.class).save(r);
            return Map.of("id", r.getId());
        });
        // combinação FLAIR que o Look 6 (com peça inteira) completa
        flair.saveCombination(Kit.as(loja), null, new FlairService.CombinationForm("Peça inteira", null, "COMBINACAO", List.of("full_body_piece"),
                List.of(), List.of(), 0, 0, null, null, "R$ 30 na loja", null, new BigDecimal("30"), new BigDecimal("150"), 30, 10, true, null, null,
                null, "https://lojaz.example.com/flair"));
    }

    private List<CouponRight> rights() {
        return MemoryRepository.rows(kit.dep(CouponRightRepository.class));
    }

    @Test
    void conquistasViramDireitosComNotificacaoUmaVezSo() {
        assertThat(coupons.scan(world.me.getId())).isEqualTo(2);
        assertThat(coupons.scan(world.me.getId())).isZero();
        assertThat(rights()).extracting(CouponRight::getSourceType).containsExactlyInAnyOrder(CouponService.SELO, CouponService.FLAIR);
        assertThat(coupons.scan(UUID.randomUUID())).isZero();
        coupons.onCheck(new DomainEvents.CouponRightsCheck(world.rival.getId()));
        coupons.onScheme(new DomainEvents.SchemeSaved(world.rival.getId(), UUID.randomUUID(), List.of(), "CRIAR_LOOK", true));
        coupons.onPiece(new DomainEvents.PieceCreated(world.rival.getId(), UUID.randomUUID(), true));
        assertThat(rights().stream().filter(r -> r.getUser().getId().equals(world.rival.getId()))).hasSize(1);
    }

    @Test
    void resgatarDispensarECarteira() {
        Map<String, Object> mine = coupons.mine(ana);
        List<?> pending = (List<?>) mine.get("pending");
        assertThat(pending).hasSize(2);
        UUID selo = rights().stream().filter(r -> CouponService.SELO.equals(r.getSourceType())).findFirst().orElseThrow().getId();
        UUID jogo = rights().stream().filter(r -> CouponService.FLAIR.equals(r.getSourceType())).findFirst().orElseThrow().getId();
        Map<String, Object> c = coupons.redeem(ana, selo);
        assertThat(c).containsEntry("code", "SEL-ABCD-1234").containsEntry("status", "EMITIDO");
        assertThat(c.get("storeUrl")).isEqualTo("https://lojaz.example.com");
        assertThatThrownBy(() -> coupons.redeem(ana, selo)).isInstanceOf(ApiException.class);
        assertThat(coupons.dismiss(ana, jogo)).containsEntry("status", "DISPENSADO");
        assertThat(coupons.dismiss(ana, jogo)).containsEntry("status", "DISPENSADO");
        assertThatThrownBy(() -> coupons.redeem(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThat((List<?>) coupons.mine(ana).get("coupons")).hasSize(1);
    }

    @Test
    void resgateFlairEmiteOCupomDaLojaETrocaDiretaFechaOAviso() {
        coupons.scan(world.me.getId());
        UUID jogo = rights().stream().filter(r -> CouponService.FLAIR.equals(r.getSourceType())).findFirst().orElseThrow().getId();
        Map<String, Object> c = coupons.redeem(ana, jogo);
        assertThat(String.valueOf(c.get("code"))).startsWith("FLR-");
        assertThat(String.valueOf(c.get("discount"))).contains("30");
        // promoção já resgatada por fora (limite por pessoa) some dos pendentes
        PromotionRedemption r = new PromotionRedemption();
        r.setPromotion(promo);
        r.setUser(world.me);
        r.setCode("SEL-FORA-0001");
        r.setIssuerUserId(celeb.getId());
        r.setRedeemedAt(Instant.now());
        kit.dep(PromotionRedemptionRepository.class).save(r);
        when(kit.dep(PromotionRedemptionRepository.class).countByPromotionIdAndUserId(promo.getId(), world.me.getId())).thenReturn(1L);
        assertThat((List<?>) coupons.mine(ana).get("pending")).isEmpty();
    }

    @Test
    void painelDaMarcaEConferenciaNoCaixa() {
        coupons.scan(world.me.getId());
        UUID selo = rights().stream().filter(r -> CouponService.SELO.equals(r.getSourceType())).findFirst().orElseThrow().getId();
        UUID jogo = rights().stream().filter(r -> CouponService.FLAIR.equals(r.getSourceType())).findFirst().orElseThrow().getId();
        coupons.redeem(ana, selo);
        String flairCode = String.valueOf(coupons.redeem(ana, jogo).get("code"));

        Map<String, Object> panel = coupons.admin(Kit.as(loja));
        assertThat(map(panel.get("owner"))).containsEntry("name", "Loja Z").containsEntry("slug", "loja-z");
        assertThat((List<?>) panel.get("coupons")).hasSize(2);   // a do selo é de parceria com a loja
        assertThat((List<?>) panel.get("promotions")).hasSize(1);
        Map<String, Object> celebPanel = coupons.admin(Kit.as(celeb));
        assertThat(map(celebPanel.get("owner"))).containsEntry("name", "Estrela");
        assertThat((List<?>) celebPanel.get("promotions")).hasSize(1);

        assertThat(coupons.validate(Kit.as(loja), flairCode.toLowerCase())).containsEntry("status", "USADO");
        assertThat(coupons.validate(Kit.as(celeb), " sel-abcd-1234 ")).containsEntry("status", "USADO");
        assertThatThrownBy(() -> coupons.validate(Kit.as(celeb), "SEL-ABCD-1234")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> coupons.validate(Kit.as(world.rival), "SEL-ABCD-1234")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> coupons.validate(Kit.as(celeb), "NAO-EXISTE")).isInstanceOf(ApiException.class);
        PromotionRedemption expired = MemoryRepository.<PromotionRedemption>rows(kit.dep(PromotionRedemptionRepository.class)).get(0);
        expired.setStatus(RedemptionStatus.ISSUED);
        expired.setExpiresAt(Instant.now().minusSeconds(60));
        assertThatThrownBy(() -> coupons.validate(Kit.as(celeb), "SEL-ABCD-1234")).isInstanceOf(ApiException.class);
        assertThat(String.valueOf(coupons.mine(ana).get("coupons"))).contains("EXPIRADO");
    }

    @Test
    void textoDoDesconto() {
        assertThat(CouponService.discountText(10, null, null)).isEqualTo("10% off");
        assertThat(CouponService.discountText(null, new BigDecimal("25.4"), new BigDecimal("100"))).contains("R$ 25").contains("100");
        assertThat(CouponService.discountText(null, null, null)).isNotBlank();
        assertThat(coupons.storeOf(world.me)).isNull();
        assertThat(coupons.ownerName(world.me)).isEqualTo("Ana");
    }
}
