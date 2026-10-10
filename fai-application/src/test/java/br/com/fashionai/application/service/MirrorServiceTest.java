package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.imaging.SchemeCardRenderer;
import br.com.fashionai.application.ports.MediaStoragePort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.TipoLook;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.repository.TipoLookRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.MirrorStateRepository;
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
    @SuppressWarnings("unchecked")
    void listaDoEspelhoSemDuplicarSeparadaDoQueEstaVestido() {
        UUID tee = piece("t_shirt"), jeans = piece("jeans");
        // levar ao espelho: entra na lista, não veste; repetir o pedido não duplica
        Map<String, Object> r = mirror.bring(ana, tee);
        assertThat(r.get("added")).isEqualTo(true);
        r = mirror.bring(ana, tee);
        assertThat(r.get("added")).isEqualTo(false);
        List<Map<String, Object>> rack = (List<Map<String, Object>>) r.get("rack");
        assertThat(rack).hasSize(1);
        assertThat(rack.get(0).get("worn")).isEqualTo(false);
        assertThat(((Map<String, Object>) r.get("slots")).get("upper")).isNull();
        // vestir mantém a peça na lista, marcada como vestida; outra peça vestida também entra na lista
        mirror.place(ana, tee);
        r = mirror.place(ana, jeans);
        rack = (List<Map<String, Object>>) r.get("rack");
        assertThat(rack).extracting(m -> m.get("id")).containsExactly(tee, jeans);
        assertThat(rack).allMatch(m -> Boolean.TRUE.equals(m.get("worn")));
        // tirar do corpo não tira da lista; limpar também não
        r = mirror.remove(ana, jeans);
        assertThat((List<?>) r.get("rack")).hasSize(2);
        r = mirror.clear(ana);
        assertThat((List<?>) r.get("rack")).hasSize(2);
        // tirar da lista tira do corpo e nunca apaga a peça do guarda-roupa
        mirror.place(ana, tee);
        r = mirror.unbring(ana, tee);
        assertThat((List<?>) r.get("rack")).hasSize(1);
        assertThat(((Map<String, Object>) r.get("slots")).get("upper")).isNull();
        assertThat(kit.dep(WardrobeItemRepository.class).findById(tee)).isPresent();
        // a peça leva modelagem e atributos para o 3D (mesmo caimento do provador)
        assertThat(((List<Map<String, Object>>) r.get("rack")).get(0)).containsKeys("variation", "attributes", "studioImageUrl");
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
    void tipoLookPersisteNoEspelhoENoLookSalvoSemAlterarLookAnterior() {
        TipoLook feminino = new TipoLook();
        feminino.setCodigo("FEMININO"); feminino.setNome("Feminino");
        kit.save(TipoLookRepository.class, feminino);
        TipoLook masculino = new TipoLook();
        masculino.setCodigo("MASCULINO"); masculino.setNome("Masculino");
        kit.save(TipoLookRepository.class, masculino);
        mirror.updateTipoLook(ana, feminino.getId());
        assertThat(kit.dep(MirrorStateRepository.class).findByUserId(ana.id()).orElseThrow().getTipoLook()).isEqualTo(feminino);
        // Uma nova instância do serviço representa voltar ao Espelho em outra sessão.
        assertThat(((br.com.fashionai.application.view.Views.TipoLookView) kit.build(MirrorService.class).state(ana).get("tipoLook")).codigo()).isEqualTo("FEMININO");
        mirror.place(ana, piece("t_shirt")); mirror.place(ana, piece("jeans"));
        UUID firstId = (UUID) mirror.save(ana, "Meu look feminino", false).get("schemeId");
        Scheme first = kit.dep(SchemeRepository.class).findById(firstId).orElseThrow();
        assertThat(first.getTipoLook()).isEqualTo(feminino);
        assertThat(((br.com.fashionai.application.view.Views.SchemeView) kit.dep(SchemeService.class).get(ana, firstId).get("scheme")).tipoLook().nome()).isEqualTo("Feminino");
        assertThat(mirror.save(ana, "Mesmo tipo", false).get("schemeId")).isEqualTo(firstId);
        mirror.updateTipoLook(ana, masculino.getId());
        UUID secondId = (UUID) mirror.save(ana, "Meu look masculino", false).get("schemeId");
        assertThat(secondId).isNotEqualTo(firstId);
        assertThat(kit.dep(SchemeRepository.class).findById(secondId).orElseThrow().getTipoLook()).isEqualTo(masculino);
        assertThat(first.getTipoLook()).isEqualTo(feminino);
        // Limpar as peças mantém a preferência salva.
        mirror.clear(ana);
        assertThat(((br.com.fashionai.application.view.Views.TipoLookView) mirror.state(ana).get("tipoLook")).codigo()).isEqualTo("MASCULINO");
    }

    @Test
    void tipoInexistenteNaoEGravadoENaoMudaOEstado() {
        assertThatThrownBy(() -> mirror.updateTipoLook(ana, UUID.randomUUID())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> mirror.updateTipoLook(ana, null)).isInstanceOf(ApiException.class);
        assertThat(mirror.state(ana).get("tipoLook")).isNull();
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
