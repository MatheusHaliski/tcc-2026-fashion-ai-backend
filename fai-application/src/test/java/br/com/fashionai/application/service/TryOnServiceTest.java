package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.DefaultOutfit;
import br.com.fashionai.application.imaging.MannequinGeometry;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.imaging.TryOnCompositor;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.BodyBuild;
import br.com.fashionai.domain.model.enums.MannequinSex;
import br.com.fashionai.domain.model.enums.PhotoProcessingStatus;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Provador virtual (RF16/RF30): o manequim com o sexo do cadastro e as preferências de corpo e pele, as peças do
 * próprio acervo por lugar no corpo, a troca na mesma camada (a peça inteira tira cima e baixo), a montagem local da
 * imagem (sem provedor externo) e "salvar como look".
 */
class TryOnServiceTest {
    private Kit kit;
    private World world;
    private TryOnService tryOn;
    private CurrentUser ana;

    @BeforeEach
    void setUp() throws Exception {
        kit = new Kit();
        world = new World(kit);
        byte[] png = png();
        MediaService media = kit.dep(MediaService.class);
        when(media.read(anyString())).thenReturn(Optional.of(png));
        when(media.put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(media.register(any(), any(), any(), any(), any(), any(), any(), any(Integer.class), any(Integer.class), any(), any(), any())).thenAnswer(i -> {
            Photo p = new Photo();
            p.assignId(UUID.randomUUID());
            return p;
        });
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        when(kit.dep(OwnMedia.class).require(any(), anyString(), anyString(), org.mockito.ArgumentMatchers.anyBoolean())).thenAnswer(i -> i.getArgument(1));
        kit.with(new TryOnCompositor(List.of(), List.of(), Kit.mock(DefaultOutfit.class)));
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        kit.real(SchemeService.class);
        tryOn = kit.build(TryOnService.class);
        ana = Kit.as(world.me);
        UserPreferences p = new UserPreferences();
        p.setUser(world.me);
        kit.dep(UserPreferencesRepository.class).save(p);
        world.piecesOf(world.me).get(0).setPhotoProcessingStatus(PhotoProcessingStatus.COMPLETED);
    }

    private static byte[] png() throws Exception {
        BufferedImage img = new BufferedImage(120, 160, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 120, 160);
        g.setColor(Color.DARK_GRAY);
        g.fillRect(20, 20, 80, 120);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private UUID piece(String sub) {
        return world.piece(world.me, sub).getId();
    }

    @Test
    void estadoDoProvadorComAsPecasPorLugarNoCorpo() {
        Map<String, Object> s = tryOn.state(ana, null);
        assertThat(s).containsKeys("mannequin", "identity", "sex", "skinTones", "builds", "slots");
        Map<String, Object> bySlot = map(s.get("pieces"));
        assertThat((List<?>) bySlot.get("upper_piece")).hasSize(5);   // 4 de cima + o vestido
        WardrobeItem odd = Kit.piece(world.me, "estranha", "nao_existe", "x", "red");
        kit.dep(WardrobeItemRepository.class).save(odd);
        assertThat((List<?>) tryOn.state(ana, MannequinSex.MASCULINO).get("needsReview")).hasSize(1);
        assertThatThrownBy(() -> tryOn.state(Kit.as(world.rival), null)).isInstanceOf(ApiException.class);   // sem preferências
    }

    @Test
    void preferenciasDoManequim() {
        String tone = MannequinGeometry.SKIN_TONES.keySet().iterator().next();
        Map<String, Object> r = tryOn.savePreferences(ana, MannequinSex.MASCULINO, tone, BodyBuild.ATHLETIC);
        assertThat(r).containsEntry("sex", "MASCULINO").containsEntry("skinTone", tone).containsEntry("build", "ATHLETIC");
        assertThatThrownBy(() -> tryOn.savePreferences(ana, null, "azul", null)).isInstanceOf(ApiException.class);
        assertThat(tryOn.savePreferences(ana, null, null, null)).containsEntry("sex", "MASCULINO");
    }

    @Test
    void vestirOManequimComTrocaNaMesmaCamada() {
        Map<String, Object> r = tryOn.render(ana, null, List.of(piece("t_shirt"), piece("shirt"), piece("jeans"), piece("casual_sneakers"), piece("dress")));
        assertThat(String.valueOf(r.get("imageUrl"))).contains("/tryon/");
        assertThat((List<?>) r.get("replaced")).isNotEmpty();
        assertThat(r).containsKeys("placements", "stages", "warnings", "fallbackUsed");
        assertThatThrownBy(() -> tryOn.render(ana, null, List.of())).isInstanceOf(ApiException.class);
        WardrobeItem masc = world.piece(world.me, "hoodie");
        masc.setSex("MASCULINO");
        assertThatThrownBy(() -> tryOn.render(ana, MannequinSex.FEMININO, List.of(masc.getId()))).isInstanceOf(ApiException.class);
    }

    @Test
    void salvarOProvadorComoLook() {
        Map<String, Object> r = tryOn.saveAsScheme(ana, List.of(piece("t_shirt"), piece("jeans"), piece("casual_sneakers")), null,
                "/media/users/" + world.me.getId() + "/tryon/1.png");
        UUID id = (UUID) r.get("schemeId");
        assertThat(kit.dep(SchemeRepository.class).findById(id).orElseThrow().getVirtualTryOnUrl()).contains("/tryon/");
        assertThat(tryOn.saveAsScheme(ana, List.of(piece("dress"), piece("oxford_shoes")), "Jantar", null)).containsEntry("origin", "PROVADOR");
        assertThatThrownBy(() -> tryOn.saveAsScheme(ana, List.of(), null, null)).isInstanceOf(ApiException.class);
        Map<String, Object> layers = TryOnService.resolveLayers(world.piecesOf(world.me));
        assertThat((List<?>) layers.get("pieces")).isNotEmpty();
        assertThat(TryOnService.slotOf(world.piece(world.me, "dress"))).isEqualTo("upper_piece");
    }
}
