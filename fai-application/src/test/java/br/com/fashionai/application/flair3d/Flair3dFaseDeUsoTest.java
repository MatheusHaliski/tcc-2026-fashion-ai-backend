package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;
import br.com.fashionai.application.flair3d.Flair3dFaseDeUso.Risco;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A fase de uso dos jogos de zonas (estreia em campo, show, volta de classificação, missão com drones): cinco marcas,
 * em cada uma o lance seguro ou o ousado, que vale mais e gasta o recurso que sobrou da tinta; recurso zerado perde a
 * partida. Tudo decidido no servidor a partir da semente e dos toques.
 */
class Flair3dFaseDeUsoTest {
    private static final List<String> SEGUROS = List.of("VESTIR", "TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR");
    private static final List<String> OUSADOS = List.of("TIRAR", "DESFILAR", "TROCAR_ABA", "VESTIR", "TIRAR");

    private static Pedido pedido(int reserva) {
        return new Pedido(SEGUROS, 1000, "ENERGIA", reserva, 15, new Risco(OUSADOS, Flair3dFaseDeUso.CUSTO, 600, Flair3dFaseDeUso.PRAZO_MS));
    }

    /** Ousa nas primeiras {@code ousadas} marcas e faz o seguro nas outras, tudo aos {@code ms}. */
    private static Execucao jogando(int ousadas, int ms) {
        List<Toque> toques = new ArrayList<>();
        for (int i = 0; i < SEGUROS.size(); i++) {
            toques.add(new Toque(i, i < ousadas ? OUSADOS.get(i) : SEGUROS.get(i), ms));
        }
        return new Execucao(toques);
    }

    /** O capacete da Equipe Aurora pintado certo, com a viseira espelhada (6 das 8 latas). */
    private static Entrega capacete() {
        Map<String, Entrega.Zona> z = new LinkedHashMap<>();
        z.put("TOPO", new Entrega.Zona("#F2C230", "FOSCO"));
        z.put("LATERAIS", new Entrega.Zona("#F2C230", "FOSCO"));
        z.put("FAIXA_VISEIRA", new Entrega.Zona("#1F9A4B", "FOSCO"));
        z.put("VISEIRA", new Entrega.Zona("#151515", "ESPELHADO"));
        return new Entrega(null, z, null, null);
    }

    private static Contexto partida(long semente) {
        return new Contexto(Map.of(), null, null).comSemente(semente);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> pedidoDe(Resultado r) {
        return (Map<String, Object>) r.eventos().stream().filter(e -> e.codigo().equals("EXECUCAO_PEDIDA")).findFirst().orElseThrow().valor();
    }

    @Test
    void osQuatroJogosDeZonasPedemCincoMarcasComUmLanceOusadoDiferenteDoSeguroEmCadaUma() {
        for (String codigo : Flair3dFaseDeUso.JOGOS) {
            assertThat(Flair3dFaseDeUso.marcasDo(codigo)).as(codigo).isEqualTo(5);
        }
        Flair3dNucleo piloto = Flair3dNucleos.porCodigo("PILOTO_FAVORITO").orElseThrow();
        for (long semente = 1; semente <= 20; semente++) {
            Map<String, Object> p = pedidoDe(piloto.pontuar(capacete(), partida(semente)));
            List<?> botoes = (List<?>) p.get("botoes");
            List<?> ousados = (List<?>) p.get("ousados");
            assertThat(botoes).hasSize(5);
            assertThat(ousados).hasSize(5).allMatch(Flair3dExecucao.BOTOES::contains);
            for (int i = 0; i < 5; i++) {
                assertThat(ousados.get(i)).as("marca " + i).isNotEqualTo(botoes.get(i));
            }
            assertThat(p).containsEntry("custo", Flair3dFaseDeUso.CUSTO).containsEntry("prazoMs", Flair3dFaseDeUso.PRAZO_MS);
            assertThat((int) p.get("janelaOusadaMs")).isLessThan((int) p.get("janelaMs"));
        }
    }

    @Test
    void osJogosDeCartasContinuamComTresMarcasESemLanceOusado() {
        assertThat(Flair3dFaseDeUso.marcasDo("PASSARELA")).isEqualTo(Flair3dExecucao.MARCAS);
        assertThat(Flair3dFaseDeUso.riscoDe("PASSARELA", SEGUROS, 1000, partida(7), null)).isNull();
    }

    @Test
    void oLanceOusadoValeMaisQueOSeguroEGastaORecurso() {
        Nota seguro = Flair3dExecucao.avaliar(pedido(60), jogando(0, 300));
        assertThat(seguro.marcas()).containsOnly("PERFEITO");
        assertThat(seguro.pontos()).isEqualTo(5 * Flair3dFaseDeUso.SEGURO_PERFEITO);
        assertThat(seguro.restante()).isEqualTo(60);
        Nota ousado = Flair3dExecucao.avaliar(pedido(60), jogando(3, 300));
        assertThat(ousado.marcas()).containsExactly("OUSADO", "OUSADO", "OUSADO", "PERFEITO", "PERFEITO");
        assertThat(ousado.pontos()).isEqualTo(Flair3dExecucao.TETO);
        assertThat(ousado.restante()).isEqualTo(60 - 3 * Flair3dFaseDeUso.CUSTO);
    }

    @Test
    void oLanceOusadoForaDaJanelaCurtaEhErroEGastaOCustoEODreno() {
        // 700 ms: dentro da janela do seguro (1000), fora da do ousado (600)
        Nota n = Flair3dExecucao.avaliar(pedido(60), jogando(1, 700));
        assertThat(n.marcas()).containsExactly("ERROU", "BOM", "BOM", "BOM", "BOM");
        assertThat(n.pontos()).isEqualTo(-Flair3dExecucao.ERRO + 4 * Flair3dFaseDeUso.SEGURO_BOM);
        assertThat(n.restante()).isEqualTo(60 - Flair3dFaseDeUso.CUSTO - 15);
    }

    @Test
    void ousarAlemDoQueORecursoPagaZeraAReserva() {
        assertThat(Flair3dExecucao.avaliar(pedido(48), jogando(4, 300)).restante()).isZero();
        assertThat(Flair3dExecucao.avaliar(pedido(48), jogando(3, 300)).restante()).isEqualTo(12);
    }

    @Test
    void naPartidaQuemOusaDemaisEsgotaEPerdeEQuemDosaGanhaMaisQueSoNoSeguro() {
        Flair3dNucleo piloto = Flair3dNucleos.porCodigo("PILOTO_FAVORITO").orElseThrow();
        Contexto ctx = partida(11);
        Map<String, Object> p = pedidoDe(piloto.pontuar(capacete(), ctx));
        // 40 de energia + 8 latas × 5 − 6 latas gastas × 5
        assertThat(p).containsEntry("recurso", "ENERGIA").containsEntry("reserva", 50);
        Resultado todasOusadas = fechar(piloto, ctx, p, 5);
        assertThat(todasOusadas.resultado()).isEqualTo(Flair3dExecucao.ESGOTADO);
        assertThat(todasOusadas.pontos()).isLessThanOrEqualTo(Flair3dExecucao.NOTA_DE_QUEM_ESGOTOU);
        // a pintura já vale 100: a diferença aparece na regra da execução
        assertThat(execucao(fechar(piloto, ctx, p, 3))).isGreaterThan(execucao(fechar(piloto, ctx, p, 0)));
        assertThat(fechar(piloto, ctx, p, 3).resultado()).isNotEqualTo(Flair3dExecucao.ESGOTADO);
    }

    @SuppressWarnings("unchecked")
    private static Resultado fechar(Flair3dNucleo jogo, Contexto ctx, Map<String, Object> pedido, int ousadas) {
        List<String> botoes = (List<String>) pedido.get("botoes");
        List<String> ousados = (List<String>) pedido.get("ousados");
        Map<String, Object> chave = (Map<String, Object>) pedido.get("chave");
        int marcaChave = (int) chave.get("marca");
        String certa = (String) chave.get("certa");
        String errada = certa.equals(botoes.get(marcaChave)) ? ousados.get(marcaChave) : botoes.get(marcaChave);
        List<Toque> toques = new ArrayList<>();
        for (int i = 0; i < botoes.size(); i++) {
            // no momento-chave, quem ousa em tudo erra a leitura (pit stop com o pneu errado); quem dosa acerta
            String noChave = ousadas == botoes.size() ? errada : certa;
            toques.add(new Toque(i, i == marcaChave ? noChave : i < ousadas ? ousados.get(i) : botoes.get(i), 300));
        }
        Acionamento ac = new Acionamento(null, null, null, new Execucao(toques));
        return jogo.pontuar(capacete(), ctx.comAndamento(ctx.andamento().com(ac)));
    }

    private static double execucao(Resultado r) {
        return r.regras().stream().filter(x -> x.codigo().equals("EXECUCAO")).findFirst().orElseThrow().pontos();
    }
}
