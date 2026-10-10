package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.FlatLayPipeline;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.Photo;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.PhotoOrigin;
import br.com.fashionai.domain.repository.PhotoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Minhas Fotos (RF12): galeria por origem com filtros em cascata, insights de estilo, linha do tempo, exclusão com aviso
 * de peça ativa (uma a uma ou em lote), download do original, edição no Editor 2D e o Photo Curator, que agrupa
 * quase-duplicatas pelo hash perceptual e só sugere — nunca exclui sozinho.
 */
class PhotoServiceTest {
    private Kit kit;
    private World world;
    private PhotoService photos;
    private CurrentUser ana;
    private final List<Photo> saved = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        kit = new Kit();
        world = new World(kit);
        MediaService media = kit.dep(MediaService.class);
        BufferedImage stripes = image(Color.BLACK);
        when(media.readImage(anyString())).thenAnswer(i -> i.getArgument(0, String.class).contains("unica") ? Optional.of(image(Color.RED)) : Optional.of(stripes));
        when(media.read(anyString())).thenReturn(Optional.of(new byte[]{1, 2, 3}));
        when(media.put(anyString(), any(), anyString())).thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(media.register(any(), any(), any(), any(), any(), any(), any(), any(Integer.class), any(Integer.class), any(), any(), any())).thenAnswer(i -> {
            Photo p = new Photo();
            p.setUser(i.getArgument(0));
            p.setOrigin(i.getArgument(1));
            p.setPublicUrl(((MediaStoragePort.StoredObject) i.getArgument(3)).url());
            return kit.dep(PhotoRepository.class).save(p);
        });
        photos = kit.build(PhotoService.class);
        ana = Kit.as(world.me);
        List<WardrobeItem> mine = world.piecesOf(world.me);
        Scheme look = world.looksOf(world.me).get(0);
        for (int i = 0; i < 6; i++) {
            WardrobeItem w = mine.get(i);
            saved.add(photo(PhotoOrigin.WARDROBE_ITEM, w.getId(), w.getImageUrl(), i));
        }
        saved.add(photo(PhotoOrigin.SCHEME, look.getId(), "/media/look.png", 7));
        saved.add(photo(PhotoOrigin.LOOSE, null, "/media/unica.png", 40));
        saved.get(1).setKeyMoment(true);
    }

    private Photo photo(PhotoOrigin origin, UUID source, String url, int daysAgo) {
        Photo p = new Photo();
        p.setUser(world.me);
        p.setOrigin(origin);
        p.setSourceEntityId(source);
        p.setPublicUrl(url);
        p.setThumbnailUrl(url);
        p.setQualityScore(new BigDecimal(daysAgo % 3 + 1));
        p.setBytesSize(1000L + daysAgo);
        p.markCreatedAt(Instant.now().minusSeconds(daysAgo * 86_400L));
        return kit.dep(PhotoRepository.class).save(p);
    }

    private static BufferedImage image(Color c) {
        BufferedImage img = new BufferedImage(90, 80, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, 90, 80);
        g.setColor(c);
        for (int x = 0; x < 90; x += 20) {
            g.fillRect(x, 0, 10, 80);
        }
        g.dispose();
        return img;
    }

    private static byte[] png() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image(Color.BLUE), "png", out);
        return out.toByteArray();
    }

    @Test
    void listaPorOrigemComAvisoDePecaAtiva() {
        Map<String, Object> page = photos.list(ana, null, 0, 0);
        assertThat(map(page.get("groups"))).containsKeys("WARDROBE_ITEM", "SCHEME", "LOOSE");
        assertThat(map(page.get("links"))).hasSize(6);
        assertThat(photos.list(ana, PhotoOrigin.SCHEME, 0, 10).get("total")).isEqualTo(1L);
    }

    @Test
    void galeriaComFiltrosEmCascataInsightsELinhaDoTempo() {
        Map<String, Object> all = photos.gallery(ana, new PhotoInsights.Filter(null, null, null, null, null, null), 0, 0);
        assertThat(all).containsEntry("total", 8).containsKey("facets");
        Map<String, Object> casual = photos.gallery(ana, new PhotoInsights.Filter(PhotoOrigin.WARDROBE_ITEM, "casual", "streetwear", null, null, 30), 0, 3);
        assertThat((Integer) casual.get("total")).isLessThanOrEqualTo(6);
        Map<String, Object> insights = photos.insights(ana);
        assertThat(insights).containsEntry("total", 8).containsEntry("keyMoments", 1L).containsKey("sentences");
        Map<String, Object> timeline = photos.timeline(ana);
        assertThat((List<?>) timeline.get("moments")).hasSize(1);
        assertThat((List<?>) timeline.get("timeline")).isNotEmpty();
    }

    @Test
    void excluirFotoDePecaAtivaPedeConfirmacao() {
        UUID first = saved.get(0).getId();
        assertThatThrownBy(() -> photos.delete(ana, first, false)).isInstanceOf(ApiException.class);
        Map<String, Object> r = photos.delete(ana, first, true);
        assertThat(r.get("pieceWithoutImage")).isEqualTo(world.piecesOf(world.me).get(0).getId());
        verify(kit.dep(WardrobeService.class)).useDefaultImageAfterPhotoDeletion(any());
        assertThatThrownBy(() -> photos.delete(ana, first, true)).isInstanceOf(ApiException.class);
        assertThat(photos.delete(ana, saved.get(7).getId(), false)).containsEntry("deleted", 1);
    }

    @Test
    void exclusaoEmLoteComUmaConfirmacao() {
        List<UUID> ids = saved.subList(1, 4).stream().map(Photo::getId).toList();
        Map<String, Object> ask = photos.bulkDelete(ana, ids, false);
        assertThat(ask).containsEntry("requiresConfirmation", true).containsEntry("count", 3).containsEntry("linkedToPieces", 3L);
        assertThat(photos.bulkDelete(ana, ids, true)).containsEntry("deleted", 3);
        assertThat(photos.bulkDelete(ana, null, true)).containsEntry("deleted", 0);
    }

    @Test
    void downloadMomentoMarcanteECurador() {
        UUID id = saved.get(6).getId();
        assertThat(photos.download(ana, id)).containsExactly(1, 2, 3);
        assertThat(saved.get(6).getLastViewedAt()).isNotNull();
        assertThat(photos.setKeyMoment(ana, id, true)).containsEntry("keyMoment", true);
        assertThatThrownBy(() -> photos.download(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);

        Map<String, Object> cur = photos.curate(ana);
        List<?> groups = (List<?>) cur.get("duplicateGroups");
        assertThat(groups).hasSize(1);
        assertThat((List<?>) map(groups.get(0)).get("photos")).hasSizeGreaterThanOrEqualTo(7);   // as fotos de mesma composição
        assertThat(saved.get(0).getMetadataJson()).contains("dhash");
        assertThat(photos.curate(ana).get("duplicateGroups")).asList().hasSize(1);   // segunda vez usa o hash guardado
        assertThat(PhotoService.gray(0xFFFFFF)).isEqualTo(255);
    }

    @Test
    void edicaoViraImagemDaPecaOuNovaFotoDoEditor() throws Exception {
        WardrobeItem w = world.piecesOf(world.me).get(0);
        when(kit.dep(WardrobeService.class).replaceImage(any(), any(), any(), any())).thenReturn(Views.piece(w, null, null));
        assertThat(photos.saveEdit(ana, saved.get(0).getId(), png())).containsEntry("replacedPieceImage", true);
        Map<String, Object> copy = photos.saveEdit(ana, saved.get(7).getId(), png());
        assertThat(copy).containsEntry("replacedPieceImage", false).containsKey("photo");

        when(kit.dep(WardrobeService.class).governedFlatLay(any(), any())).thenReturn(Kit.mock(FlatLayPipeline.Result.class));
        assertThat(photos.removeBackground(ana, png())).containsEntry("ok", false);
    }
}
