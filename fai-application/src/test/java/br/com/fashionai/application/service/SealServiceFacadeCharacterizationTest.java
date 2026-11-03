package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.BrandProfile;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ApprovalStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionStatus;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondOrigin;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.BrandProfileRepository;
import br.com.fashionai.domain.repository.PromotionRepository;
import br.com.fashionai.domain.repository.SealBondRepository;
import br.com.fashionai.domain.repository.SealRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * R80 — caracterização dos métodos públicos do {@link SealService} que não tinham teste direto (selos padrão, edição do
 * selo, fila de revisão, recusa, revisão, "Meus Selos" e manutenção de promoções). Escrita no código original, antes da
 * divisão do serviço em colaboradores, e mantida sem alteração depois.
 */
class SealServiceFacadeCharacterizationTest {
    private Kit kit;
    private SealService seals;
    private User brand;
    private User ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        seals = kit.build(SealService.class);
        brand = Kit.user("maison");
        brand.setProfileType(ProfileType.MARCA);
        kit.dep(UserRepository.class).save(brand);
        ana = kit.dep(UserRepository.class).save(Kit.user("ana"));
        BrandProfile bp = new BrandProfile();
        bp.setOwner(brand);
        bp.setBrandName("Maison");
        bp.setSlug("maison");
        bp.setApprovalStatus(ApprovalStatus.APROVADO);
        kit.dep(BrandProfileRepository.class).save(bp);
    }

    @Test
    void selosPadraoUmPorTierSoNaPrimeiraVez() {
        seals.ensureDefaultSeals(brand);
        seals.ensureDefaultSeals(brand);
        List<Seal> rows = MemoryRepository.rows(kit.dep(SealRepository.class));
        assertThat(rows).extracting(Seal::getTier).containsExactly(SealTier.PECA, SealTier.LOOK);
        assertThat(rows).allSatisfy(s -> {
            assertThat(s.isAutoIssued()).isTrue();
            assertThat(s.isPremium()).isFalse();
            assertThat(Json.map(s.getBackgroundConfigJson())).containsKey("design");
        });
        assertThat(rows.get(0).getName()).isEqualTo("Selo Maison" + Msg.t("seal.peca"));
        assertThat(rows.get(1).getName()).isEqualTo("Selo Maison · Look");
        assertThat(rows.get(0).getPolicyText()).isEqualTo(Msg.t("seal.concedido_a_looks_com_1"));
        assertThat(seals.sealsOf(brand.getId())).hasSize(2).allSatisfy(v -> assertThat(v)
                .containsEntry("kind", "BRAND_SEAL").containsEntry("grantValidityDays", 365).containsEntry("available", true)
                .containsEntry("hype", hype(null, null, 0)));
        assertThat(seals.sealsOf(Kit.as(ana), brand.getId())).hasSize(2);
    }

    @Test
    void criarSeloSemPoliticaExigeIaEEdicaoManualGeraTextoDaRegra() {
        assertThat(code(() -> seals.createSeal(Kit.as(brand), form(null, null)))).isEqualTo("POLITICA_IA_OBRIGATORIA");
        Map<String, Object> rule = new LinkedHashMap<>(Map.of("quantifier", "AT_LEAST", "count", 1, "color", "Azul"));
        Map<String, Object> manual = new LinkedHashMap<>(Map.of("generationMode", "MANUAL", "rules", List.of(rule)));
        Map<String, Object> created = seals.createSeal(Kit.as(brand), form(manual, 30));
        assertThat(created).containsEntry("name", "Selo azul").containsEntry("tier", SealTier.LOOK)
                .containsEntry("grantValidityDays", 30).containsEntry("status", SealStatus.ACTIVE);
        assertThat(String.valueOf(created.get("policyText"))).isNotBlank();
        Seal stored = MemoryRepository.<Seal>rows(kit.dep(SealRepository.class)).get(0);
        Map<String, Object> updated = seals.updateSeal(Kit.as(brand), stored.getId(), new SealService.SealForm("Selo editado",
                SealTier.LOOK, "texto", null, null, null, null, 5, SealStatus.INACTIVE, null, manual));
        assertThat(updated).containsEntry("name", "Selo editado").containsEntry("usageLimit", 5)
                .containsEntry("grantValidityDays", 30).containsEntry("available", false)
                .containsEntry("unavailableReason", Msg.t("seal.o_selo_esta_inativo"));
        assertThat(code(() -> seals.updateSeal(Kit.as(brand), stored.getId(), new SealService.SealForm("Selo editado",
                SealTier.LOOK, null, null, null, null, null, 0, null, null, manual)))).isEqualTo("LIMITE_INVALIDO");
        assertThat(code(() -> seals.updateSeal(Kit.as(brand), stored.getId(), new SealService.SealForm("Selo editado",
                SealTier.LOOK, null, null, null, null, null, null, null, null, manual, 4000)))).isEqualTo("VALIDADE_INVALIDA");
        assertThat(seals.sealsOf(Kit.as(ana), brand.getId())).as("visitante só vê selos ativos").isEmpty();
    }

    @Test
    void recusaUmaOuTodasAsSugestoesDoLook() {
        Scheme look = Kit.look(ana, "Look");
        SealBond a = bond(look, SealBondStatus.SUGGESTED, null);
        SealBond b = bond(look, SealBondStatus.SUGGESTED, null);
        bond(look, SealBondStatus.APPROVED, null);
        Map<String, Object> refused = seals.refuse(Kit.as(ana), a.getId());
        assertThat(refused).containsEntry("status", SealBondStatus.REFUSED).containsEntry("kind", "BRAND")
                .containsEntry("sealKind", "BRAND_SEAL").containsEntry("schemeId", look.getId());
        assertThat(code(() -> seals.refuse(Kit.as(ana), a.getId()))).isEqualTo("ESTADO_INVALIDO");
        assertThat(seals.refuseAll(Kit.as(ana), look.getId())).isEqualTo(1);
        assertThat(b.getStatus()).isEqualTo(SealBondStatus.REFUSED);
    }

    @Test
    void filaDeRevisaoAprovacaoComEmissaoERejeicaoComMotivo() {
        Seal seal = seal();
        Scheme look = Kit.look(ana, "Look");
        SealBond pending = bond(look, SealBondStatus.PENDING_REVIEW, seal);
        SealBond other = bond(Kit.look(ana, "Outro"), SealBondStatus.PENDING_REVIEW, seal);
        Scheme edited = Kit.look(ana, "Editado");
        edited.setRevalidationPending(true);
        bond(edited, SealBondStatus.APPROVED, seal);
        List<Map<String, Object>> queue = seals.reviewQueue(Kit.as(brand));
        assertThat(queue).hasSize(3);
        assertThat(queue.get(2)).containsEntry("revalidation", true);
        assertThat(queue.get(0).get("scheme")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("title", "Look");

        Map<String, Object> approved = seals.review(Kit.as(brand), pending.getId(), true, null);
        assertThat(approved).containsEntry("status", SealBondStatus.APPROVED);
        assertThat(pending.getSealCode()).startsWith("BRD-");
        assertThat(pending.getExpiresAt()).isEqualTo(pending.getIssuedAt().plus(Duration.ofDays(365)));
        assertThat(seal.getUsageCount()).isEqualTo(1);
        assertThat(Json.strings(look.getSealIdsJson())).containsExactly(pending.getId().toString());

        assertThat(code(() -> seals.review(Kit.as(brand), other.getId(), false, " "))).isEqualTo("MOTIVO_OBRIGATORIO");
        seals.review(Kit.as(brand), other.getId(), false, "fora do estilo");
        assertThat(other.getStatus()).isEqualTo(SealBondStatus.REJECTED);
        assertThat(other.getReviewNote()).isEqualTo("fora do estilo");
        assertThat(code(() -> seals.review(Kit.as(brand), other.getId(), true, null))).isEqualTo("ESTADO_INVALIDO");
    }

    @Test
    void meusSelosAgrupaPorEstado() {
        Seal seal = seal();
        bond(Kit.look(ana, "A"), SealBondStatus.APPROVED, seal);
        SealBond expired = bond(Kit.look(ana, "B"), SealBondStatus.APPROVED, seal);
        expired.setExpiresAt(java.time.Instant.now().minusSeconds(60));
        bond(Kit.look(ana, "C"), SealBondStatus.PENDING_REVIEW, seal);
        bond(Kit.look(ana, "D"), SealBondStatus.REFUSED, null);
        bond(Kit.look(ana, "E"), SealBondStatus.SUGGESTED, null);
        bond(Kit.look(ana, "F"), SealBondStatus.REVOKED, null);
        Map<String, Object> mine = seals.mySeals(Kit.as(ana));
        assertThat(mine.keySet()).containsExactly("ativos", "pendentes", "recusados", "sugeridos", "inativos", "redemptions");
        assertThat(group(mine, "ativos")).singleElement().satisfies(v -> {
            assertThat(v).containsKey("promotions");
            assertThat(v.get("seal")).asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP).containsEntry("hype", hype(null, null, 1));
        });
        assertThat(group(mine, "pendentes")).hasSize(1);
        assertThat(group(mine, "recusados")).hasSize(1);
        assertThat(group(mine, "sugeridos")).hasSize(1);
        assertThat(group(mine, "inativos")).hasSize(2).anySatisfy(v -> assertThat(v).containsEntry("state", "EXPIRADO"));
    }

    @Test
    void manutencaoDePromocoesEPromocaoCriadaPeloAdmin() {
        Map<String, Object> created = seals.createPromotion(Kit.as(brand), promo("Cupom", PromotionType.CUPOM_LOJA));
        java.util.UUID id = (java.util.UUID) created.get("id");
        Map<String, Object> edited = seals.updatePromotion(Kit.as(brand), id, promo("Cupom novo", PromotionType.FRETE_GRATIS));
        assertThat(edited).containsEntry("title", "Cupom novo").containsEntry("type", PromotionType.FRETE_GRATIS);
        assertThat(seals.setPromotionStatus(Kit.as(brand), id, PromotionStatus.REVOKED)).containsEntry("status", PromotionStatus.REVOKED);
        User admin = kit.dep(UserRepository.class).save(Kit.user("root"));
        assertThat(code(() -> seals.createAdminPromotion(Kit.admin(admin), brand.getId(), promo("X", PromotionType.SHOW)))).isEqualTo("CUPOM_INVALIDO");
        assertThat(code(() -> seals.createAdminPromotion(Kit.admin(admin), null, promo("X", PromotionType.CUPOM_LOJA)))).isEqualTo("CUPOM_INVALIDO");
        Map<String, Object> byAdmin = seals.createAdminPromotion(Kit.admin(admin), brand.getId(), promo("Do admin", PromotionType.CUPOM_LOJA));
        assertThat(byAdmin).containsEntry("ownerUserId", brand.getId()).containsEntry("requiredSealKind", "BRAND_SEAL");
        assertThat(MemoryRepository.<Promotion>rows(kit.dep(PromotionRepository.class))).hasSize(2);
    }

    // ------------------------------------------------------------------ apoio

    private static SealService.SealForm form(Map<String, Object> policy, Integer validity) {
        return new SealService.SealForm("Selo azul", SealTier.LOOK, null, null, null, null, null, null, null, null, policy, validity);
    }

    private static SealService.PromotionForm promo(String title, PromotionType type) {
        return new SealService.PromotionForm(type, title, null, null, 10, null, null, null, null, null, null, null, null, null);
    }

    private Seal seal() {
        Seal s = new Seal();
        s.setOwner(brand);
        s.setName("Selo Maison");
        s.setTier(SealTier.LOOK);
        s.setStatus(SealStatus.ACTIVE);
        return kit.dep(SealRepository.class).save(s);
    }

    private SealBond bond(Scheme look, SealBondStatus status, Seal seal) {
        SealBond b = new SealBond();
        b.setScheme(look);
        b.setRequestedBy(ana);
        b.setTargetOwner(brand);
        b.setTier(SealTier.LOOK);
        b.setStatus(status);
        b.setOrigin(SealBondOrigin.AI_SUGGESTION);
        b.setSeal(seal);
        return kit.dep(SealBondRepository.class).save(b);
    }

    private static Map<String, Object> hype(Object avg, Object level, int bonded) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgScore", avg);
        m.put("level", level);
        m.put("bonded", bonded);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> group(Map<String, Object> mine, String key) {
        return (List<Map<String, Object>>) mine.get(key);
    }

    private static String code(org.junit.jupiter.api.function.Executable call) {
        ApiException e = catchThrowableOfType(() -> call.execute(), ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        return e.code();
    }
}
