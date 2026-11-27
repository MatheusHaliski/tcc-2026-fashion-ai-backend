package br.com.fashionai.application.flair3d.aura;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Flair3dExecucao;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;
import br.com.fashionai.application.flair3d.Resultado.Evento;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * As famílias de Aura dentro da execução no percurso, nos jogos com Aura na partida ({@link Flair3dAuraRegras#JOGOS}):
 * Electro abre a janela; Comum perdoa o dreno do primeiro erro; a Metamorfose da carta Especial transforma a marca
 * errada em "bom" e recarrega por {@value Flair3dAuraRegras#RECARGA_MARCAS} marcas. A fase de uso dos jogos de zonas
 * (pedido com risco) fica como está. O que mudou vai no evento AURA_NA_EXECUCAO. Puro.
 */
public final class Flair3dAuraNaExecucao {
    public static final String CODIGO = "AURA_NA_EXECUCAO";

    private Flair3dAuraNaExecucao() {
    }

    public static int janela(String jogo, int base, Collection<CbcRules.Card> look, Contexto contexto) {
        return Flair3dAuraRegras.noJogo(jogo) ? base + Flair3dAuraRegras.electroMs(look, contexto) : base;
    }

    /** A nota refeita com Comum e Metamorfose; sem nenhuma das duas (ou fora dos jogos com Aura), a mesma nota. */
    public static Nota reavaliar(String jogo, Pedido pedido, Nota nota, Collection<CbcRules.Card> look, Contexto contexto, List<Evento> eventos) {
        boolean comum = Flair3dAuraRegras.quantas(look, contexto, Flair3dAuraRegras.COMMON) > 0;
        boolean meta = Flair3dAuraRegras.temMetamorfose(look, contexto);
        int electro = Flair3dAuraRegras.electroMs(look, contexto);
        if (!Flair3dAuraRegras.noJogo(jogo) || pedido.risco() != null || (!comum && !meta && electro == 0)) {
            return nota;
        }
        Nota nova = refazer(pedido, nota.marcas(), comum, meta);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("electroMs", electro);
        m.put("perdoados", perdoados(nota.marcas(), comum, meta));
        m.put("metamorfoses", metamorfoses(nota.marcas(), meta));
        eventos.add(new Evento(CODIGO, m));
        return nova;
    }

    /** As marcas em que a Metamorfose disparou: o primeiro erro e, depois da recarga, o próximo. */
    static List<Integer> metamorfoses(List<String> marcas, boolean meta) {
        List<Integer> out = new ArrayList<>();
        int pronta = 0;
        for (int i = 0; meta && i < marcas.size(); i++) {
            if ("ERROU".equals(marcas.get(i)) && i >= pronta) {
                out.add(i);
                pronta = i + Flair3dAuraRegras.RECARGA_MARCAS + 1;
            }
        }
        return out;
    }

    /** Erros que o Comum perdoou do dreno: o primeiro que a Metamorfose não transformou. */
    static int perdoados(List<String> marcas, boolean comum, boolean meta) {
        List<Integer> transformadas = metamorfoses(marcas, meta);
        long erros = java.util.stream.IntStream.range(0, marcas.size()).filter(i -> "ERROU".equals(marcas.get(i)) && !transformadas.contains(i)).count();
        return comum && erros > 0 ? 1 : 0;
    }

    static Nota refazer(Pedido pedido, List<String> marcas, boolean comum, boolean meta) {
        List<Integer> transformadas = metamorfoses(marcas, meta);
        int pontos = 0;
        int drenos = -perdoados(marcas, comum, meta);
        List<String> out = new ArrayList<>();
        for (int i = 0; i < marcas.size(); i++) {
            String r = transformadas.contains(i) ? "BOM" : marcas.get(i);
            out.add(r);
            switch (r) {
                case "PERFEITO" -> pontos += Flair3dExecucao.PERFEITO;
                case "BOM" -> pontos += Flair3dExecucao.BOM;
                default -> {
                    pontos -= Flair3dExecucao.ERRO;
                    drenos++;
                }
            }
        }
        int restante = pedido.reserva() - Math.max(0, drenos) * pedido.dreno();
        return new Nota(out, Math.max(-Flair3dExecucao.TETO, Math.min(Flair3dExecucao.TETO, pontos)), Math.max(0, restante));
    }
}
