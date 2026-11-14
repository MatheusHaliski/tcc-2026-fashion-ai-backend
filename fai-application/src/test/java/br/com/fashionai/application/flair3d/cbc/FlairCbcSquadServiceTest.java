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

    /** O Primeiro Elenco cheio com cartas da pessoa, todas da mesma marca (todas as linhas verdes). */
    FlairCbcSquadService.Pedido primeiro(CurrentUser dono, String marca) {
        Map<String, UUID> cartas = new LinkedHashMap<>();
        for (FlairCbcElenco.Vaga v : FlairCbcElencos.porCodigo("PRIMEIRO_ELENCO").orElseThrow().vagas()) {
            cartas.put(v.chave(), kit.save(FlairCardInstanceRepository.class,
                    Flair3dFixtures.instance(dono.id(), v.posicao(), "brand:" + marca + v.chave())).getId());
        }
        return new FlairCbcSquadService.Pedido(cartas);
    }

    FlairCbcSquadService.Pedido primeiroVerde(CurrentUser dono) {
        Map<String, UUID> cartas = new LinkedHashMap<>();
        for (FlairCbcElenco.Vaga v : FlairCbcElencos.porCodigo("PRIMEIRO_ELENCO").orElseThrow().vagas()) {
            cartas.put(v.chave(), kit.save(FlairCardInstanceRepository.class,
                    Flair3dFixtures.instance(dono.id(), v.posicao(), "brand:Farm")).getId());
        }
        return new FlairCbcSquadService.Pedido(cartas);
    }

    @Test
    @SuppressWarnings("unchecked")
    void formacaoTrazVagasLinhasERequisitos() {
        Map<String, Object> f = service.formacao("primeiro_elenco");
        assertThat((List<FlairCbcElenco.Vaga>) f.get("vagas")).first().isEqualTo(new FlairCbcElenco.Vaga("acessorio", "ACE", 0, 0));
        assertThat((List<Map<String, Object>>) f.get("linhas")).hasSize(5).first().isEqualTo(Map.of("a", "acessorio", "b", "cima"));
        assertThat((List<Map<String, Object>>) f.get("requisitos")).first().isEqualTo(Map.of("tipo", "QUIMICA", "alvo", 40));
        assertThat(catchThrowableOfType(ApiException.class, () -> service.formacao("XADREZ")).status()).isEqualTo(404);
    }

    @Test
    void conferirSoComCartasDaPessoa() {
        FlairCbcSquadService.Pedido daBia = primeiroVerde(bia);
        ApiException e = catchThrowableOfType(ApiException.class, () -> service.conferir(ana, "PRIMEIRO_ELENCO", daBia));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("CARTA_ALHEIA");
        assertThat(service.conferir(bia, "PRIMEIRO_ELENCO", daBia)).containsEntry("ok", true).containsEntry("quimica", 67);
        FlairCbcSquadService.Pedido vagaErrada = new FlairCbcSquadService.Pedido(Map.of("goleiro", daBia.cartas().get("cima")));
        assertThat(catchThrowableOfType(ApiException.class, () -> service.conferir(bia, "PRIMEIRO_ELENCO", vagaErrada)).code())
                .isEqualTo("ENTREGA_INVALIDA");
    }

    @Test
    void entregaComRequisitoFalhandoE422ENaoGrava() {
        ApiException e = catchThrowableOfType(ApiException.class, () -> service.entregar(ana, "PRIMEIRO_ELENCO", primeiro(ana, "M")));
        assertThat(e.status()).isEqualTo(422);
        assertThat(e.code()).isEqualTo("REQUISITOS_NAO_CUMPRIDOS");
        assertThat(e.details()).containsKey("requisitos");
        assertThat(MemoryRepository.<FlairCbcSquadEntrega>rows(kit.dep(FlairCbcSquadEntregaRepository.class))).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void edicaoEhAOrdemDeConclusaoERepetirNaoCriaNova() {
        assertThat(service.entregar(ana, "PRIMEIRO_ELENCO", primeiroVerde(ana))).containsEntry("edicao", 1).containsEntry("ok", true);
        assertThat(service.entregar(bia, "PRIMEIRO_ELENCO", primeiroVerde(bia))).containsEntry("edicao", 2);
        assertThat(service.entregar(ana, "PRIMEIRO_ELENCO", primeiroVerde(ana))).containsEntry("edicao", 1);
        List<FlairCbcSquadEntrega> salvas = MemoryRepository.rows(kit.dep(FlairCbcSquadEntregaRepository.class));
        assertThat(salvas).hasSize(3).extracting(FlairCbcSquadEntrega::getEdicao).containsExactly(1, 2, 1);
        assertThat(salvas.get(0).getQuimica()).isEqualTo(67);

        List<Map<String, Object>> lista = (List<Map<String, Object>>) service.lista(bia).get("elencos");
        assertThat(lista).hasSize(5);
        assertThat(lista.get(0)).containsEntry("codigo", "PRIMEIRO_ELENCO").containsEntry("vagas", 5).containsEntry("linhas", 5)
                .containsEntry("concluido", true).containsEntry("edicao", 2);
        assertThat(lista.get(1)).containsEntry("concluido", false).containsEntry("edicao", null);
    }

    @Test
    void edicaoSaiDoContadorDoElencoMesmoQuandoALeituraDasConclusoesEstaAtrasada() {
        FlairCbcSquadEntregaRepository entregas = kit.dep(FlairCbcSquadEntregaRepository.class);
        FlairCbcSquadEdicaoRepository edicoes = kit.dep(FlairCbcSquadEdicaoRepository.class);
        assertThat(service.entregar(ana, "PRIMEIRO_ELENCO", primeiroVerde(ana))).containsEntry("edicao", 1);
        // a conclusão da Ana ainda não aparece para a transação da Bia: pela maior edição gravada, a Bia também levaria a 1
        entregas.deleteAll();
        assertThat(service.entregar(bia, "PRIMEIRO_ELENCO", primeiroVerde(bia))).containsEntry("edicao", 2);
        assertThat(service.entregar(bia, "PRIMEIRO_ELENCO", primeiroVerde(bia))).containsEntry("edicao", 2);
        assertThat(edicoes.findByElenco("PRIMEIRO_ELENCO").orElseThrow().getUltima()).isEqualTo(2);
        assertThat(edicoes.findByElenco("PALETA_ATELIE")).isEmpty();
    }

    @Test
    void elencoSemContadorComecaDaMaiorEdicaoJaDada() {
        FlairCbcSquadEntrega antiga = new FlairCbcSquadEntrega();
        antiga.setUserId(UUID.randomUUID());
        antiga.setElenco("PRIMEIRO_ELENCO");
        antiga.setCartasJson("{}");
        antiga.setOk(true);
        antiga.setEdicao(5);
        kit.save(FlairCbcSquadEntregaRepository.class, antiga);
        assertThat(service.entregar(ana, "PRIMEIRO_ELENCO", primeiroVerde(ana))).containsEntry("edicao", 6);
        List<FlairCbcSquadEdicao> contadores = MemoryRepository.rows(kit.dep(FlairCbcSquadEdicaoRepository.class));
        assertThat(contadores).hasSize(1);
        assertThat(contadores.get(0).getElenco()).isEqualTo("PRIMEIRO_ELENCO");
        assertThat(contadores.get(0).getUltima()).isEqualTo(6);
    }
}
