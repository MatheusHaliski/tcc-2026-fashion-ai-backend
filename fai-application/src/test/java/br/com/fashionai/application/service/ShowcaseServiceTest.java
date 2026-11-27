package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeGrouping;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.GroupingType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeGroupingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Vitrine 3D (RF16/RF22/RF26): look e peça no manequim, pedido dos modelos 3D que faltam, fotos com o manequim, a
 * Passarela do dia com os rankings, e as eras da celebridade e as coleções da marca (lista, itens, insights e palco).
 */
class ShowcaseServiceTest {
    private Kit kit;
    private World world;
    private ShowcaseService showcase;
    private CurrentUser ana;
    private User celeb;
    private User marca;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        Guard guard = kit.dep(Guard.class);
        when(guard.canView(any(), any(), any())).thenReturn(true);
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/jpeg"));
        showcase = kit.build(ShowcaseService.class);
        ana = Kit.as(world.me);
        celeb = world.person("estrela", 4);
        celeb.setProfileType(ProfileType.CELEBRIDADE);
        marca = world.person("marcax", 4);
        marca.setProfileType(ProfileType.MARCA);
        for (User u : List.of(world.me, world.rival, world.friend, celeb, marca)) {
            u.setProfileVisibility(Visibility.PUBLIC);
        }
        InstitutionalService inst = kit.dep(InstitutionalService.class);
        when(inst.institutionalUser(eq("estrela"))).thenReturn(celeb);
        when(inst.institutionalUser(eq("marcax"))).thenReturn(marca);
    }

    private static byte[] jpeg() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new BufferedImage(600, 800, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private SchemeGrouping grouping(User owner, GroupingType type, String label, Integer from, Integer to) {
        SchemeGrouping g = new SchemeGrouping();
        g.setOwner(owner);
        g.setType(type);
        g.setLabel(label);
        g.setPeriodFrom(from);
        g.setPeriodTo(to);
        return kit.dep(SchemeGroupingRepository.class).save(g);
    }

    @Test
    void lookEPecaNoManequimEPedidoDeModelos3d() {
        UUID look = world.lookIds(world.me).get(0);
        Map<String, Object> l = showcase.look3d(Kit.as(world.rival), look);
        assertThat(l).containsKeys("mannequin", "pieces");
        WardrobeItem w = world.piecesOf(world.me).get(0);
        Map<String, Object> p = showcase.piece3d(ana, w.getId());
        assertThat(p).containsEntry("canRequest", true).containsEntry("missing3d", 1);
        assertThat(showcase.requestModels(ana, look)).containsKeys("requested", "skipped", "look");
        assertThatThrownBy(() -> showcase.look3d(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> showcase.piece3d(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
    }

    @Test
    void fotosComOManequim() throws Exception {
        WardrobeItem top = world.piece(world.me, "t_shirt");
        assertThat(String.valueOf(showcase.pieceMannequinPhoto(ana, top.getId(), jpeg()).get("url"))).contains("/mannequin-");
        assertThat(top.getMannequinImageFace()).isEqualTo("PADRAO");
        assertThatThrownBy(() -> showcase.pieceMannequinPhoto(ana, world.piece(world.me, "jeans").getId(), jpeg())).isInstanceOf(ApiException.class);
        UUID look = world.lookIds(world.me).get(0);
        assertThat(showcase.schemeMannequinPhoto(ana, look, jpeg(), true)).containsEntry("cover", true);
        showcase.deleteMannequinPhoto(ana, "scheme", look);
        showcase.deleteMannequinPhoto(ana, "piece", top.getId());
        assertThat(top.getMannequinImageUrl()).isNull();
        SchemeGrouping g = grouping(world.me, GroupingType.COLLECTION, "Verão", 2025, null);
        assertThat(showcase.groupingCover(ana, g.getId(), jpeg())).containsKey("coverUrl");
    }

    @Test
    void passarelaDoDiaComRankings() {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        for (User u : List.of(world.me, world.rival, world.friend)) {
            Scheme s = world.looksOf(u).get(0);
            DailyLook dl = new DailyLook();
            dl.setUser(u);
            dl.setScheme(s);
            dl.setLookDate(today);
            kit.dep(DailyLookRepository.class).save(dl);
        }
        Map<String, Object> r = showcase.runway(ana, 12);
        assertThat(r).isNotEmpty();
        for (String ranking : ShowcaseService.RUNWAY_RANKINGS) {
            assertThat(showcase.runway(ana, new ShowcaseService.RunwayFilter(ranking, "SA", "BR", List.of("Branco"), List.of("casual"),
                    List.of("streetwear"), null, 6, 0))).isNotEmpty();
        }
        assertThat(showcase.runway(null, new ShowcaseService.RunwayFilter(null, null, null, List.of(), List.of(), List.of(), "FEMININO", null, 1))).isNotEmpty();
        assertThatThrownBy(() -> showcase.runway(ana, new ShowcaseService.RunwayFilter("NADA", null, null, List.of(), List.of(), List.of(), null, 6, 0)))
                .isInstanceOf(ApiException.class);
        assertThat(ShowcaseService.count(List.of("a", "b", "a"))).hasSize(2);
    }

    @Test
    void erasDaCelebridadeEColecoesDaMarca() {
        SchemeGrouping era = grouping(celeb, GroupingType.ERA, "Era pop", 2010, 2014);
        grouping(celeb, GroupingType.TOUR, "Turnê", 2016, null);
        List<Scheme> looks = world.looksOf(celeb);
        looks.get(0).setGroupingId(era.getId());
        looks.get(1).setGroupingId(era.getId());
        world.piecesOf(celeb).get(0).setGroupingId(era.getId());
        Map<String, Object> list = showcase.list(ana, "estrela", ShowcaseService.Kind.ERAS);
        assertThat((List<?>) list.get("items")).hasSize(2);
        assertThat(showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, era.getId(), null, null, null, null)).isNotEmpty();
        assertThat(showcase.items(ana, "estrela", ShowcaseService.Kind.ERAS, null, "look", "SCHEME", "HYPE", 2012)).isNotEmpty();
        for (String sort : ShowcaseService.SHOWCASE_SORTS) {
            showcase.items(Kit.as(celeb), "estrela", ShowcaseService.Kind.ERAS, null, null, "PIECE", sort, null);
        }
        assertThat(showcase.insights(ana, "estrela", ShowcaseService.Kind.ERAS)).isNotEmpty();
        assertThat(showcase.stage(ana, "estrela", null)).containsKeys("celebrity", "look", "eras", "looks");
        assertThat(showcase.stage(ana, "estrela", looks.get(1).getId()).get("look")).isNotNull();
        assertThatThrownBy(() -> showcase.stage(ana, "estrela", UUID.randomUUID())).isInstanceOf(ApiException.class);

        grouping(marca, GroupingType.COLLECTION, "Inverno 26", 2026, null);
        assertThat((List<?>) showcase.list(ana, "marcax", ShowcaseService.Kind.COLLECTIONS).get("items")).hasSize(1);
        assertThat(showcase.insights(Kit.as(marca), "marcax", ShowcaseService.Kind.COLLECTIONS)).isNotEmpty();
        assertThatThrownBy(() -> showcase.list(ana, "marcax", ShowcaseService.Kind.ERAS)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> showcase.list(ana, "estrela", ShowcaseService.Kind.COLLECTIONS)).isInstanceOf(ApiException.class);
        assertThat(ShowcaseService.kind("colecoes")).isEqualTo(ShowcaseService.Kind.COLLECTIONS);
        assertThatThrownBy(() -> ShowcaseService.kind("nada")).isInstanceOf(ApiException.class);
        assertThat(ShowcaseService.period(era)).contains("2010");
    }
}
