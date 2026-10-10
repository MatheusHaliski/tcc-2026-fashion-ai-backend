package br.com.fashionai.application.multiplatform;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.GarmentAsset3d;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAvatar3d;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.GarmentAssetStatus;
import br.com.fashionai.domain.model.enums.TryOnSlot;
import br.com.fashionai.domain.repository.GarmentAsset3dRepository;
import br.com.fashionai.domain.repository.UserAvatar3dRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * MP-2 — Provador sincronizado: a mesma conta vê o mesmo provador no iOS e no Windows; mudanças concorrentes não se
 * sobrescrevem (412 com o estado atual); experimentar não pede título; peça sem asset 3D aprovado é prévia 2D.
 */
class TryOnSessionServiceTest {
    private Kit kit;
    private TryOnSessionService service;
    private User ana;
    private CurrentUser me;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = kit.save(UserRepository.class, Kit.user("ana"));
        me = Kit.as(ana);
        service = kit.build(TryOnSessionService.class);
    }

    private WardrobeItem piece(String category, String sub) {
        return kit.save(WardrobeItemRepository.class, Kit.piece(ana, sub, category, sub, "black"));
    }

    private static Map<?, ?> slot(Map<String, Object> view, TryOnSlot s) {
        return (Map<?, ?>) ((Map<?, ?>) view.get("slots")).get(s.name());
    }

    @Test
    void mesmaContaMesmoProvadorEmDuasPlataformas() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        Map<String, Object> ios = service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        assertThat(ios.get("revision")).isEqualTo(1L);
        assertThat(ios.get("updatedPlatform")).isEqualTo("IOS");

        Map<String, Object> windows = service.get(me, QualityProfile.DESKTOP_HIGH);
        assertThat(windows.get("revision")).isEqualTo(1L);
        assertThat(((Map<?, ?>) slot(windows, TryOnSlot.TOP).get("piece")).get("id")).isEqualTo(tee.getId());
        assertThat(windows.get("qualityProfile")).isEqualTo("DESKTOP_HIGH");
    }

    @Test
    void atualizacaoConcorrenteRecebe412ComOEstadoAtual() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        WardrobeItem jeans = piece("lower_piece", "jeans");
        service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        // o Windows ainda está na revisão 0 (desconectado) e tenta gravar
        assertThatThrownBy(() -> service.put(me, TryOnSlot.BOTTOM, jeans.getId(), 0L, ClientPlatform.WINDOWS, QualityProfile.DESKTOP_MID))
                .isInstanceOfSatisfying(ApiException.class, ex -> {
                    assertThat(ex.status()).isEqualTo(412);
                    assertThat(ex.code()).isEqualTo("PROVADOR_MUDOU");
                    assertThat(((Map<?, ?>) ex.details().get("current")).get("revision")).isEqualTo(1L);
                });
        // depois de reconectar, reaplica sobre a revisão atual e as duas mudanças ficam
        Map<String, Object> after = service.put(me, TryOnSlot.BOTTOM, jeans.getId(), 1L, ClientPlatform.WINDOWS, QualityProfile.DESKTOP_MID);
        assertThat(after.get("revision")).isEqualTo(2L);
        assertThat(slot(after, TryOnSlot.TOP)).isNotNull();
        assertThat(slot(after, TryOnSlot.BOTTOM)).isNotNull();
    }

    @Test
    void semRevisaoRecebe428() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        assertThatThrownBy(() -> service.put(me, TryOnSlot.TOP, tee.getId(), null, ClientPlatform.ANDROID, QualityProfile.MOBILE_LOW))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(428));
    }

    @Test
    void quatroLugaresPelaCategoriaEPecaInteiraLiberaABaixo() {
        WardrobeItem jeans = piece("lower_piece", "jeans");
        WardrobeItem dress = piece("full_body_piece", "dress");
        WardrobeItem shoes = piece("shoes_piece", "sneakers");
        WardrobeItem bag = piece("accessory_piece", "handbag");
        long r = (long) service.put(me, TryOnSlot.BOTTOM, jeans.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW).get("revision");
        r = (long) service.put(me, TryOnSlot.SHOES, shoes.getId(), r, ClientPlatform.IOS, QualityProfile.MOBILE_LOW).get("revision");
        r = (long) service.put(me, TryOnSlot.ACCESSORY, bag.getId(), r, ClientPlatform.IOS, QualityProfile.MOBILE_LOW).get("revision");
        Map<String, Object> v = service.put(me, TryOnSlot.TOP, dress.getId(), r, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        assertThat(slot(v, TryOnSlot.BOTTOM)).isNull();
        assertThat(((Map<?, ?>) slot(v, TryOnSlot.TOP).get("piece")).get("fullBody")).isEqualTo(true);
        // e a parte de baixo tira a peça inteira
        Map<String, Object> w = service.put(me, TryOnSlot.BOTTOM, jeans.getId(), (long) v.get("revision"), ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        assertThat(slot(w, TryOnSlot.TOP)).isNull();
        assertThat(slot(w, TryOnSlot.SHOES)).isNotNull();
        assertThat(slot(w, TryOnSlot.ACCESSORY)).isNotNull();
        // lugar errado para a categoria é recusado com o lugar certo
        assertThatThrownBy(() -> service.put(me, TryOnSlot.TOP, shoes.getId(), (long) w.get("revision"), ClientPlatform.IOS, QualityProfile.MOBILE_LOW))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.details()).containsEntry("expectedSlot", "SHOES"));
    }

    @Test
    void pecaSemAssetAprovadoEhPrevia2DIdentificada() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        GarmentAsset3d draft = new GarmentAsset3d();
        draft.setPieceId(tee.getId());
        draft.setRigStandard("FAI_BODY_V1");
        draft.setSource("ARTIST");
        draft.setStatus(GarmentAssetStatus.IN_REVIEW);
        draft.setRenditionsJson(Json.write(Map.of("MOBILE_LOW", Map.of("key", "garments/x/low.glb", "bytes", 100))));
        kit.save(GarmentAsset3dRepository.class, draft);
        Map<String, Object> v = service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        Map<?, ?> rep = (Map<?, ?>) slot(v, TryOnSlot.TOP).get("representation");
        assertThat(rep.get("mode")).isEqualTo("PREVIEW_2D");
        assertThat(rep.get("label")).isEqualTo(TryOnSessionService.PREVIEW_2D_LABEL);
        assertThat(rep.get("imageUrl")).isEqualTo(tee.getImageUrl());
    }

    @Test
    void assetAprovadoVesteComOArquivoDoPerfilOuOMaisLeve() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        GarmentAsset3d a = new GarmentAsset3d();
        a.setPieceId(tee.getId());
        a.setRigStandard("FAI_BODY_V1");
        a.setSource("PATTERN");
        a.setStatus(GarmentAssetStatus.APPROVED);
        a.setApprovedAt(Instant.now());
        a.setRenditionsJson(Json.write(Map.of(
                "MOBILE_LOW", Map.of("key", "garments/t/low.glb", "bytes", 900_000, "triangles", 8000),
                "DESKTOP_MID", Map.of("key", "garments/t/mid.glb", "bytes", 4_000_000, "triangles", 40000))));
        kit.save(GarmentAsset3dRepository.class, a);
        Map<String, Object> ios = service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_HIGH);
        Map<?, ?> rep = (Map<?, ?>) slot(ios, TryOnSlot.TOP).get("representation");
        assertThat(rep.get("mode")).isEqualTo("MESH_3D");
        assertThat(rep.get("renditionProfile")).isEqualTo("MOBILE_LOW");      // sem arquivo MOBILE_HIGH: cai para o mais leve
        assertThat(rep.get("url")).isEqualTo("/media/garments/t/low.glb");
        Map<?, ?> pc = (Map<?, ?>) slot(service.get(me, QualityProfile.DESKTOP_HIGH), TryOnSlot.TOP).get("representation");
        assertThat(pc.get("renditionProfile")).isEqualTo("DESKTOP_MID");
        // console não tem arquivo próprio e nunca recebe o de outra família: prévia 2D
        Map<?, ?> console = (Map<?, ?>) slot(service.get(me, QualityProfile.CONSOLE), TryOnSlot.TOP).get("representation");
        assertThat(console.get("mode")).isEqualTo("PREVIEW_2D");
    }

    @Test
    void pecaDeOutraPessoaOuArquivadaNaoEntra() {
        User bia = kit.save(UserRepository.class, Kit.user("bia"));
        WardrobeItem hers = kit.save(WardrobeItemRepository.class, Kit.piece(bia, "dela", "upper_piece", "t_shirt", "red"));
        assertThatThrownBy(() -> service.put(me, TryOnSlot.TOP, hers.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW))
                .isInstanceOfSatisfying(ApiException.class, ex -> assertThat(ex.status()).isEqualTo(404));
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        tee.setAvailabilityStatus(AvailabilityStatus.ARCHIVED);                  // arquivada depois: some sem erro
        assertThat(slot(service.get(me, QualityProfile.MOBILE_LOW), TryOnSlot.TOP)).isNull();
    }

    @Test
    void avisaQuandoOAvatarMudouDesdeAUltimaProva() {
        UserAvatar3d a = new UserAvatar3d();
        a.setUser(ana);
        a.setIdentityId(UUID.randomUUID());
        a.setCurrentVersion(1);
        kit.save(UserAvatar3dRepository.class, a);
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        assertThat(((Map<?, ?>) service.get(me, QualityProfile.MOBILE_LOW).get("avatar")).get("changedSinceLastTryOn")).isEqualTo(false);
        a.setCurrentVersion(2);                                                   // refez o avatar no computador
        assertThat(((Map<?, ?>) service.get(me, QualityProfile.MOBILE_LOW).get("avatar")).get("changedSinceLastTryOn")).isEqualTo(true);
    }

    @Test
    void esvaziarOProvadorNaoMexeNoGuardaRoupa() {
        WardrobeItem tee = piece("upper_piece", "t_shirt");
        service.put(me, TryOnSlot.TOP, tee.getId(), 0L, ClientPlatform.IOS, QualityProfile.MOBILE_LOW);
        Map<String, Object> v = service.clear(me, null, 1L, ClientPlatform.PLAYSTATION, QualityProfile.CONSOLE);
        assertThat((Map<?, ?>) v.get("slots")).allSatisfy((k, s) -> assertThat(s).isNull());
        assertThat(kit.dep(WardrobeItemRepository.class).findById(tee.getId())).isPresent();
    }
}
