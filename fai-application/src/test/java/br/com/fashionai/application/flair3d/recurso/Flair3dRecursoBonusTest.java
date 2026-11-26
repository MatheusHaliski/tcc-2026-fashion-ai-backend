package br.com.fashionai.application.flair3d.recurso;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Andamento.UsoDeRecurso;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** O look e os recursos na nota: até 10 pelos atributos pedidos, até 5 pelo recurso-vida, sem passar de 100. */
class Flair3dRecursoBonusTest {
    private static CbcRules.Card carta(String vaga, String sub, Set<String> materiais, Set<String> cores) {
        return new CbcRules.Card(UUID.randomUUID(), vaga, "BRONZE", 92, null, "SEED", Set.of(), cores, Set.of(), materiais, Map.of(), null, null, null, sub);
    }

    private static Resultado reprovado(int pontos) {
        return Resultado.of(pontos, "REPROVADO", List.of(RegraResultado.de("TEMA", true, pontos)), List.of());
    }

    @Test
    void oLookDeCarismaEOFocoUsadoViramPontosNaPassarelaEPodemAprovar() {
        Map<String, CbcRules.Card> look = Map.of("CAL", carta("CAL", "heels", Set.of("satin"), Set.of("white")),
                "SUP", carta("SUP", "blouse", Set.of("silk"), Set.of("white")));
        List<UsoDeRecurso> foco = List.of(new UsoDeRecurso(UUID.randomUUID(), "FOCO", 30, "p1"));
        Resultado r = Flair3dRecursoBonus.aplicar("PASSARELA", reprovado(55), look, foco);
        assertThat(r.regras()).extracting(RegraResultado::codigo).containsExactly("TEMA", "LOOK_ATRIBUTOS", "RECURSO_DO_JOGO");
        int look10 = (int) r.regras().get(1).pontos();
        int recurso5 = (int) r.regras().get(2).pontos();
        assertThat(look10).isBetween(1, Flair3dRecursoPerfil.TETO_DOS_ATRIBUTOS);
        // foco de 40 para 70: metade do caminho até 100, metade dos 5 pontos
        assertThat(recurso5).isEqualTo(3);
        assertThat(r.pontos()).isEqualTo(55 + look10 + recurso5);
        assertThat(r.resultado()).isEqualTo(r.pontos() >= 60 ? "APROVADO" : "REPROVADO");
        assertThat(r.estrelas()).isEqualTo(Resultado.estrelas(r.pontos()));
    }

    @Test
    void nuncaPassaDe100NaoMexeNoMeioDaAcaoNemEmJogoForaDaTabela() {
        Map<String, CbcRules.Card> look = Map.of("CAL", carta("CAL", "heels", Set.of("satin", "sequin"), Set.of("white")));
        assertThat(Flair3dRecursoBonus.aplicar("PASSARELA", reprovado(99), look, List.of()).pontos()).isEqualTo(100);
        Resultado emAcao = Resultado.parcial(Resultado.EM_ACAO, "EM_ACAO", List.of(), List.of());
        assertThat(Flair3dRecursoBonus.aplicar("PASSARELA", emAcao, look, List.of())).isSameAs(emAcao);
        Resultado batalha = reprovado(55);
        assertThat(Flair3dRecursoBonus.aplicar("BATALHA_LOOKS", batalha, look, List.of())).isSameAs(batalha);
        Resultado falhou = Resultado.of(0, "NAO_ABRE", List.of(), List.of()).comStatus(Resultado.ABERTA);
        assertThat(Flair3dRecursoBonus.aplicar("LABIRINTO", falhou, look, List.of())).isSameAs(falhou);
    }

    @Test
    void moedasDaBoutiqueContamUmPontoACadaDuas() {
        EnumMapHelper.assertMoedas();
    }

    /** Separado para ler as moedas sem montar uma partida. */
    private static final class EnumMapHelper {
        static void assertMoedas() {
            List<UsoDeRecurso> usos = List.of(new UsoDeRecurso(UUID.randomUUID(), "MOEDAS", 10, "a"), new UsoDeRecurso(UUID.randomUUID(), "MOEDAS", 10, "b"));
            assertThat(Flair3dRecursoBonus.peloRecurso(PecaRecurso.Recurso.MOEDAS, Flair3dRecursoEstado.de(usos))).isEqualTo(5);
            assertThat(Flair3dRecursoBonus.peloRecurso(PecaRecurso.Recurso.MOEDAS, Flair3dRecursoEstado.de(usos.subList(0, 1)))).isEqualTo(5);
            assertThat(Flair3dRecursoBonus.peloRecurso(PecaRecurso.Recurso.MOEDAS, Flair3dRecursoEstado.de(List.of()))).isZero();
        }
    }
}
