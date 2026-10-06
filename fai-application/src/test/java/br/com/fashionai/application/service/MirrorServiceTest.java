package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.testkit.World.map;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Smart Mirror e Vista-me (RF33): montar o look peça a peça (uma por slot, até 4 acessórios, vestido tira cima e baixo),
 * pedir sugestão para um slot, deixar o Vista-me montar um look novo a partir de um pedido em texto, "Tira uma coisa",
 * salvar como look, usar como Look do Dia e o roteiro do Arrume-se Comigo.
 */
class MirrorServiceTest {
    private Kit kit;
    private World world;
    private MirrorService mirror;
    private CurrentUser ana;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        when(kit.dep(MediaService.class).put(anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaStoragePort.StoredObject(i.getArgument(0), "/media/" + i.getArgument(0), 10, "image/png"));
        when(kit.dep(Guard.class).canView(any(), any(), any())).thenReturn(true);
        kit.real(WardrobeService.class);
        kit.real(BackgroundStudioService.class);
        kit.real(SchemeCardRenderer.class);
        kit.real(RoomService.class);
        kit.real(SchemeService.class);
        mirror = kit.build(MirrorService.class);
        ana = Kit.as(world.me);
    }

    private UUID piece(String subcategory) {
        return world.piece(world.me, subcategory).getId();
    }

    @Test
    void montarPecaAPecaComAsRegrasDosSlots() {
        assertThat(mirror.state(ana)).isNotEmpty();
        mirror.place(ana, piece("t_shirt"));
        Map<String, Object> r = mirror.place(ana, piece("shirt"));   // troca a parte de cima e devolve a anterior
        assertThat((List<?>) r.get("returned")).hasSize(1);
        mirror.place(ana, piece("jeans"));
        Map<String, Object> dress = mirror.place(ana, piece("dress"));   // vestido tira cima e baixo
        assertThat((List<?>) dress.get("returned")).hasSize(2);
        mirror.place(ana, piece("t_shirt"));   // e a parte de cima tira o vestido
        mirror.place(ana, piece("casual_sneakers"));
        for (int i = 0; i < 5; i++) {
            WardrobeItem acc = kit.dep(WardrobeItemRepository.class).save(Kit.piece(world.me, "brinco " + i, "accessory_piece", "earrings", "gold"));
            mirror.place(ana, acc.getId());
        }
        WardrobeItem lent = world.piece(world.me, "hoodie");
        lent.setDisponivel(false);
        assertThat(mirror.place(ana, lent.getId())).containsKey("notice");
        assertThat(mirror.remove(ana, lent.getId())).isNotEmpty();
        assertThat(mirror.clear(ana)).isNotEmpty();
        assertThat(MirrorService.slotOf(world.piece(world.me, "blazer"))).isIn("upper", "outer_layer");
    }

    @Test
    void sugestaoParaUmSlotComAsPecasDisponiveis() {
        mirror.place(ana, piece("t_shirt"));
        mirror.place(ana, piece("jeans"));
        Map<String, Object> s = mirror.suggest(ana, "shoes");
        assertThat(s).isNotEmpty();
        assertThatThrownBy(() -> mirror.suggest(ana, "chapeu")).isInstanceOf(ApiException.class);
        assertThat(mirror.eligible(world.me.getId())).hasSize(12);
    }

    @Test
    void vistaMeMontaUmLookNovoDoPedido() {
        Map<String, Object> v = mirror.vistaMe(ana, "um look casual para o fim de semana com tênis", List.of(), null, false);
        assertThat(v).isNotEmpty();
        assertThat(mirror.another(ana)).isNotEmpty();
        assertThat(mirror.swap(ana, "shoes")).isNotEmpty();
        Map<String, Object> focus = mirror.vistaMe(ana, "noite elegante", List.of(piece("blazer")), piece("oxford_shoes"), true);
        assertThat(focus).isNotEmpty();
        MirrorService.Interpretation it = MirrorService.localInterpretation("trabalho formal no inverno sem salto", List.of());
        assertThat(it).isNotNull();
        assertThat(MirrorService.localCompose(it, world.piecesOf(world.me), java.util.Set.of())).isNotEmpty();
    }

    @Test
    void tiraUmaCoisaSalvarEUsarComoLookDoDia() {
        assertThatThrownBy(() -> mirror.takeOneOff(ana)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> mirror.save(ana, "Vazio", false)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> mirror.grwmStoryboard(ana)).isInstanceOf(ApiException.class);
        mirror.place(ana, piece("t_shirt"));
        mirror.place(ana, piece("jeans"));
        mirror.place(ana, piece("casual_sneakers"));
        mirror.place(ana, piece("cap"));
        mirror.place(ana, piece("handbag"));
        Map<String, Object> off = mirror.takeOneOff(ana);
        assertThat(off).containsKey("removed");
        assertThat(mirror.grwmStoryboard(ana)).isNotEmpty();
        assertThat(mirror.draft(ana, null)).isNotEmpty();
        Map<String, Object> saved = mirror.save(ana, "Look do espelho", true);
        assertThat(saved).isNotEmpty();
        assertThat(mirror.save(ana, "De novo", false)).isNotEmpty();   // mesma combinação: reaproveita o look
        assertThat(mirror.useLook(ana)).containsKey("dailyLook");
    }

    @Test
    void lookIncompletoNaoViraLookDoDia() {
        mirror.place(ana, piece("cap"));
        assertThatThrownBy(() -> mirror.useLook(ana)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> mirror.takeOneOff(ana)).isInstanceOf(ApiException.class);
        assertThat(MirrorService.missing(map(Map.of()))).isNotEmpty();
        assertThat(MirrorService.complete(Map.of("dress", piece("dress").toString(), "shoes", piece("oxford_shoes").toString()))).isTrue();
    }
}
