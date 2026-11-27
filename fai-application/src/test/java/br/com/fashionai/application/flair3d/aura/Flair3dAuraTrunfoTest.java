package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * O trunfo do Hype pelo serviço: uma vez por partida, só carta do deck com Hype Relevante ou mais, pedido repetido
 * devolve o mesmo, e o Hype da carta não muda. A família de Aura de cada carta sai da arte do card da peça e chega à
 * tela pelos selos (efeitos).
 */
class Flair3dAuraTrunfoTest {
    private Kit kit;
    private CurrentUser ana;
    private User dona;
    private Flair3dNucleoService service;
    private Flair3dAuraTrunfo trunfo;

    @BeforeEach
    void montar() {
        kit = new Kit();
        dona = kit.save(UserRepository.class, Kit.user("ana"));
        ana = Kit.as(dona);
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
        trunfo = kit.build(Flair3dAuraTrunfo.class);
    }

    private FlairCardInstance carta(String posicao, Integer hyp, String familia) {
        FlairCardInstance c = Flair3dFixtures.instance(ana.id(), posicao, "color:black");
        if (hyp != null) {
            c.setHypeJson("{\"HYP\":" + hyp + "}");
        }
        if (familia != null) {
            WardrobeItem w = Kit.piece(dona, "peça " + posicao, "upper_piece", "shirt", "black");
            w.setBackgroundConfigJson("{\"compositionPreset\":{\"id\":\"x\",\"family\":\"" + familia + "\"}}");
            kit.save(WardrobeItemRepository.class, w);
            c.setOriginType("PIECE");
            c.setOriginId(w.getId());
        }
        return kit.save(FlairCardInstanceRepository.class, c);
    }

    private UUID abrir(String jogo, List<UUID> deck) {
        return (UUID) service.abrir(ana, jogo, new Flair3dNucleoService.AbrirPartida(deck, null, null)).get("id");
    }

    private static String codigo(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.code();
        }
        return null;
    }

    @Test
    @SuppressWarnings("unchecked")
    void chamaUmaVezSoComCartaDoDeckDeHypeRelevante() {
        FlairCardInstance sup = carta("SUP", 80, null);
        FlairCardInstance inf = carta("INF", 10, null);
        FlairCardInstance cal = carta("CAL", null, null);
        FlairCardInstance fora = carta("SUP", 95, null);
        UUID id = abrir("PASSARELA", List.of(sup.getId(), inf.getId(), cal.getId()));

        assertThat(codigo(() -> trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(inf.getId(), "a")))).isEqualTo("HYPE_SEM_FORCA");
        assertThat(codigo(() -> trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(fora.getId(), "b")))).isEqualTo("CARTA_FORA_DO_DECK");
        Map<String, Object> h = (Map<String, Object>) trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(sup.getId(), "c")).get("hype");
        assertThat(h).containsEntry("faixa", "TRENDING").containsEntry("bonus", 4).containsEntry("etapa", 0);
        assertThat(trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(sup.getId(), "c")).get("hype")).isEqualTo(h);
        assertThat(codigo(() -> trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(sup.getId(), "d")))).isEqualTo("HYPE_JA_CHAMADO");
        // só lê o Hype: a carta continua com o mesmo número
        assertThat(kit.dep(FlairCardInstanceRepository.class).findById(sup.getId()).orElseThrow().getHypeJson()).isEqualTo("{\"HYP\":80}");
    }

    @Test
    void jogoSemAuraNaPartidaRecusa() {
        FlairCardInstance sup = carta("SUP", 80, null);
        UUID id = abrir("DRESS_FIGHTER", List.of(sup.getId(), carta("INF", null, null).getId(), carta("CAL", null, null).getId()));
        assertThat(codigo(() -> trunfo.chamar(ana, id, new Flair3dAuraTrunfo.PedidoDeTrunfo(sup.getId(), "a")))).isEqualTo("USO_INVALIDO");
    }

    @Test
    @SuppressWarnings("unchecked")
    void aFamiliaDeAuraChegaAosSelosDosJogosComAura() {
        FlairCardInstance electro = carta("SUP", 65, "ELECTRO");
        FlairCardInstance sem = carta("INF", null, null);
        Map<String, Object> r = service.efeitos(ana, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(List.of(electro.getId(), sem.getId()), null, null));
        List<Map<String, Object>> lista = (List<Map<String, Object>>) r.get("efeitos");
        Map<String, Object> a = (Map<String, Object>) lista.get(0).get("aura");
        assertThat(a).containsEntry("familia", "ELECTRO").containsEntry("faixa", "HOT").containsEntry("trunfo", 3).containsEntry("metamorfose", false);
        assertThat((Map<String, Object>) lista.get(1).get("aura")).containsEntry("familia", null).containsEntry("trunfo", 0);
        Map<String, Object> luta = service.efeitos(ana, "DRESS_FIGHTER", new Flair3dNucleoService.PedidoEfeitos(List.of(electro.getId()), null, null));
        assertThat(((List<Map<String, Object>>) luta.get("efeitos")).get(0)).doesNotContainKey("aura");
    }
}
