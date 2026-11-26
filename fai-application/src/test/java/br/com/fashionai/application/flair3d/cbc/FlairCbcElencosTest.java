package br.com.fashionai.application.flair3d.cbc;

import br.com.fashionai.application.flair.CbcRules;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static org.assertj.core.api.Assertions.assertThat;

/** FLAIR CBC — os elencos em quebra-cabeça: catálogo, peças que encaixam pela vaga e os requisitos de cada deck. */
class FlairCbcElencosTest {

    static FlairCbcElenco elenco(String codigo) {
        return FlairCbcElencos.porCodigo(codigo).orElseThrow();
    }

    /** Uma carta por vaga com as etiquetas dadas. */
    static Map<String, CbcRules.Card> cheio(FlairCbcElenco e, String... etiquetas) {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        e.vagas().forEach(v -> board.put(v.chave(), card("SUP", etiquetas)));
        return board;
    }

    /** Uma carta por vaga com exatamente o que a vaga pede (e as etiquetas extras). */
    static Map<String, CbcRules.Card> certo(FlairCbcElenco e, String... extras) {
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        int i = 0;
        for (FlairCbcElenco.Vaga v : e.vagas()) {
            List<String> tags = new java.util.ArrayList<>(List.of(extras));
            tags.add("brand:M" + (i++ % 4));
            v.pede().forEach((campo, valores) -> tags.add(campo + ":" + ((List<?>) valores).get(0)));
            board.put(v.chave(), card("INF", tags.toArray(String[]::new)));
        }
        return board;
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> requisito(Map<String, Object> out, String tipo) {
        return ((List<Map<String, Object>>) out.get("requisitos")).stream().filter(r -> tipo.equals(r.get("tipo"))).findFirst().orElseThrow();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Boolean> pecas(Map<String, Object> out) {
        return (Map<String, Boolean>) out.get("pecas");
    }

    @Test
    void catalogoDoMaisSimplesAoMaisDificilComAsPecasDeCadaImagem() {
        Map<String, Integer> esperado = Map.of("DESAFIO_FOGO", 4, "DESAFIO_VERDE_FLORESTAL", 4, "DESAFIO_AZUL_TECH", 4,
                "DESAFIO_FASHIONAI_TECH", 4, "CELEBRACAO_ARENA", 6, "LOGO_QUEBRA_CABECA", 12, "LOGO_SETORES", 12, "LOGO_TEAL", 12,
                "LOGO_CACOS", 12, "LOGO_PECAS_FALTANDO", 16);
        assertThat(FlairCbcElencos.TODOS).extracting(FlairCbcElenco::codigo).containsExactly("DESAFIO_FOGO", "DESAFIO_VERDE_FLORESTAL",
                "DESAFIO_AZUL_TECH", "DESAFIO_FASHIONAI_TECH", "CELEBRACAO_ARENA", "LOGO_QUEBRA_CABECA", "LOGO_SETORES", "LOGO_TEAL",
                "LOGO_CACOS", "LOGO_PECAS_FALTANDO");
        for (FlairCbcElenco e : FlairCbcElencos.TODOS) {
            assertThat(e.vagas()).as(e.codigo()).hasSize(esperado.get(e.codigo()));
            Set<String> chaves = new HashSet<>();
            e.vagas().forEach(v -> chaves.add(v.chave()));
            assertThat(chaves).hasSize(e.vagas().size());
            assertThat(e.vagas()).extracting(FlairCbcElenco.Vaga::chave).startsWith("p1", "p2");
            assertThat(e.vagas()).allMatch(v -> "ANY".equals(v.posicao()));
            assertThat(e.requisitosCompletos()).as(e.codigo()).anyMatch(r -> "CARTAS".equals(r.tipo()) && r.alvo() == e.vagas().size());
            // cada deck se completa com as cartas certas: todas as peças encaixam e os requisitos fecham
            Map<String, Object> out = FlairCbcAvaliacao.conferir(e, certo(e));
            assertThat(out).as(e.codigo()).containsEntry("ok", true).containsEntry("completas", e.vagas().size());
        }
        assertThat(elenco("LOGO_QUEBRA_CABECA").vagas()).filteredOn(v -> !v.pede().isEmpty()).hasSize(6);
    }

    @Test
    void fogoPedeTodasAsPecasVermelhasEAPecaSoEncaixaComCartaVermelha() {
        FlairCbcElenco e = elenco("DESAFIO_FOGO");
        assertThat(FlairCbcAvaliacao.conferir(e, Map.of())).containsEntry("completas", 0).containsEntry("ok", false);
        Map<String, CbcRules.Card> board = new LinkedHashMap<>();
        board.put("p1", card("SUP", "color:crimson"));
        board.put("p2", card("INF", "color:blue"));
        Map<String, Object> parcial = FlairCbcAvaliacao.conferir(e, board);
        assertThat(pecas(parcial)).containsEntry("p1", true).containsEntry("p2", false).containsEntry("p3", false);
        assertThat(requisito(parcial, "COR")).containsEntry("ok", false).containsEntry("valor", 1).containsEntry("alvo", 4);
        Map<String, Object> cheio = FlairCbcAvaliacao.conferir(e, cheio(e, "color:red"));
        assertThat(cheio).containsEntry("ok", true).containsEntry("completas", 4).containsEntry("total", 4);
        assertThat(requisito(cheio, "CARTAS")).containsEntry("ok", true).containsEntry("valor", 4);
    }

    @Test
    void verdeFlorestalPedeTresVerdesEAQuartaPecaAceitaQualquerCarta() {
        FlairCbcElenco e = elenco("DESAFIO_VERDE_FLORESTAL");
        Map<String, CbcRules.Card> board = cheio(e, "color:green");
        board.put("p4", card("CAL", "color:black"));
        assertThat(FlairCbcAvaliacao.conferir(e, board)).containsEntry("ok", true);
        board.put("p2", card("CAL", "color:black"));
        Map<String, Object> out = FlairCbcAvaliacao.conferir(e, board);
        assertThat(pecas(out)).containsEntry("p2", false).containsEntry("p4", true);
        assertThat(requisito(out, "COR")).containsEntry("ok", false).containsEntry("valor", 2);
    }

    @Test
    void azulTechPedeUmaAzulEFashionAiTechTodasModernas() {
        FlairCbcElenco azul = elenco("DESAFIO_AZUL_TECH");
        Map<String, CbcRules.Card> board = cheio(azul, "color:white");
        assertThat(FlairCbcAvaliacao.conferir(azul, board)).containsEntry("ok", false);
        board.put("p1", card("ACE", "color:navy"));
        assertThat(FlairCbcAvaliacao.conferir(azul, board)).containsEntry("ok", true);
        FlairCbcElenco tech = elenco("DESAFIO_FASHIONAI_TECH");
        assertThat(FlairCbcAvaliacao.conferir(tech, cheio(tech, "style:modern"))).containsEntry("ok", true);
        Map<String, CbcRules.Card> quase = cheio(tech, "style:modern");
        quase.put("p3", card("SUP", "style:classic"));
        assertThat(requisito(FlairCbcAvaliacao.conferir(tech, quase), "ESTILO")).containsEntry("ok", false).containsEntry("valor", 3);
    }

    @Test
    void arenaPedeFestaELogoPecasFaltandoPedeTresMarcas() {
        FlairCbcElenco arena = elenco("CELEBRACAO_ARENA");
        assertThat(arena.vagas().get(0).pede()).isEqualTo(Map.of("occasion", List.of("party")));
        assertThat(requisito(FlairCbcAvaliacao.conferir(arena, cheio(arena, "occasion:party")), "OCASIAO")).containsEntry("valor", 6);
        FlairCbcElenco logo = elenco("LOGO_PECAS_FALTANDO");
        Map<String, CbcRules.Card> board = certo(logo);
        board.replaceAll((k, c) -> card("SUP", c.colors().stream().map(x -> "color:" + x).toArray(String[]::new)));
        Map<String, Object> umaMarca = FlairCbcAvaliacao.conferir(logo, board);
        assertThat(umaMarca).containsEntry("completas", 16).containsEntry("ok", false);
        assertThat(requisito(umaMarca, "MARCAS")).containsEntry("ok", false);
    }
}
