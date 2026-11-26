package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dCartas;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Flair3dNucleoService;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoPerfil;
import br.com.fashionai.application.flair3d.recurso.Flair3dRecursoUso;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairCardInstance;
import br.com.fashionai.domain.repository.FlairCardInstanceRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A regra peça-recurso dentro da comparação de cada rodada da Batalha de Looks: o look soma para os dois lados pela
 * mesma conta, o foco da peça gasta vale só na rodada em que foi usada, e a peça gasta e vestida na mesma rodada não
 * conta. Pelo serviço: o uso depois da primeira entrega cai na segunda rodada e o selo da carta segue o desafio da vez.
 */
class BatalhaLooksPlacarTest {
    private static final BatalhaLooksRodadas.Desafio AZUL = BatalhaLooksRodadas.MONOCROMATICOS.get(0);

    private static UsoDeRecurso foco(CbcRules.Card carta, int quantidade, int etapa) {
        return new UsoDeRecurso(carta.id(), "FOCO", quantidade, "p" + etapa + carta.id(), 0, etapa);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> placar(Resultado r) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("RODADA_DA_BATALHA")).findFirst().orElseThrow().valor();
    }

    @Test
    void oLookSomaParaOsDoisLadosPelaMesmaContaEANotaParaEm100() {
        Map<String, CbcRules.Card> casa = Map.of("SUP", Flair3dFixtures.card("SUP", "color:blue", "sub:blazer", "material:silk", "occasion:party"));
        BatalhaLooksPlacar.Nota daCasa = BatalhaLooksPlacar.daCasa(AZUL, casa);
        BatalhaLooksPlacar.DaPessoa voce = BatalhaLooksPlacar.daPessoa(AZUL, casa, List.of(), 1);
        assertThat(daCasa.regra()).isEqualTo(25);
        assertThat(daCasa.recurso()).isZero();
        assertThat(daCasa.look()).isBetween(0, Flair3dRecursoPerfil.TETO_DOS_ATRIBUTOS).isEqualTo(voce.nota().look());
        assertThat(voce.nota().total()).isEqualTo(daCasa.total());
        assertThat(voce.regras()).extracting(RegraResultado::codigo).containsSubsequence("NA_REGRA_SUP", "SEM_PECA_PROIBIDA", "LOOK_ATRIBUTOS", "RECURSO_DO_JOGO");
        assertThat(new BatalhaLooksPlacar.Nota(100, 10, 5).total()).isEqualTo(100);
    }

    @Test
    void oFocoValeSoNaRodadaEmQueAPecaFoiGastaEAPecaGastaNaoContaVestida() {
        CbcRules.Card sup = Flair3dFixtures.card("SUP", "color:blue");
        CbcRules.Card inf = Flair3dFixtures.card("INF", "color:blue");
        CbcRules.Card reserva = Flair3dFixtures.card("ACE", "color:red");
        Map<String, CbcRules.Card> look = new LinkedHashMap<>();
        look.put("SUP", sup);
        look.put("INF", inf);
        // 15 de foco na rodada 2: metade do teto; na rodada 1 e na 3 não vale nada
        List<UsoDeRecurso> usos = List.of(foco(reserva, 15, 1));
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, usos, 1).nota().recurso()).isZero();
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, usos, 2).nota().recurso()).isEqualTo(3);
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, usos, 3).nota().recurso()).isZero();
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, List.of(foco(reserva, 15, 1), foco(inf, 40, 1)), 2).nota().recurso()).isEqualTo(5);
        // a peça gasta e vestida na mesma rodada fica cansada: sai da regra (50 vira 25); na rodada seguinte volta
        BatalhaLooksPlacar.DaPessoa cansada = BatalhaLooksPlacar.daPessoa(AZUL, look, List.of(foco(inf, 15, 0)), 1);
        assertThat(cansada.cansadas()).containsExactly("INF");
        assertThat(cansada.nota().regra()).isEqualTo(25);
        assertThat(BatalhaLooksPlacar.daPessoa(AZUL, look, List.of(foco(inf, 15, 0)), 2).nota().regra()).isEqualTo(50);
    }

    @Test
    void aPecaQueDesfilouNaRodadaAnteriorEAGastaComoRecursoNaoContamJuntas() {
        CbcRules.Card sup = Flair3dFixtures.card("SUP", "color:blue");
        CbcRules.Card inf = Flair3dFixtures.card("INF", "color:blue");
        CbcRules.Card cal = Flair3dFixtures.card("CAL", "color:blue");
        Map<String, CbcRules.Card> look = new LinkedHashMap<>();
        look.put("SUP", sup);
        look.put("INF", inf);
        look.put("CAL", cal);
        // SUP desfilou na rodada 1 (não está entre as descansadas); INF foi gasta como recurso na rodada 2
        Map<String, CbcRules.Card> descansadas = new LinkedHashMap<>(look);
        descansadas.remove("SUP");
        BatalhaLooksPlacar.DaPessoa voce = BatalhaLooksPlacar.daPessoa(AZUL, look, descansadas, List.of(foco(inf, 15, 1)), 2);
        assertThat(voce.cansadas()).containsExactly("SUP", "INF");
        assertThat(voce.nota().regra()).isEqualTo(25);
        assertThat(voce.nota().recurso()).isEqualTo(3);
    }

    @Test
    @SuppressWarnings("unchecked")
    void peloServicoOUsoDepoisDaEntregaCaiNaRodadaSeguinteEOSeloSegueODesafioDaVez() {
        Kit kit = new Kit();
        CurrentUser ana = Kit.as(kit.save(UserRepository.class, Kit.user("ana")));
        kit.real(Flair3dCartas.class);
        Flair3dNucleoService service = kit.build(Flair3dNucleoService.class);
        Flair3dRecursoUso uso = kit.build(Flair3dRecursoUso.class);
        FlairCardInstance sup = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), "SUP", "color:blue", "occasion:formal", "material:wool"));
        FlairCardInstance inf = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), "INF", "color:blue"));
        FlairCardInstance cal = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), "CAL", "color:blue"));
        // a peça de reserva: uma camisa de algodão, que a tabela peça-recurso dá como foco
        FlairCardInstance reserva = kit.save(FlairCardInstanceRepository.class, Flair3dFixtures.instance(ana.id(), "SUP", "sub:shirt", "material:cotton", "occasion:work"));
        List<UUID> deck = List.of(sup.getId(), inf.getId(), cal.getId(), reserva.getId());
        UUID id = (UUID) service.abrir(ana, "BATALHA_LOOKS", new Flair3dNucleoService.AbrirPartida(deck, null, "BATALHA_DE_3_RODADAS")).get("id");
        Entrega look = new Entrega(Map.of("SUP", sup.getId(), "INF", inf.getId(), "CAL", cal.getId()), null, null, null);
        Flair3dNucleoService.PedidoEfeitos selos = new Flair3dNucleoService.PedidoEfeitos(List.of(sup.getId()), null, id);

        Object seloDaPrimeira = service.efeitos(ana, "BATALHA_LOOKS", selos);
        Resultado primeira = service.entregar(ana, id, look);
        assertThat(((Map<String, Map<String, Object>>) placar(primeira).get("conta")).get("voce").get("recurso")).isEqualTo(0);
        // dentro da partida o selo já diz se a carta entra no desafio da vez (nunca "conforme o pedido da vez")
        for (Object s : List.of(seloDaPrimeira, service.efeitos(ana, "BATALHA_LOOKS", selos))) {
            List<Efeito> itens = (List<Efeito>) ((List<Map<String, Object>>) ((Map<String, Object>) s).get("efeitos")).get(0).get("itens");
            assertThat(itens).extracting(Efeito::codigo).doesNotContain(Efeito.CONFORME_A_ETAPA).containsAnyOf("NA_REGRA", "FORA_DA_REGRA", "PECA_PROIBIDA");
        }

        Map<String, Object> usado = (Map<String, Object>) uso.usar(ana, id, new Flair3dRecursoUso.PedidoDeUso(reserva.getId(), "toque-1")).get("uso");
        assertThat(usado.get("recurso")).isEqualTo("FOCO");
        Resultado segunda = service.entregar(ana, id, look);
        Map<String, Map<String, Object>> conta = (Map<String, Map<String, Object>>) placar(segunda).get("conta");
        assertThat((int) conta.get("voce").get("recurso")).isBetween(1, Flair3dRecursoPerfil.TETO_DO_RECURSO);
        assertThat(conta.get("adversario").get("recurso")).isEqualTo(0);
        assertThat(((Number) placar(segunda).get("voce")).intValue())
                .isEqualTo(Math.min(100, (int) conta.get("voce").get("regra") + (int) conta.get("voce").get("look") + (int) conta.get("voce").get("recurso")));

        // o resultado final traz as três rodadas, uma a uma, com o look da casa de cada uma
        // a terceira entrega pede a execução no percurso; cumprida, a partida fecha
        Resultado fim = service.acionar(ana, id, Flair3dFixtures.perfeita(service.entregar(ana, id, look)));
        assertThat(fim.status()).isEqualTo("ENTREGUE");
        assertThat(fim.eventos().stream().filter(e -> e.codigo().equals("RODADA_DA_BATALHA")).map(e -> ((Map<String, Object>) e.valor()).get("rodada")))
                .containsExactly(1, 2, 3);
    }
}
