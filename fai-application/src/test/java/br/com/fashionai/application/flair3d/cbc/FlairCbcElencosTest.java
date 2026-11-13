package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair.CbcRules;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR CBC — as cinco formações (vagas e linhas do contrato), a cor das linhas e os requisitos de cada elenco. */
class FlairCbcElencosTest {

    static FlairCbcElenco elenco(String codigo) {
        return FlairCbcElencos.porCodigo(codigo).orElseThrow();
    }

    /** Uma carta por vaga, na posição dela, com as etiquetas dadas. */
    static Map<String, CbcRules.Card> cheio(FlairCbcElenco e, String... etiquetas) {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        e.vagas().forEach(v -> board.put(v.chave(), card(v.posicao(), etiquetas)));
        return board;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> requisito(Map<String, Object> out, String tipo) {
        return ((List<Map<String, Object>>) out.get("requisitos")).stream().filter(r -> tipo.equals(r.get("tipo"))).findFirst().orElseThrow();
    }

    @Test
    void formacoesTemAsVagasEAsLinhasDoContrato() {
        Map<String, int[]> esperado = Map.of("PRIMEIRO_ELENCO", new int[]{5, 5}, "PALETA_ATELIE", new int[]{7, 9},
                "CASA_MARCA", new int[]{9, 12}, "NOITE_ESTREIA", new int[]{9, 13}, "ELENCO_LENDARIO", new int[]{11, 17});
        assertThat(FlairCbcElencos.TODOS).extracting(FlairCbcElenco::codigo)
                .containsExactly("PRIMEIRO_ELENCO", "PALETA_ATELIE", "CASA_MARCA", "NOITE_ESTREIA", "ELENCO_LENDARIO");
        for (FlairCbcElenco e : FlairCbcElencos.TODOS) {
            assertThat(e.vagas()).as(e.codigo()).hasSize(esperado.get(e.codigo())[0]);
            assertThat(e.linhas()).as(e.codigo()).hasSize(esperado.get(e.codigo())[1]).doesNotHaveDuplicates();
            Set<String> chaves = new HashSet<>();
            e.vagas().forEach(v -> chaves.add(v.chave()));
            assertThat(chaves).hasSize(e.vagas().size());
            assertThat(e.linhas()).allMatch(l -> chaves.contains(l.a()) && chaves.contains(l.b()));
            Set<String> coordenadas = new HashSet<>();
            e.vagas().forEach(v -> coordenadas.add(v.coluna() + "," + v.linha()));
            assertThat(coordenadas).as("coordenadas únicas em " + e.codigo()).hasSize(e.vagas().size());
        }
        assertThat(elenco("NOITE_ESTREIA").linhas()).filteredOn(l -> l.a().equals("ves") || l.b().equals("ves")).hasSize(4);
        assertThat(elenco("PRIMEIRO_ELENCO").vagas()).extracting(FlairCbcElenco.Vaga::posicao).containsExactly("ACE", "SUP", "ACE", "INF", "CAL");
    }

    @Test
    @SuppressWarnings("unchecked")
    void corDaLinhaVemDaForcaDoLink() {
        FlairCbcElenco e = elenco("PRIMEIRO_ELENCO");
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("acessorio", card("ACE", "brand:Farm"));
        board.put("cima", card("SUP", "brand:Farm", "style:boho"));
        board.put("bolsa", card("ACE", "style:boho"));
        board.put("baixo", card("INF", "color:red"));
        Map<String, Object> out = FlairCbcAvaliacao.conferir(e, board);
        List<Map<String, Object>> links = (List<Map<String, Object>>) out.get("links");
        assertThat(links).hasSize(4);
        assertThat(links.get(0)).containsEntry("a", "acessorio").containsEntry("forca", 2).containsEntry("nivel", "VERDE")
                .containsEntry("atributos", List.of("MARCA"));
        assertThat(links.get(1)).containsEntry("nivel", "LARANJA").containsEntry("atributos", List.of("ESTILO"));
        assertThat(links.get(2)).containsEntry("b", "baixo").containsEntry("nivel", "VERMELHA");
        assertThat((Map<String, Integer>) out.get("quimicaCartas")).containsEntry("acessorio", 1).containsEntry("calcado", 0);
        assertThat(out).containsEntry("ok", false);
    }

    @Test
    void primeiroElencoCumpreComMesmaMarcaEFalhaSemLinhas() {
        FlairCbcElenco e = elenco("PRIMEIRO_ELENCO");
        Map<String, Object> ok = FlairCbcAvaliacao.conferir(e, cheio(e, "brand:Farm"));
        assertThat(ok).containsEntry("ok", true).containsEntry("quimica", 67);
        assertThat(requisito(ok, "LINHAS_VERDES")).containsEntry("valor", 5).containsEntry("alvo", 2);
        assertThat(requisito(ok, "CARTAS")).containsEntry("alvo", 5).containsEntry("ok", true);
        Map<String, CbcRules.Card> soltas = new LinkedHashMap<>();
        e.vagas().forEach(v -> soltas.put(v.chave(), card(v.posicao(), "brand:M" + v.chave())));
        Map<String, Object> falha = FlairCbcAvaliacao.conferir(e, soltas);
        assertThat(falha).containsEntry("ok", false).containsEntry("quimica", 0);
        assertThat(requisito(falha, "QUIMICA")).containsEntry("ok", false);
    }

    @Test
    void casaMarcaPedeLinhasPorMarcaMarcasDistintasECartaOuro() {
        FlairCbcElenco e = elenco("CASA_MARCA");
        Map<String, CbcRules.Card> board = cheio(e, "brand:Farm", "style:classic");
        assertThat(requisito(FlairCbcAvaliacao.conferir(e, board), "MARCAS")).containsEntry("ok", false).containsEntry("valor", 1);
        assertThat(requisito(FlairCbcAvaliacao.conferir(e, board), "NIVEL_CARTA")).containsEntry("ok", false);
        board.put("cal", card("CAL", "brand:Osklen", "style:classic", "tier:OURO"));
        Map<String, Object> out = FlairCbcAvaliacao.conferir(e, board);
        assertThat(requisito(out, "MARCAS")).containsEntry("ok", true).containsEntry("valor", 2);
        assertThat(requisito(out, "NIVEL_CARTA")).containsEntry("ok", true);
        assertThat(requisito(out, "LINHAS_POR")).containsEntry("ok", true);
        assertThat(out).containsEntry("ok", true);
    }

    @Test
    void noiteEstreiaExigeAVesPreenchidaESemLinhaVermelha() {
        FlairCbcElenco e = elenco("NOITE_ESTREIA");
        Map<String, CbcRules.Card> board = cheio(e, "brand:Farm", "occasion:party");
        assertThat(FlairCbcAvaliacao.conferir(e, board)).containsEntry("ok", true);
        board.remove("ves");
        assertThat(requisito(FlairCbcAvaliacao.conferir(e, board), "SEM_LINHA_VERMELHA")).containsEntry("ok", false);
        board.put("ves", card("VES", "brand:Outra"));
        assertThat(requisito(FlairCbcAvaliacao.conferir(e, board), "SEM_LINHA_VERMELHA")).containsEntry("ok", false).containsEntry("valor", 4);
    }

    @Test
    void lendarioPedeQuimica100DuasEspeciaisEQuatroMarcas() {
        FlairCbcElenco e = elenco("ELENCO_LENDARIO");
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        String[] marcas = {"A", "B", "C", "D"};
        int i = 0;
        for (FlairCbcElenco.Vaga v : e.vagas()) {
            String tier = i < 2 ? "tier:ESPECIAL" : "tier:PRATA";
            board.put(v.chave(), card(v.posicao(), "brand:" + marcas[i % 4], "style:classic", "occasion:party", "color:black", tier));
            i++;
        }
        Map<String, Object> out = FlairCbcAvaliacao.conferir(e, board);
        assertThat(requisito(out, "MARCAS")).containsEntry("ok", true);
        assertThat(requisito(out, "NIVEL_CARTA")).containsEntry("ok", true).containsEntry("valor", 2);
        assertThat(requisito(out, "SEM_LINHA_VERMELHA")).containsEntry("ok", true);
        // cada carta tem no máximo 4 linhas verdes, mas as de canto só 2: a química 100 exige mais linhas que a formação dá
        assertThat(out.get("quimica")).isEqualTo(CbcLinks.evaluate(FlairCbcAvaliacao.slots(e), e.linhas(), board).squadChemistry());
    }
}
