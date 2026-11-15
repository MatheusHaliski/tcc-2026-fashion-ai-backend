package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.nucleos.AroundTheWorldNucleo;
import br.com.fashionai.application.flair3d.nucleos.BatalhaLooksNucleo;
import br.com.fashionai.application.flair3d.nucleos.Boutique3dNucleo;
import br.com.fashionai.application.flair3d.nucleos.LabirintoNucleo;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static br.com.fashionai.application.flair3d.Flair3dFixtures.card;
import static br.com.fashionai.application.flair3d.Flair3dFixtures.vestir;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * FLAIR 3D — as rodadas em etapas (um look por etapa, a partida segue ABERTA até a última): a peça achada e as rodadas do
 * Labirinto, as clientes da Boutique, a volta ao mundo, o elevador e o metrô do Around the World e a batalha de 3
 * rodadas. Cada teste entrega os looks em sequência, como o serviço faz, guardando as entregas anteriores no andamento.
 */
class Flair3dRodadasEtapasTest {
    /** Uma partida jogada direto no núcleo: guarda as entregas e refaz o andamento a cada uma, como o serviço. */
    static final class Partida {
        final Flair3dNucleo nucleo;
        final String rodada;
        final long semente;
        final CbcRules.Card[] deck;
        final List<Andamento.Etapa> anteriores = new ArrayList<>();

        Partida(Flair3dNucleo nucleo, String rodada, long semente, CbcRules.Card... deck) {
            this.nucleo = nucleo;
            this.rodada = rodada;
            this.semente = semente;
            this.deck = deck;
        }

        Contexto contexto() {
            return Flair3dFixtures.contexto(semente, deck).comAndamento(new Andamento(anteriores.size() + 1, List.of(), anteriores, rodada));
        }

        Resultado previa(String resposta, CbcRules.Card... look) {
            return nucleo.previa(entrega(resposta, look), contexto());
        }

        Resultado entregar(String resposta, CbcRules.Card... look) {
            Entrega e = entrega(resposta, look);
            Resultado r = nucleo.pontuar(e, contexto());
            anteriores.add(new Andamento.Etapa(e.cartas(), List.of(), e.resposta()));
            return r;
        }

        static Entrega entrega(String resposta, CbcRules.Card... look) {
            Map<String, UUID> m = new LinkedHashMap<>();
            for (CbcRules.Card c : look) {
                m.put(c.position(), c.id());
            }
            return new Entrega(m, null, null, resposta);
        }
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> mapa(Resultado r, String codigo) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals(codigo)).findFirst().orElseThrow().valor();
    }

    static Object simples(Resultado r, String codigo) {
        return r.eventos().stream().filter(e -> e.codigo().equals(codigo)).findFirst().orElseThrow().valor();
    }

    @Test
    void espelhoAbreComAPecaAchadaDepoisDeDuasApresentacoesSemAbrir() {
        CbcRules.Card a = card("SUP", "color:navy");
        CbcRules.Card b = card("INF", "color:blue");
        CbcRules.Card c = card("CAL", "color:red");
        Partida p = new Partida(new LabirintoNucleo(), "ESPELHO_1", 1L, a, b, c);
        assertThat(p.entregar(null, a, b, c).resultado()).isEqualTo("NAO_ABRE");
        Resultado segunda = p.entregar(null, a, b, c);
        assertThat(segunda.status()).isEqualTo("ABERTA");
        assertThat(simples(segunda, "FALTAM_PECAS")).isEqualTo(1);
        Resultado terceira = p.entregar(null, a, b, c);
        assertThat(terceira.resultado()).isEqualTo("ABRE");
        assertThat(terceira.pontos()).isEqualTo(60);
        assertThat(mapa(terceira, "PECA_ACHADA")).isEqualTo(Map.of("pecas", 1, "familia", "FAMILIA_AZUL"));
        assertThat(LabirintoNucleo.achadas(1)).isZero();
        assertThat(LabirintoNucleo.achadas(5)).isEqualTo(2);
    }

    @Test
    void escadaDeEspelhosSomaUmaRegraPorEspelhoEValeSoDePrimeira() {
        CbcRules.Card sup = card("SUP", "color:navy", "occasion:casual", "style:basic");
        CbcRules.Card inf = card("INF", "color:blue", "occasion:casual", "style:basic");
        CbcRules.Card cal = card("CAL", "color:cobalt");
        CbcRules.Card ace = card("ACE", "color:red");
        LabirintoNucleo n = new LabirintoNucleo();
        Partida p = new Partida(n, "ESCADA_DE_ESPELHOS", 1L, sup, inf, cal, ace);
        assertThat(n.abertura(p.contexto()).get("etapa")).isEqualTo(Map.of("etapa", 1, "codigo", "ESPELHO_1", "total", 5, "tentativa", 1));
        Resultado e1 = p.entregar(null, sup, inf);
        assertThat(e1.status()).isEqualTo("ABERTA");
        assertThat(e1.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(mapa(e1, "PROXIMA_ETAPA")).containsEntry("etapa", 2).containsEntry("codigo", "ESPELHO_2");
        assertThat(p.entregar(null, sup, inf).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        Resultado falha = p.entregar(null, sup, inf);
        assertThat(falha.resultado()).isEqualTo(Flair3dPercurso.NAO_CUMPRIDA);
        assertThat(falha.regras()).extracting(Resultado.RegraResultado::codigo).containsExactly("PAR_DE_COR", "OCASIAO_EM_COMUM", "LOOK_COMPLETO");
        assertThat(mapa(falha, "PROXIMA_ETAPA")).containsEntry("etapa", 3).containsEntry("tentativa", 2);
        Resultado previa = p.previa(null, sup, inf, cal);
        assertThat(previa.regras()).allMatch(Resultado.RegraResultado::ok);
        assertThat(previa.pontos()).isZero();
        assertThat(p.entregar(null, sup, inf, cal).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(p.entregar(null, sup, inf, cal).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        Resultado fim = p.entregar(null, sup, inf, cal);
        assertThat(fim.fecha()).isTrue();
        assertThat(fim.pontos()).isEqualTo(80);
        assertThat(fim.regras()).extracting(Resultado.RegraResultado::codigo).containsExactly("ESPELHO_1", "ESPELHO_2", "ESPELHO_3", "ESPELHO_4", "ESPELHO_5");
        assertThat(fim.regras().get(2).ok()).isFalse();
        assertThat(fim.eventos()).filteredOn(e -> e.codigo().equals("ETAPA")).hasSize(5);
    }

    @Test
    void espelhoCedeSemPontosDepoisDeQuatroApresentacoesEAsTresPortasContamEstrelas() {
        CbcRules.Card festa1 = card("SUP", "occasion:party");
        CbcRules.Card festa2 = card("INF", "occasion:night_out");
        CbcRules.Card trabalho = card("CAL", "occasion:work");
        LabirintoNucleo n = new LabirintoNucleo();
        Partida escada = new Partida(n, "ESCADA_DE_ESPELHOS", 1L, festa1);
        for (int i = 0; i < 3; i++) {
            assertThat(escada.entregar(null, festa1).resultado()).isEqualTo(Flair3dPercurso.NAO_CUMPRIDA);
        }
        Resultado cedeu = escada.entregar(null, festa1);
        assertThat(cedeu.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(cedeu.eventos()).extracting(Resultado.Evento::codigo).contains("ESPELHO_CEDEU");
        assertThat(simples(cedeu, "PONTOS_DA_ETAPA")).isEqualTo(0L);

        Partida portas = new Partida(n, "TRES_PORTAS", 1L, festa1, festa2, trabalho);
        assertThat(n.definicao().naRodada("TRES_PORTAS").opcoes()).containsExactly("PORTA_FACIL", "PORTA_MEDIA", "PORTA_DIFICIL");
        Resultado dificil = portas.entregar("PORTA_DIFICIL", festa1, festa2, trabalho);
        assertThat(dificil.resultado()).isEqualTo(Flair3dPercurso.NAO_CUMPRIDA);
        assertThat(simples(dificil, "FALTAM_NO_TEMA")).isEqualTo(1);
        Resultado media = portas.entregar("PORTA_MEDIA", festa1, festa2, trabalho);
        assertThat(media.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(mapa(media, "PORTA")).isEqualTo(Map.of("estrelas", 2));
        assertThat(mapa(media, "PROXIMA_ETAPA")).containsEntry("codigo", "SALA_DO_TRABALHO");
        assertThat(portas.entregar("PORTA_FACIL", trabalho).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        for (int i = 0; i < 3; i++) {
            assertThat(portas.entregar("PORTA_FACIL", trabalho).status()).isEqualTo("ABERTA");
        }
        Resultado fim = portas.entregar("PORTA_FACIL", trabalho);
        assertThat(fim.fecha()).isTrue();
        assertThat(fim.pontos()).isEqualTo(50);

        Resultado holofotes = n.pontuar(vestir(festa1, card("INF", "material:denim", "color:white")),
                Flair3dFixtures.naRodada("CORREDOR_DE_HOLOFOTES", 1L, festa1));
        assertThat(holofotes.fecha()).isTrue();
        assertThat(holofotes.pontos()).isEqualTo(20);
    }

    @Test
    void personalStylistAtendeTresClientesSorteadasComUmLookCadaUma() {
        CbcRules.Card sup = card("SUP", "occasion:work", "color:blue", "style:classic");
        CbcRules.Card inf = card("INF", "occasion:work");
        Boutique3dNucleo n = new Boutique3dNucleo();
        Partida p = new Partida(n, "PERSONAL_STYLIST", 11L, sup, inf);
        @SuppressWarnings("unchecked")
        String primeira = (String) ((Map<String, Object>) n.abertura(p.contexto()).get("etapa")).get("codigo");
        assertThat(primeira).startsWith("CLIENTE_");
        List<String> clientes = new ArrayList<>(List.of(primeira));
        Resultado r1 = p.entregar(null, sup, inf);
        assertThat(r1.status()).isEqualTo("ABERTA");
        assertThat(r1.regras()).extracting(Resultado.RegraResultado::codigo).containsExactly("PEDIDO_OCASIAO", "PEDIDO_COR", "PEDIDO_ESTILO");
        clientes.add((String) mapa(r1, "PROXIMA_ETAPA").get("codigo"));
        Resultado r2 = p.entregar(null, sup, inf);
        clientes.add((String) mapa(r2, "PROXIMA_ETAPA").get("codigo"));
        assertThat(clientes).doesNotHaveDuplicates();
        Resultado fim = p.entregar(null, sup, inf);
        assertThat(fim.fecha()).isTrue();
        assertThat(fim.regras()).extracting(Resultado.RegraResultado::codigo).containsExactlyElementsOf(clientes);
        long estrelas = (long) simples(fim, "ESTRELAS_DAS_CLIENTES");
        assertThat(fim.pontos()).isEqualTo((int) Math.round(estrelas * 100 / 9.0));
        if (clientes.contains("CLIENTE_ENTREVISTA")) {
            assertThat(estrelas).isGreaterThanOrEqualTo(3);
        }
        assertThat(n.efeitos(sup, p.contexto())).containsExactly(Efeito.conformeAEtapa());
    }

    @Test
    void vitrineNaoAceitaManequimRepetidoEOProvadorPedeUmaPecaSo() {
        Boutique3dNucleo n = new Boutique3dNucleo();
        CbcRules.Card sup = card("SUP", "style:classic", "color:blue", "style:streetwear", "color:black", "style:romantic", "color:pink", "style:sporty", "color:white");
        CbcRules.Card inf = card("INF");
        Partida vitrine = new Partida(n, "VITRINE_QUE_VENDE", 2L, sup, inf);
        assertThat(vitrine.entregar(null, sup).regras()).allMatch(Resultado.RegraResultado::ok);
        Resultado repetido = vitrine.entregar(null, sup);
        assertThat(repetido.regras()).noneMatch(Resultado.RegraResultado::ok);
        Resultado fim = vitrine.entregar(null, sup, inf);
        assertThat(fim.fecha()).isTrue();
        assertThat(simples(fim, "CLIENTES_ATRAIDOS")).isEqualTo(20L);
        assertThat(fim.pontos()).isEqualTo(67);

        CbcRules.Card coringa = card("SUP", "color:blue", "color:black", "color:white", "material:wool", "material:linen", "occasion:party",
                "occasion:work", "occasion:casual");
        Partida provador = new Partida(n, "PROVADOR_LOTADO", 2L, coringa, inf);
        assertThat(provador.entregar(null, coringa, inf).regras()).noneMatch(Resultado.RegraResultado::ok);
        for (int i = 0; i < 3; i++) {
            assertThat(provador.entregar(null, coringa).regras()).allMatch(Resultado.RegraResultado::ok);
        }
        Resultado ultimo = provador.entregar(null, inf);
        assertThat(ultimo.fecha()).isTrue();
        assertThat(simples(ultimo, "CLIENTES_ATENDIDAS")).isEqualTo(3L);
        assertThat(ultimo.pontos()).isEqualTo(60);
    }

    @Test
    void voltaAoMundoAbreARegiaoCom60PontosEElevadorEMetroContamAsTrocas() {
        AroundTheWorldNucleo n = new AroundTheWorldNucleo();
        CbcRules.Card sup = card("SUP", "material:linen", "style:resort", "color:yellow");
        CbcRules.Card inf = card("INF");
        CbcRules.Card cal = card("CAL");
        Partida volta = new Partida(n, "VOLTA_AO_MUNDO", 1L, sup, inf, cal);
        assertThat(n.definicao().deck().tamanhoMax()).isEqualTo(12);
        assertThat(volta.previa(null, sup).pontos()).isEqualTo(75);
        Resultado rio = volta.entregar(null, sup, inf, cal);
        assertThat(rio.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(simples(rio, "ESTRELAS_DA_REGIAO")).isEqualTo(3);
        assertThat(mapa(rio, "PROXIMA_ETAPA")).containsEntry("codigo", "REGIAO_NOVA_YORK").containsEntry("total", 8);
        Resultado ny = volta.entregar(null, inf, cal);
        assertThat(ny.resultado()).isEqualTo(Flair3dPercurso.NAO_CUMPRIDA);
        assertThat(mapa(ny, "PROXIMA_ETAPA")).containsEntry("codigo", "REGIAO_NOVA_YORK").containsEntry("tentativa", 2);

        CbcRules.Card treino = card("SUP", "occasion:gym");
        CbcRules.Card treino2 = card("INF", "occasion:sport");
        CbcRules.Card escritorio = card("SUP", "occasion:work");
        CbcRules.Card escritorio2 = card("INF", "occasion:business");
        Partida elevador = new Partida(n, "ELEVADOR_DA_TORRE", 1L, treino, treino2, escritorio, escritorio2, cal);
        assertThat(elevador.entregar(null, treino, treino2, cal).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        Resultado andar2 = elevador.entregar(null, escritorio, escritorio2, cal);
        assertThat(andar2.resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        assertThat(simples(andar2, "TROCAS_FEITAS")).isEqualTo(2);
        Resultado tresTrocas = elevador.entregar(null, treino, treino2);
        assertThat(tresTrocas.resultado()).isEqualTo(Flair3dPercurso.NAO_CUMPRIDA);
        assertThat(tresTrocas.regras()).contains(new Resultado.RegraResultado("ATE_2_TROCAS", false, 0));

        Partida metro = new Partida(n, "METRO_DE_MODA", 1L, escritorio, escritorio2, cal);
        assertThat(metro.entregar(null, escritorio, cal).resultado()).isEqualTo(Flair3dPercurso.CUMPRIDA);
        Resultado semTroca = metro.entregar(null, escritorio, cal);
        assertThat(semTroca.regras()).contains(new Resultado.RegraResultado("UMA_TROCA", false, 0));

        CbcRules.Card festa = card("CAL", "occasion:party", "occasion:work", "occasion:casual", "occasion:sport");
        Contexto shopping = Flair3dFixtures.naRodada("SHOPPING_DE_4_ANDARES", 3L, festa);
        assertThat((String) n.abertura(shopping).get("pedido")).startsWith("PEDIDO_");
        Resultado compra = n.pontuar(vestir(festa), shopping);
        assertThat(compra.pontos()).isEqualTo(25);
        assertThat(simples(compra, "PEDIDO_DO_SHOPPING")).isEqualTo(n.abertura(shopping).get("pedido"));
    }

    @Test
    void batalhaDeTresRodadasSomaContraOAdversarioEDecideOVencedor() {
        BatalhaLooksNucleo n = new BatalhaLooksNucleo();
        CbcRules.Card sup = card("SUP", "color:blue");
        CbcRules.Card inf = card("INF", "color:blue");
        Partida p = new Partida(n, "BATALHA_DE_3_RODADAS", 21L, sup, inf);
        assertThat(n.definicao().rodadas().get(0).codigo()).isEqualTo("BATALHA_DE_3_RODADAS");
        assertThat(n.definicao().rodadas().get(0).etapas()).isEqualTo(3);
        int voce = 0;
        int adversario = 0;
        List<String> desafios = new ArrayList<>();
        Resultado r = null;
        for (int rodada = 1; rodada <= 3; rodada++) {
            Resultado previa = p.previa(null, sup, inf);
            r = p.entregar(null, sup, inf);
            if (rodada < 3) {
                assertThat(r.status()).isEqualTo("ABERTA");
                Map<String, Object> placar = mapa(r, "RODADA_DA_BATALHA");
                assertThat(placar.get("voce")).isEqualTo((long) previa.pontos());
                voce += ((Long) placar.get("voce")).intValue();
                adversario += (int) placar.get("adversario");
                desafios.add((String) mapa(r, "PROXIMA_ETAPA").get("codigo"));
            }
        }
        assertThat(r.fecha()).isTrue();
        assertThat(desafios).doesNotHaveDuplicates();
        Map<String, Object> soma = mapa(r, "SOMA_DA_BATALHA");
        assertThat((int) soma.get("voce")).isGreaterThanOrEqualTo(voce);
        assertThat((int) soma.get("adversario")).isGreaterThan(adversario);
        boolean venceu = (int) soma.get("voce") > (int) soma.get("adversario");
        boolean empate = (int) soma.get("voce") == (int) soma.get("adversario");
        if (!empate) {
            assertThat(r.resultado()).isEqualTo(venceu ? "VITORIA" : "DERROTA");
        } else {
            assertThat(r.eventos()).extracting(Resultado.Evento::codigo).contains("VOTO_DA_PLATEIA");
        }
        assertThat(r.regras()).hasSize(3);
    }
}
