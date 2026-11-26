package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.CanalCupom;
import br.com.fashionai.domain.model.FlairRedemption;
import br.com.fashionai.domain.model.Promotion;
import br.com.fashionai.domain.model.PromotionRedemption;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.PromotionType;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.repository.CanalCupomRepository;
import br.com.fashionai.domain.repository.CouponRightRepository;
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
 * Exercício 14 — canal de utilização do cupom nos dois emissores (promoção de selo e combinação FLAIR): a oferta guarda
 * o canal escolhido, o cupom emitido guarda o canal da hora da emissão, e o direito de resgate (CouponRight) não entra.
 */
class CouponChannelTest {
    private Kit kit;
    private CanalCupom loja;
    private CanalCupom ecommerce;
    private CanalCupom desativado;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        loja = canal("LOJA_FISICA", "Loja física", true);
        ecommerce = canal("ECOMMERCE", "E-commerce", true);
        desativado = canal("AMBOS", "Ambos", false);
    }

    private CanalCupom canal(String codigo, String nome, boolean ativo) {
        CanalCupom c = new CanalCupom();
        c.setCodigo(codigo);
        c.setNome(nome);
        c.setAtivo(ativo);
        return kit.dep(CanalCupomRepository.class).save(c);
    }

    private User marca(String username) {
        User u = Kit.user(username);
        u.setProfileType(ProfileType.MARCA);
        return kit.dep(UserRepository.class).save(u);
    }

    private static String code(Runnable call) {
        ApiException e = catchThrowableOfType(call::run, ApiException.class);
        assertThat(e).as("deveria recusar com ApiException").isNotNull();
        assertThat(e.status()).isEqualTo(400);
        return e.code();
    }

    private static SealService.PromotionForm promo(UUID canalCupomId) {
        return new SealService.PromotionForm(PromotionType.CUPOM_LOJA, "Cupom da loja", null, null, 10, null, null, null, null, null, null, null, null, null, canalCupomId, null, null);
    }

    private static FlairService.CombinationForm combo(UUID canalCupomId) {
        return new FlairService.CombinationForm("Combo de inverno", null, "COLECAO", List.of("full_body_piece"), List.of(), List.of(), 0, 0, null, 0,
                "10% na loja", 10, null, new BigDecimal("100"), 30, 5, true, null, null, null, null, canalCupomId, "BRL");
    }

    @Test
    void semIdFicaSemCanalIdDesconhecidoOuInativoVolta400EOInativoJaSalvoContinuaAceito() {
        CouponChannelResolver resolver = new CouponChannelResolver(kit.dep(CanalCupomRepository.class));
        assertThat(resolver.resolve(null, loja)).isNull();
        assertThat(resolver.resolve(loja.getId(), null)).isSameAs(loja);
        assertThat(code(() -> resolver.resolve(UUID.randomUUID(), null))).isEqualTo("CANAL_CUPOM_INVALIDO");
        assertThat(code(() -> resolver.resolve(desativado.getId(), loja))).isEqualTo("CANAL_CUPOM_INATIVO");
        assertThat(resolver.resolve(desativado.getId(), desativado)).isSameAs(desativado);
        assertThat(CouponChannelResolver.view(ecommerce)).extracting("codigo", "nome").containsExactly("ECOMMERCE", "E-commerce");
        assertThat(CouponChannelResolver.view(null)).isNull();
        assertThat(code(() -> CouponChannelResolver.resolve(null, loja.getId(), null))).isEqualTo("CANAL_CUPOM_INVALIDO");
    }

    @Test
    void promocaoDeSeloGuardaOCanalEOCupomEmitidoConservaOCanalDaEmissao() {
        SealService seals = kit.build(SealService.class);
        seals.setCouponChannels(kit.dep(CanalCupomRepository.class));
        when(kit.dep(PromotionRepository.class).findForRedeem(any()))
                .thenAnswer(inv -> kit.dep(PromotionRepository.class).findById(inv.getArgument(0)));
        User emissor = marca("loja.alfa");
        User outro = marca("loja.beta");
        User ana = kit.dep(UserRepository.class).save(Kit.user("ana"));

        assertThat(code(() -> seals.createPromotion(Kit.as(emissor), promo(UUID.randomUUID())))).isEqualTo("CANAL_CUPOM_INVALIDO");
        assertThat(code(() -> seals.createPromotion(Kit.as(emissor), promo(desativado.getId())))).isEqualTo("CANAL_CUPOM_INATIVO");
        Map<String, Object> criada = seals.createPromotion(Kit.as(emissor), promo(loja.getId()));
        assertThat(criada.get("canalCupom")).extracting("id", "codigo").containsExactly(loja.getId(), "LOJA_FISICA");
        UUID id = (UUID) criada.get("id");
        // editar a oferta passa pela checagem de dono (o Guard do kit é um dublê: aqui se confere que ele é consultado
        // com o dono da oferta antes de qualquer troca de canal)
        seals.updatePromotion(Kit.as(outro), id, promo(loja.getId()));
        org.mockito.Mockito.verify(kit.dep(br.com.fashionai.application.security.Guard.class))
                .requireOwner(any(), org.mockito.ArgumentMatchers.eq(emissor.getId()), org.mockito.ArgumentMatchers.eq("promotion:" + id));

        SealBond vinculo = new SealBond();
        vinculo.setRequestedBy(ana);
        vinculo.setTargetOwner(emissor);
        vinculo.setStatus(SealBondStatus.APPROVED);
        vinculo.setScheme(Kit.look(ana, "Look"));
        kit.dep(SealBondRepository.class).save(vinculo);
        Map<String, Object> cupom = seals.redeem(Kit.as(ana), id);
        assertThat(cupom).containsEntry("canalCodigoSnapshot", "LOJA_FISICA");
        assertThat(cupom.get("canalCupom")).extracting("codigo").isEqualTo("LOJA_FISICA");

        // a oferta muda de canal: o cupom já emitido continua com o da emissão
        assertThat(seals.updatePromotion(Kit.as(emissor), id, promo(ecommerce.getId())).get("canalCupom")).extracting("codigo").isEqualTo("ECOMMERCE");
        PromotionRedemption emitido = MemoryRepository.<PromotionRedemption>rows(kit.dep(PromotionRedemptionRepository.class)).get(0);
        assertThat(emitido.getCanalCupom()).isSameAs(loja);
        assertThat(emitido.getCanalCodigoSnapshot()).isEqualTo("LOJA_FISICA");
        // desativar o canal preserva a carteira e a oferta que já o usa; só não entra em oferta nova
        ecommerce.setAtivo(false);
        assertThat(seals.updatePromotion(Kit.as(emissor), id, promo(ecommerce.getId())).get("canalCupom")).extracting("codigo").isEqualTo("ECOMMERCE");
        assertThat(code(() -> seals.createPromotion(Kit.as(emissor), promo(ecommerce.getId())))).isEqualTo("CANAL_CUPOM_INATIVO");
        // oferta antiga, sem canal: não informado, e o cupom dela também
        Map<String, Object> antiga = seals.createPromotion(Kit.as(emissor), promo(null));
        assertThat(antiga).containsEntry("canalCupom", null);
        Promotion semCanal = kit.dep(PromotionRepository.class).findById((UUID) antiga.get("id")).orElseThrow();
        assertThat(semCanal.getCanalCupom()).isNull();
        // o direito de resgate não é cupom emitido: nada foi gravado em coupon_rights por causa do canal
        assertThat(MemoryRepository.rows(kit.dep(CouponRightRepository.class))).isEmpty();
    }

    @Test
    void combinacaoFlairGuardaOCanalEOCupomEmitidoConservaOCanalDaEmissao() {
        World world = new World(kit);
        kit.atelier();
        FlairService flair = kit.real(FlairService.class);
        flair.setCouponChannels(kit.dep(CanalCupomRepository.class));
        CurrentUser loja1 = Kit.as(marca("loja.gama"));
        CurrentUser loja2 = Kit.as(marca("loja.delta"));
        CurrentUser ana = Kit.as(world.me);

        assertThat(code(() -> flair.saveCombination(loja1, null, combo(UUID.randomUUID())))).isEqualTo("CANAL_CUPOM_INVALIDO");
        assertThat(code(() -> flair.saveCombination(loja1, null, combo(desativado.getId())))).isEqualTo("CANAL_CUPOM_INATIVO");
        Map<String, Object> criada = flair.saveCombination(loja1, null, combo(ecommerce.getId()));
        assertThat(criada.get("canalCupom")).extracting("codigo").isEqualTo("ECOMMERCE");
        UUID id = (UUID) criada.get("id");
        // outra loja não edita a combinação alheia: o canal continua o que a dona escolheu
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> flair.saveCombination(loja2, id, combo(loja.getId()))).isNotNull();
        assertThat(kit.dep(br.com.fashionai.domain.repository.FlairCombinationRepository.class).findById(id).orElseThrow().getCanalCupom()).isSameAs(ecommerce);

        Map<String, Object> cupom = flair.redeem(ana, id, null);
        assertThat(cupom).containsEntry("canalCodigoSnapshot", "ECOMMERCE");
        flair.saveCombination(loja1, id, combo(loja.getId()));
        Map<String, Object> naCarteira = flair.vouchers(ana).get(0);
        assertThat(naCarteira).containsEntry("canalCodigoSnapshot", "ECOMMERCE");
        assertThat(naCarteira.get("canalCupom")).extracting("codigo").isEqualTo("ECOMMERCE");
        // reenviar o resgate não emite um segundo cupom
        assertThat(catchThrowableOfType(() -> flair.redeem(ana, id, null), ApiException.class).code()).isEqualTo("CUPOM_JA_EMITIDO");
        assertThat(MemoryRepository.<FlairRedemption>rows(kit.dep(FlairRedemptionRepository.class))).hasSize(1);
        // combinação antiga, sem canal: cupom sem canal ("não informado"), sem inferir pela URL da loja
        Map<String, Object> antiga = flair.saveCombination(loja1, null, combo(null));
        assertThat(antiga).containsEntry("canalCupom", null);
    }
}
