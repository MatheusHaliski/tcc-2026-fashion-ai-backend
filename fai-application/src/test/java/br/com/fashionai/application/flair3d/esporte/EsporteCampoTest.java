package br.com.fashionai.application.flair3d.esporte;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
import br.com.fashionai.application.flair3d.Andamento;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dFixtures;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.nucleos.FashionSportsNucleo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * O que o servidor decide sobre quem não tem a bola e sobre os reinícios (pedido da dona de 15/11/2026): cada lance do
 * futebol e do basquete leva o estado e o destino de todos os jogadores, ninguém termina em cima de ninguém, quem
 * pressiona fica do lado do próprio gol, o goleiro não sai da meta, e a bola volta ao jogo do lugar certo (centro,
 * pequena área, canto, linha lateral). A bola na trave só existe onde há trave.
 */
class EsporteCampoTest {
    final CbcRules.Card sup = card("SUP", "ovr:70", "material:cotton");
    final CbcRules.Card inf = card("INF", "ovr:70");
    final CbcRules.Card cal = card("CAL", "ovr:70", "sub:running_shoes");
    final CbcRules.Card[] deck = {sup, inf, cal,
            card("ACE", "color:red", "ovr:60"), card("CAL", "color:blue", "ovr:60"), card("ACE", "color:yellow", "ovr:60"),
            card("SUP", "color:green", "ovr:75", "tier:OURO"), card("INF", "color:black", "ovr:75", "tier:OURO"),
            card("ACE", "color:white", "ovr:60"), card("ACE", "ovr:60"), card("SUP", "color:green", "ovr:55"), card("ACE", "color:red", "ovr:45")};
    final FashionSportsNucleo nucleo = new FashionSportsNucleo();
    static final Set<String> ESTADOS = Set.of("BOLA", "RECEBE", "APOIO", "CORRIDA", "COBERTURA", "PRESSAO", "MARCA", "RETORNO", "GOLEIRO", "POSICAO");

    Resultado jogar(long semente, String modalidade, List<Acionamento> feitos) {
        return nucleo.pontuar(new Entrega(vestir(sup, inf, cal).cartas(), null, null, modalidade),
                Flair3dFixtures.contexto(semente, deck).comAndamento(new Andamento(1, feitos)));
    }

    /** Joga até o fim a primeira carta da mão em cada jogada (uma partida comum, com acertos e erros). */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> partida(long semente, String modalidade) {
        List<Acionamento> feitos = new ArrayList<>();
        Resultado r = jogar(semente, modalidade, feitos);
        while (!r.fecha()) {
            List<UUID> mao = (List<UUID>) ((Map<String, Object>) r.eventos().get(r.eventos().size() - 1).valor()).get("mao");
            feitos.add(new Acionamento(mao.isEmpty() ? null : mao.get((int) (semente + feitos.size()) % mao.size()), null));
            r = jogar(semente, modalidade, feitos);
        }
        return r.eventos().stream().filter(e -> e.codigo().equals("JOGADA")).map(e -> (Map<String, Object>) e.valor()).toList();
    }

    List<Map<String, Object>> muitas(String modalidade) {
        List<Map<String, Object>> todas = new ArrayList<>();
        for (long semente = 1; semente <= 30; semente++) {
            todas.addAll(partida(semente, modalidade));
        }
        return todas;
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> jogadores(Map<String, Object> lance) {
        return (List<Map<String, Object>>) lance.get("jogadores");
    }

    static double n(Object v) {
        return ((Number) v).doubleValue();
    }

    static double[] ponto(Object v) {
        List<?> p = (List<?>) v;
        return new double[]{n(p.get(0)), n(p.get(1))};
    }

    @Test
    void cadaLanceDoFutebolLevaOEstadoEODestinoDosDezJogadoresSemNinguemEmCimaDeNinguem() {
        List<Map<String, Object>> lances = muitas("FUTEBOL");
        Set<String> vistos = new HashSet<>();
        for (Map<String, Object> lance : lances) {
            List<Map<String, Object>> js = jogadores(lance);
            assertThat(js).as("%s", lance.get("tipo")).hasSize(10);
            assertThat(js.stream().map(j -> j.get("time") + ":" + j.get("n")).distinct().count()).isEqualTo(10);
            for (Map<String, Object> j : js) {
                assertThat(ESTADOS).contains((String) j.get("estado"));
                assertThat(n(j.get("x"))).isBetween(1.0, 99.0);
                assertThat(n(j.get("y"))).isBetween(1.0, 59.0);
                vistos.add((String) j.get("estado"));
            }
            for (int i = 0; i < js.size(); i++) {
                for (int k = i + 1; k < js.size(); k++) {
                    double d = Math.hypot(n(js.get(i).get("x")) - n(js.get(k).get("x")), n(js.get(i).get("y")) - n(js.get(k).get("y")));
                    assertThat(d).as("%s: %s e %s", lance.get("tipo"), js.get(i), js.get(k)).isGreaterThan(EsporteCampo.FOLGA - 0.4);
                }
            }
            assertThat(js.stream().filter(j -> "BOLA".equals(j.get("estado")))).hasSize(1);
            // os goleiros não saem da meta
            assertThat(js.stream().filter(j -> (int) j.get("n") == 1 && !"BOLA".equals(j.get("estado")))).allSatisfy(g -> {
                assertThat(g.get("estado")).isIn("GOLEIRO", "POSICAO");
                assertThat(Math.abs(n(g.get("x")) - ("NOS".equals(g.get("time")) ? 5 : 95))).isLessThanOrEqualTo(3.5);
                assertThat(n(g.get("y"))).isBetween(25.0, 35.0);
            });
        }
        assertThat(vistos).containsAll(ESTADOS);
    }

    @Test
    void quemPressionaFicaEntreABolaEOProprioGolEQuemCorreVaiAFrenteDaBola() {
        for (Map<String, Object> lance : muitas("FUTEBOL")) {
            List<Map<String, Object>> js = jogadores(lance);
            Map<String, Object> dono = js.stream().filter(j -> "BOLA".equals(j.get("estado"))).findFirst().orElseThrow();
            // quem ataca para a direita é o time da pessoa
            int dir = "NOS".equals(dono.get("time")) ? 1 : -1;
            String tipo = (String) lance.get("tipo");
            if (Set.of("SAIDA", "TIRO_DE_META", "ESCANTEIO", "LATERAL", "PASSE").contains(tipo) || tipo.contains("_GOL") || tipo.contains("_FORA")
                    || tipo.contains("_DEFENDIDO") || tipo.contains("_ESPALMADO") || tipo.contains("_NA_TRAVE")) {
                continue;
            }
            for (Map<String, Object> j : js) {
                if ("PRESSAO".equals(j.get("estado"))) {
                    assertThat((n(j.get("x")) - n(dono.get("x"))) * dir).as("%s %s", tipo, j).isGreaterThan(-0.5);
                    assertThat(Math.hypot(n(j.get("x")) - n(dono.get("x")), n(j.get("y")) - n(dono.get("y")))).isLessThan(9);
                }
                if ("CORRIDA".equals(j.get("estado")) && n(dono.get("x")) > 14 && n(dono.get("x")) < 86) {
                    assertThat((n(j.get("x")) - n(dono.get("x"))) * dir).as("%s %s", tipo, j).isGreaterThan(0);
                }
            }
        }
    }

    @Test
    void aBolaVoltaAoJogoDoLugarCertoDepoisDoGolDaBolaForaEDaEspalmada() {
        List<Map<String, Object>> lances = muitas("FUTEBOL");
        Set<String> reinicios = new HashSet<>();
        for (int i = 1; i < lances.size(); i++) {
            Map<String, Object> antes = lances.get(i - 1);
            Map<String, Object> lance = lances.get(i);
            String tipo = (String) lance.get("tipo");
            String anterior = (String) antes.get("tipo");
            double[] de = ponto(lance.get("de"));
            boolean nosso = "NOS".equals(lance.get("time"));
            switch (tipo) {
                case "SAIDA" -> {
                    assertThat(de).containsExactly(50, 30);
                    // todos na própria metade, menos quem dá a saída
                    assertThat(jogadores(lance)).allMatch(j -> "BOLA".equals(j.get("estado")) || ("NOS".equals(j.get("time")) ? n(j.get("x")) <= 50 : n(j.get("x")) >= 50));
                    if (anterior.endsWith("_GOL") && antes.get("tempo").equals(lance.get("tempo"))) {
                        assertThat(lance.get("time")).isNotEqualTo(antes.get("time"));
                    }
                }
                case "TIRO_DE_META" -> {
                    assertThat(anterior).matches(".*_(FORA|NA_TRAVE)");
                    assertThat(lance.get("time")).isNotEqualTo(antes.get("time"));
                    assertThat(lance.get("jogador")).isEqualTo(1);
                    assertThat(de[0]).isEqualTo(nosso ? 6 : 94);
                }
                case "ESCANTEIO" -> {
                    assertThat(anterior).endsWith("_ESPALMADO");
                    assertThat(lance.get("time")).isEqualTo(antes.get("time"));
                    assertThat(de[0]).isEqualTo(nosso ? 99 : 1);
                    assertThat(de[1]).isIn(1.0, 59.0);
                    assertThat(lance.get("alvo")).isNotEqualTo(lance.get("jogador"));
                }
                case "LATERAL" -> {
                    assertThat(anterior).isEqualTo("PASSE_PERDIDO");
                    assertThat(antes).containsEntry("saiu", true);
                    assertThat(lance.get("time")).isEqualTo("ELES");
                    assertThat(de[1]).isIn(1.0, 59.0);
                    assertThat(Math.abs(de[1] - ponto(antes.get("para"))[1])).isEqualTo(1.0);
                }
                default -> {
                    continue;
                }
            }
            reinicios.add(tipo);
        }
        assertThat(reinicios).containsExactlyInAnyOrder("SAIDA", "TIRO_DE_META", "ESCANTEIO", "LATERAL");
        // todo gol que não fecha um tempo é seguido da saída de bola de quem sofreu
        for (int i = 0; i < lances.size() - 1; i++) {
            Map<String, Object> lance = lances.get(i);
            Map<String, Object> depois = lances.get(i + 1);
            if (((String) lance.get("tipo")).endsWith("_GOL") && (int) depois.get("n") == (int) lance.get("n") + 1) {
                assertThat(depois.get("tipo")).isEqualTo("SAIDA");
            }
        }
    }

    @Test
    void aBolaNaTraveDizOndeBateuESoExisteOndeHaTrave() {
        List<Map<String, Object>> naTrave = muitas("FUTEBOL").stream().filter(j -> ((String) j.get("tipo")).endsWith("_NA_TRAVE")).toList();
        assertThat(naTrave).isNotEmpty();
        for (Map<String, Object> lance : naTrave) {
            assertThat(lance).containsEntry("ok", false);
            assertThat(lance.get("bateu")).isIn("TRAVE", "TRAVESSAO");
            if ("TRAVE".equals(lance.get("bateu"))) {
                assertThat(ponto(lance.get("para"))[1]).isIn(EsporteFinalizacao.POSTES[0], EsporteFinalizacao.POSTES[1]);
            }
        }
        for (String modalidade : List.of("BASQUETE", "VOLEI", "TENIS", "CORRIDA", "SKATE")) {
            assertThat(muitas(modalidade)).as(modalidade).noneMatch(j -> Set.of("CHUTE_NA_TRAVE", "RIVAL_NA_TRAVE", "TIRO_DE_META", "ESCANTEIO", "LATERAL").contains((String) j.get("tipo")));
        }
    }

    @Test
    void basqueteLevaOsSeisJogadoresEAsModalidadesSemInvasaoNaoLevamNenhum() {
        assertThat(muitas("BASQUETE")).allSatisfy(lance -> assertThat(jogadores(lance)).hasSize(6).noneMatch(j -> "GOLEIRO".equals(j.get("estado"))));
        for (String modalidade : List.of("VOLEI", "TENIS", "CORRIDA", "SKATE")) {
            assertThat(muitas(modalidade)).as(modalidade).noneMatch(j -> j.containsKey("jogadores"));
        }
        // corrida e skate não têm bola: nada de saída de bola depois do ponto
        for (String modalidade : List.of("CORRIDA", "SKATE")) {
            assertThat(partida(4L, modalidade).stream().filter(j -> "SAIDA".equals(j.get("tipo")))).hasSize(2);
        }
    }

    @Test
    void mesmaSementeDaOsMesmosEstadosEDestinos() {
        assertThat(partida(7L, "FUTEBOL")).isEqualTo(partida(7L, "FUTEBOL"));
    }
}
