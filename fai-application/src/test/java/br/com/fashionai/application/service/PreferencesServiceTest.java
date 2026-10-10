package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.HypeScorePanelVersion;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.SizeSystem;
import br.com.fashionai.domain.model.enums.ThemeMode;
import br.com.fashionai.domain.model.enums.UiDensity;
import br.com.fashionai.domain.model.enums.UiLanguage;
import br.com.fashionai.domain.model.enums.UnitSystem;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Preferências e perfil (RF23/RF3): tema, idioma, densidade, fonte, acessibilidade, fundo do app, cor dos containers,
 * medidas, manequim, skin padrão e "Criadores em alta"; a alteração mais recente vence entre aparelhos; perfil com
 * links, país e foto (envio e rotação); troca e checagem do @.
 */
class PreferencesServiceTest {
    private Kit kit;
    private World world;
    private PreferencesService prefs;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        AssetCatalogService assets = kit.dep(AssetCatalogService.class);
        when(assets.isChromeBackground("aurora")).thenReturn(true);
        when(assets.cardSkin("atelier")).thenReturn(Optional.of(Map.of("id", "atelier")));
        MediaService media = kit.dep(MediaService.class);
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/jpeg"));
        when(media.requireOwnedMedia(any(), anyString(), any(), anyString())).thenAnswer(i -> new MediaService.OwnedMedia("k", i.getArgument(1)));
        when(media.ownedMedia(any(), any(), any())).thenAnswer(i -> i.getArgument(1) == null ? Optional.empty() : Optional.of(new MediaService.OwnedMedia("k", i.getArgument(1))));
        when(media.readImage(anyString())).thenReturn(Optional.of(new BufferedImage(40, 20, BufferedImage.TYPE_INT_RGB)));
        when(kit.dep(IdentityService.class).usernameSuggestions(anyString())).thenReturn(List.of("ana_1", "ana.oficial"));
        prefs = kit.build(PreferencesService.class);
        ana = Kit.as(world.me);
    }

    private PreferencesService.Update update(Instant at) {
        return new PreferencesService.Update(ThemeMode.DARK, UiLanguage.EN, UiDensity.COMPACT, 120, true, true, "aurora", SizeSystem.EU, UnitSystem.IN,
                MannequinSex.MASCULINO, MannequinGeometry.SKIN_TONES.keySet().iterator().next(), BodyBuild.CURVY, "atelier", HypeScorePanelVersion.BENTO_DIA,
                at, "#aabbcc", true, false, "quiet_luxury", true);
    }

    private static PreferencesService.Update only(Integer font, String chrome, String container, String core, String tone, String skin) {
        return new PreferencesService.Update(null, null, null, font, null, null, chrome, null, null, null, tone, null, skin, null, null, container,
                null, null, core, null);
    }

    @Test
    void preferenciasCriadasNaPrimeiraLeituraEAtualizadas() {
        Map<String, Object> first = prefs.get(ana);
        assertThat(first).containsKeys("theme", "language", "profile");
        Map<String, Object> r = prefs.update(ana, update(Instant.now()));
        assertThat(r).containsEntry("theme", ThemeMode.DARK).containsEntry("fontScale", 120).containsEntry("contentContainerColor", "#AABBCC")
                .containsEntry("coreAesthetic", "QUIET_LUXURY").containsEntry("hypeCreatorOptOut", true);
        assertThat(world.me.getInterfaceBackgroundPresetId()).isEqualTo("aurora");
        assertThat(world.me.getLookDoDiaPanelVersion()).isEqualTo(HypeScorePanelVersion.BENTO_DIA);
        // alteração mais antiga, vinda de outro aparelho, não sobrescreve
        Map<String, Object> stale = prefs.update(ana, new PreferencesService.Update(ThemeMode.LIGHT, null, null, null, null, null, null, null, null, null, null,
                null, null, null, Instant.now().minusSeconds(3600), null, null, null, null, false));
        assertThat(stale).containsEntry("theme", ThemeMode.DARK);
        // vazio volta ao padrão
        Map<String, Object> reset = prefs.update(ana, only(null, " ", "", "", null, null));
        assertThat(reset.get("contentContainerColor")).isNull();
        assertThat(reset.get("coreAesthetic")).isNull();
        assertThat(prefs.options()).containsKeys("chromeBackgrounds", "cardSkins", "skinTones", "themes", "bodyBuilds");
        prefs.setHypeCache(Kit.mock(br.com.fashionai.application.hype.HypeCache.class));
        prefs.update(ana, new PreferencesService.Update(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, false));
    }

    @Test
    void valoresForaDoPermitidoSaoRecusados() {
        assertThatThrownBy(() -> prefs.update(ana, only(50, null, null, null, null, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.update(ana, only(null, "inexistente", null, null, null, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.update(ana, only(null, null, "azul", null, null, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.update(ana, only(null, null, null, "punk", null, null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.update(ana, only(null, null, null, null, "verde", null))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.update(ana, only(null, null, null, null, null, "nao-existe"))).isInstanceOf(ApiException.class);
    }

    @Test
    void perfilComLinksPaisERosto() {
        prefs.get(ana);
        Views.UserCard card = prefs.updateProfile(ana, new PreferencesService.ProfileUpdate("Ana Lima", "Moda consciente", "/media/users/a/avatar.jpg",
                "", "br", MannequinSex.FEMININO, true, "ela/dela", List.of(Map.of("url", "https://ana.example.com", "title", ""),
                Map.of("url", " ")), Map.of("offsetX", 5, "scale", 0.1)));
        assertThat(card.displayName()).isEqualTo("Ana Lima");
        assertThat(world.me.getCountry()).isEqualTo("BR");
        assertThat(world.me.getLinksJson()).contains("ana.example.com");
        assertThat(world.me.isRunwayOptOut()).isTrue();
        UserPreferences p = kit.dep(UserPreferencesRepository.class).findByUserId(world.me.getId()).orElseThrow();
        assertThat(p.getMannequinFaceJson()).contains("0.3").contains("0.6");
        prefs.updateProfile(ana, new PreferencesService.ProfileUpdate(null, null, null, null, "", null, null, " ", null, null));
        assertThat(world.me.getPronouns()).isNull();
        assertThatThrownBy(() -> prefs.updateProfile(ana, new PreferencesService.ProfileUpdate(null, null, null, null, "Brasil", null, null, null, null, null)))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> PreferencesService.validLinks(List.of(Map.of("url", "javascript:alert(1)")))).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> PreferencesService.validLinks(List.of(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of()))).isInstanceOf(ApiException.class);
    }

    @Test
    void trocaEChecagemDoArroba() {
        assertThat(prefs.changeUsername(ana, "Ana")).containsEntry("username", "ana");
        assertThat(prefs.changeUsername(ana, "ana.nova")).containsEntry("username", "ana.nova");
        assertThatThrownBy(() -> prefs.changeUsername(ana, "bia")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.changeUsername(ana, "x")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.changeUsername(ana, "admin")).isInstanceOf(ApiException.class);
        assertThat(prefs.checkUsername("caio")).containsEntry("available", false);
        assertThat(prefs.checkUsername("pessoa.nova")).containsEntry("available", true);
    }

    @Test
    void fotoDePerfilEnviadaEGirada() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB), "png", out);
        Views.UserCard avatar = prefs.uploadProfileImage(ana, out.toByteArray(), false);
        assertThat(avatar.avatarUrl()).contains("/profile/avatar-");
        prefs.uploadProfileImage(ana, out.toByteArray(), true);
        assertThat(world.me.getCoverUrl()).contains("/profile/cover-");
        assertThat(prefs.rotateAvatar(ana, 90).avatarUrl()).contains("/profile/avatar-");
        prefs.rotateAvatar(ana, -90);
        prefs.rotateAvatar(ana, 180);
        assertThatThrownBy(() -> prefs.rotateAvatar(ana, 45)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.rotateAvatar(ana, 360)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> prefs.rotateAvatar(Kit.as(world.rival), 90)).isInstanceOf(ApiException.class);
        assertThat(map(prefs.get(ana).get("profile"))).containsKey("avatarUrl");
    }
}
