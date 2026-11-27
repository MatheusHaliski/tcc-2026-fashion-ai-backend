package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.FlairCbcSquadEdicao;
import br.com.fashionai.domain.model.FlairCbcSquadEntrega;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.FlairCbcSquadEdicaoRepository;
import br.com.fashionai.domain.repository.FlairCbcSquadEntregaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

/**
 * FLAIR CBC — serviço dos elencos com repositórios em memória: formação, conferir só com cartas da pessoa (422), entrega
 * recusada com requisito falhando (422) e a edição pela ordem de conclusão (repetir mantém a edição), tirada do contador
 * do elenco (a concorrência das primeiras conclusões está em FlairCbcEdicaoConcorrenteTest).
 */
class FlairCbcSquadServiceTest {
    private Kit kit;
    private FlairCbcSquadService service;
    private CurrentUser ana;
    private CurrentUser bia;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        bia = Kit.as(kit.save(UserRepository.class, Kit.user("bia")));
        kit.real(Flair3dCartas.class);
        service = kit.build(FlairCbcSquadService.class);
    }

    /** O Desafio do Fogo cheio com cartas da pessoa, todas da cor dada (vermelha completa o quebra-cabeça). */
    FlairCbcSquadService.Pedido fogo(CurrentUser dono, String cor) {
        Map<String, UUID> cartas = new LinkedHashMap<>();
        for (FlairCbcElenco.Vaga v : FlairCbcElencos.porCodigo("DESAFIO_FOGO").orElseThrow().vagas()) {
            cartas.put(v.chave(), kit.save(FlairCardInstanceRepository.class,
                    Flair3dFixtures.instance(dono.id(), "SUP", "brand:Farm", "color:" + cor)).getId());
        }
        return new FlairCbcSquadService.Pedido(cartas);
    }

    FlairCbcSquadService.Pedido fogoVermelho(CurrentUser dono) {
        return fogo(dono, "red");
    }

    @Test
    @SuppressWarnings("unchecked")
    void formacaoTrazVagasComOQueCadaPecaPedeERequisitos() {
        Map<String, Object> f = service.formacao("desafio_fogo");
        assertThat((List<FlairCbcElenco.Vaga>) f.get("vagas")).hasSize(4).first()
                .isEqualTo(new FlairCbcElenco.Vaga("p1", "ANY", Map.of("color", List.of("red"))));
        assertThat(f).doesNotContainKey("linhas");
        assertThat((List<Map<String, Object>>) f.get("requisitos")).containsExactly(Map.of("tipo", "COR", "alvo", 4, "valor", "red"),
                Map.of("tipo", "CARTAS", "alvo", 4));
        assertThat(catchThrowableOfType(ApiException.class, () -> service.formacao("XADREZ")).status()).isEqualTo(404);
    }

    @Test
    void conferirSoComCartasDaPessoa() {
        FlairCbcSquadService.Pedido daBia = fogoVermelho(bia);
        ApiException e = catchThrowableOfType(ApiException.class, () -> service.conferir(ana, "DESAFIO_FOGO", daBia));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("CARTA_ALHEIA");
        assertThat(service.conferir(bia, "DESAFIO_FOGO", daBia)).containsEntry("ok", true).containsEntry("completas", 4);
        FlairCbcSquadService.Pedido vagaErrada = new FlairCbcSquadService.Pedido(Map.of("goleiro", daBia.cartas().get("p1")));
        assertThat(catchThrowableOfType(ApiException.class, () -> service.conferir(bia, "DESAFIO_FOGO", vagaErrada)).code())
                .isEqualTo("ENTREGA_INVALIDA");
    }

    @Test
    void entregaComRequisitoFalhandoE422ENaoGrava() {
        ApiException e = catchThrowableOfType(ApiException.class, () -> service.entregar(ana, "DESAFIO_FOGO", fogo(ana, "blue")));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("REQUISITOS_NAO_CUMPRIDOS");
        assertThat(e.details()).containsKey("requisitos");
        assertThat(MemoryRepository.<FlairCbcSquadEntrega>rows(kit.dep(FlairCbcSquadEntregaRepository.class))).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void edicaoEhAOrdemDeConclusaoERepetirNaoCriaNova() {
        assertThat(service.entregar(ana, "DESAFIO_FOGO", fogoVermelho(ana))).containsEntry("edicao", 1).containsEntry("ok", true);
        assertThat(service.entregar(bia, "DESAFIO_FOGO", fogoVermelho(bia))).containsEntry("edicao", 2);
        assertThat(service.entregar(ana, "DESAFIO_FOGO", fogoVermelho(ana))).containsEntry("edicao", 1);
        List<FlairCbcSquadEntrega> salvas = MemoryRepository.rows(kit.dep(FlairCbcSquadEntregaRepository.class));
        assertThat(salvas).hasSize(3).extracting(FlairCbcSquadEntrega::getEdicao).containsExactly(1, 2, 1);
        assertThat(salvas.get(0).getQuimica()).isEqualTo(100);

        List<Map<String, Object>> lista = (List<Map<String, Object>>) service.lista(bia).get("elencos");
        assertThat(lista).hasSize(FlairCbcElencos.TODOS.size());
        assertThat(lista.get(0)).containsEntry("codigo", "DESAFIO_FOGO").containsEntry("pecas", 4)
                .containsEntry("concluido", true).containsEntry("edicao", 2);
        assertThat(lista.get(1)).containsEntry("concluido", false).containsEntry("edicao", null);
    }

    @Test
    void edicaoSaiDoContadorDoElencoMesmoQuandoALeituraDasConclusoesEstaAtrasada() {
        FlairCbcSquadEntregaRepository entregas = kit.dep(FlairCbcSquadEntregaRepository.class);
        FlairCbcSquadEdicaoRepository edicoes = kit.dep(FlairCbcSquadEdicaoRepository.class);
        assertThat(service.entregar(ana, "DESAFIO_FOGO", fogoVermelho(ana))).containsEntry("edicao", 1);
        // a conclusão da Ana ainda não aparece para a transação da Bia: pela maior edição gravada, a Bia também levaria a 1
        entregas.deleteAll();
        assertThat(service.entregar(bia, "DESAFIO_FOGO", fogoVermelho(bia))).containsEntry("edicao", 2);
        assertThat(service.entregar(bia, "DESAFIO_FOGO", fogoVermelho(bia))).containsEntry("edicao", 2);
        assertThat(edicoes.findByElenco("DESAFIO_FOGO").orElseThrow().getUltima()).isEqualTo(2);
        assertThat(edicoes.findByElenco("DESAFIO_VERDE_FLORESTAL")).isEmpty();
    }

    @Test
    void elencoSemContadorComecaDaMaiorEdicaoJaDada() {
        FlairCbcSquadEntrega antiga = new FlairCbcSquadEntrega();
        antiga.setUserId(UUID.randomUUID());
        antiga.setElenco("DESAFIO_FOGO");
        antiga.setCartasJson("{}");
        antiga.setOk(true);
        antiga.setEdicao(5);
        kit.save(FlairCbcSquadEntregaRepository.class, antiga);
        assertThat(service.entregar(ana, "DESAFIO_FOGO", fogoVermelho(ana))).containsEntry("edicao", 6);
        List<FlairCbcSquadEdicao> contadores = MemoryRepository.rows(kit.dep(FlairCbcSquadEdicaoRepository.class));
        assertThat(contadores).hasSize(1);
        assertThat(contadores.get(0).getElenco()).isEqualTo("DESAFIO_FOGO");
        assertThat(contadores.get(0).getUltima()).isEqualTo(6);
    }
}
