package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.Brand;
import br.com.fashionai.domain.model.Flair3dMatch;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.BrandRepository;
import br.com.fashionai.domain.repository.Flair3dMatchRepository;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FLAIR 3D — serviço dos núcleos com repositórios em memória: lista e definição, deck conferido na abertura, só o dono
 * entrega (403), uma vez (409), só cartas da pessoa e do deck (422), núcleo inexistente 404 e o efeito das cartas.
 */
class Flair3dNucleoServiceTest {
    private Kit kit;
    private Flair3dNucleoService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        Brand farm = new Brand();
        farm.setName("Farm");
        farm.setSlug("farm");
        farm.setCountry("BR");
        kit.save(BrandRepository.class, farm);
        kit.real(Flair3dCartas.class);
        service = kit.build(Flair3dNucleoService.class);
    }

    FlairCardInstance carta(CurrentUser dono, String posicao, String... etiquetas) {
        return kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(dono.id(), posicao, etiquetas));
    }

    static Flair3dNucleoService.AbrirPartida deck(FlairCardInstance... cartas) {
        return new Flair3dNucleoService.AbrirPartida(java.util.Arrays.stream(cartas).map(FlairCardInstance::getId).toList(), null);
    }

    static Entrega vestir(FlairCardInstance... cartas) {
        Map<String, UUID> m = new java.util.LinkedHashMap<>();
        for (FlairCardInstance c : cartas) {
            m.put(c.getPosition(), c.getId());
        }
        return new Entrega(m, null, null, null);
    }

    static int status(Runnable r) {
        try {
            r.run();
        } catch (ApiException e) {
            return e.status();
        }
        return 0;
    }

    @Test
    void listaEDefinicaoSaoOsQuinzeNucleosEDesconhecidoE404() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> lista = (List<Map<String, Object>>) service.lista().get("nucleos");
        assertThat(lista).hasSize(15);
        assertThat(lista.get(0)).containsEntry("codigo", "PASSARELA").containsEntry("numero", 1).containsKeys("recursos", "acoes");
        assertThat(service.definicao("batalha_looks").codigo()).isEqualTo("BATALHA_LOOKS");
        assertThatThrownBy(() -> service.definicao("XADREZ")).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).status()).isEqualTo(404));
        assertThat(status(() -> service.abrir(ana, "XADREZ", null))).isEqualTo(404);
    }

    @Test
    void abrirConfereODeckEGuardaSementeDeckEParticipantes() {
        FlairCardInstance sup = carta(ana, "SUP", "brand:Farm");
        FlairCardInstance inf = carta(ana, "INF", "brand:Farm");
        FlairCardInstance cal = carta(ana, "CAL", "brand:Farm");
        ApiException falta = (ApiException) org.assertj.core.api.Assertions.catchThrowable(() -> service.abrir(ana, "PASSARELA", deck(sup, inf)));
        assertThat(falta.status()).isEqualTo(422);
        assertThat(falta.code()).isEqualTo("DECK_INVALIDO");
        assertThat(falta.details().get("faltam")).isEqualTo(List.of(new Definicao.Obrigatoria("CAL", 1)));
        assertThat(status(() -> service.abrir(bia, "PASSARELA", deck(sup, inf, cal)))).isEqualTo(422);

        Map<String, Object> partida = service.abrir(ana, "PASSARELA", deck(sup, inf, cal));
        assertThat(partida).containsEntry("nucleo", "PASSARELA").containsEntry("status", "ABERTA").containsKeys("id", "semente");
        assertThat((Long) partida.get("semente")).isBetween(0L, 1L << 53);
        @SuppressWarnings("unchecked")
        List<Avatares.Participante> participantes = (List<Avatares.Participante>) partida.get("participantes");
        assertThat(participantes.get(0)).isEqualTo(new Avatares.Participante("PROPRIO", "PROTAGONISTA", "A", ana.id()));
        Flair3dMatch salva = MemoryRepository.<Flair3dMatch>rows(kit.dep(Flair3dMatchRepository.class)).get(0);
        assertThat(Json.uuids(salva.getDeckJson())).containsExactly(sup.getId(), inf.getId(), cal.getId());
        assertThat(salva.getParticipantesJson()).contains("PLATEIA");
    }

    @Test
    void deckGrandeDemaisEhRecusado() {
        FlairCardInstance[] sete = new FlairCardInstance[7];
        for (int i = 0; i < 7; i++) {
            sete[i] = carta(ana, i == 0 ? "CAL" : "SUP");
        }
        assertThat(status(() -> service.abrir(ana, "DRESS_FIGHTER", deck(sete)))).isEqualTo(422);
    }

    @Test
    void entregaPontuaUmaVezSoEDoDono() {
        FlairCardInstance sup = carta(ana, "SUP", "brand:Farm");
        FlairCardInstance inf = carta(ana, "INF", "brand:Farm");
        FlairCardInstance cal = carta(ana, "CAL", "brand:Farm");
        UUID id = (UUID) service.abrir(ana, "PASSARELA", deck(sup, inf, cal)).get("id");

        assertThat(status(() -> service.entregar(bia, id, vestir(sup)))).isEqualTo(403);
        Resultado r = service.entregar(ana, id, vestir(sup, inf, cal));
        assertThat(r.pontos()).isEqualTo(71);
        assertThat(r.estrelas()).isEqualTo(1);
        Flair3dMatch salva = kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow();
        assertThat(salva.getStatus()).isEqualTo("ENTREGUE");
        assertThat(salva.getPontos()).isEqualTo(71);
        assertThat(salva.getResultadoJson()).contains("TODAS_BR");
        assertThat(salva.getEntregaJson()).contains(sup.getId().toString());
        ApiException segunda = (ApiException) org.assertj.core.api.Assertions.catchThrowable(() -> service.entregar(ana, id, vestir(sup)));
        assertThat(segunda.status()).isEqualTo(409);
        assertThat(segunda.code()).isEqualTo("PARTIDA_JA_ENTREGUE");
        assertThat(status(() -> service.entregar(ana, UUID.randomUUID(), vestir(sup)))).isEqualTo(404);
    }

    @Test
    void entregaRecusaCartaAlheiaForaDoDeckEForaDaVaga() {
        FlairCardInstance sup = carta(ana, "SUP");
        FlairCardInstance inf = carta(ana, "INF");
        FlairCardInstance cal = carta(ana, "CAL");
        FlairCardInstance outraSup = carta(ana, "SUP");
        FlairCardInstance daBia = carta(bia, "ACE");
        UUID id = (UUID) service.abrir(ana, "BATALHA_LOOKS", deck(sup, inf, cal)).get("id");

        ApiException alheia = (ApiException) org.assertj.core.api.Assertions.catchThrowable(() -> service.entregar(ana, id, vestir(sup, daBia)));
        assertThat(alheia.status()).isEqualTo(422);
        assertThat(alheia.code()).isEqualTo("CARTA_ALHEIA");
        ApiException fora = (ApiException) org.assertj.core.api.Assertions.catchThrowable(() -> service.entregar(ana, id, vestir(outraSup)));
        assertThat(fora.code()).isEqualTo("CARTA_FORA_DO_DECK");
        Entrega trocada = new Entrega(Map.of("INF", sup.getId()), null, null, null);
        ApiException vaga = (ApiException) org.assertj.core.api.Assertions.catchThrowable(() -> service.entregar(ana, id, trocada));
        assertThat(vaga.code()).isEqualTo("ENTREGA_INVALIDA");
        assertThat(kit.dep(Flair3dMatchRepository.class).findById(id).orElseThrow().getStatus()).isEqualTo("ABERTA");
    }

    @Test
    void nucleoSemDeckAceitaQualquerCartaDaPessoaEAModeloDaCasa() {
        FlairCardInstance sup = carta(ana, "SUP", "occasion:casual", "material:linen");
        Map<String, Object> partida = service.abrir(ana, "ROAD_TO_GLORY", new Flair3dNucleoService.AbrirPartida(null, "MODELO_CASA"));
        assertThat(partida.get("deck")).isNull();
        assertThat(partida.get("participantes")).isEqualTo(List.of(new Avatares.Participante("MODELO_CASA", "PROTAGONISTA", "A", null)));
        Entrega e = Flair3dFixtures.comMaquiagem(vestir(sup), "LABIOS", "CORAL", "CETIM");
        assertThat(service.entregar(ana, (UUID) partida.get("id"), e).pontos()).isEqualTo(100);
    }

    @Test
    void efeitosDasCartasDaPessoaNoNucleo() {
        FlairCardInstance farm = carta(ana, "SUP", "brand:Farm");
        FlairCardInstance gucci = carta(ana, "INF", "brand:Gucci");
        Map<String, Object> out = service.efeitos(ana, "PASSARELA",
                new Flair3dNucleoService.PedidoEfeitos(List.of(farm.getId(), gucci.getId())));
        assertThat(out.get("efeitos")).isEqualTo(List.of(
                Map.of("cardId", farm.getId(), "itens", List.of(new Efeito("MARCA_BR", 10))),
                Map.of("cardId", gucci.getId(), "itens", List.of(Efeito.motivo("MARCA_NAO_BR")))));
        FlairCardInstance daBia = carta(bia, "SUP");
        assertThat(status(() -> service.efeitos(ana, "PASSARELA", new Flair3dNucleoService.PedidoEfeitos(List.of(daBia.getId())))))
                .isEqualTo(422);
    }
}
