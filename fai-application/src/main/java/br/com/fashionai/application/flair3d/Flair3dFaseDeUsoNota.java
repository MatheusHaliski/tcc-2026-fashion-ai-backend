package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair.Flair3dHype;
import br.com.fashionai.application.flair3d.Acionamento.Execucao;
import br.com.fashionai.application.flair3d.Acionamento.Toque;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Nota;
import br.com.fashionai.application.flair3d.Flair3dExecucao.Pedido;
import br.com.fashionai.application.flair3d.Flair3dFaseDeUso.Risco;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A nota da fase de uso dos jogos de zonas, marca a marca, pelo primeiro toque de cada uma: o lance ousado gasta o custo
 * e vale {@value Flair3dFaseDeUso#OUSADO} dentro da janela curta; o seguro vale perfeito ou bom; no momento-chave
 * ({@link Flair3dMomentoChave}) vale a escolha certa, que abre (ou, errada, fecha) a janela das marcas seguintes; a carta
 * jogada na marca ({@link Flair3dCartaDeUso}) abre a janela, soma ao acerto ou segura o erro. O resto é erro, que tira
 * pontos e drena o recurso. A torcida da fase é a maior faixa de Hype entre as cartas jogadas (só leitura). Puro.
 */
final class Flair3dFaseDeUsoNota {
    static final String DEFENDIDO = "DEFENDIDO";

    private Flair3dFaseDeUsoNota() {
    }

    static Nota avaliar(Pedido pedido, Execucao feita, Map<UUID, CbcRules.Card> cartas) {
        Risco risco = pedido.risco();
        Flair3dMomentoChave chave = risco.chave();
        List<String> marcas = new ArrayList<>();
        List<Object> jogadas = new ArrayList<>();
        Map<UUID, Integer> ultimaVez = new HashMap<>();
        Flair3dHype.Band torcida = null;
        int pontos = 0;
        int restante = pedido.reserva();
        int embaloPct = 0;
        Boolean chaveCerta = null;
        for (int i = 0; i < pedido.botoes().size(); i++) {
            int marca = i;
            Toque t = feita.toques().stream().filter(x -> x != null && x.marca() == marca).findFirst().orElse(null);
            Flair3dCartaDeUso.Efeito efeito = cartaDaMarca(pedido, t, cartas, ultimaVez, i);
            jogadas.add(efeito == null ? null : efeito.paraTela());
            if (efeito != null) {
                Flair3dHype.Band b = Flair3dHype.Band.valueOf(efeito.faixa());
                torcida = torcida == null || b.ordinal() > torcida.ordinal() ? b : torcida;
            }
            int pct = 100 + embaloPct + (efeito == null ? 0 : efeito.janelaPct());
            int seguro = risco.janelaSegura(i, pedido.janelaMs()) * pct / 100;
            int curta = risco.janelaOusada(i) * pct / 100;
            String nota;
            if (chave != null && chave.marca() == i) {
                nota = t != null && chave.certa().equals(t.botao()) && dentro(t, seguro) ? Flair3dMomentoChave.NOTA : "ERROU";
                chaveCerta = Flair3dMomentoChave.NOTA.equals(nota);
                embaloPct = chaveCerta ? Flair3dMomentoChave.EMBALO_PCT : -Flair3dMomentoChave.EMBALO_PCT;
            } else if (t != null && risco.ousados().get(i).equals(t.botao())) {
                restante -= risco.custo();
                nota = dentro(t, curta) ? Flair3dFaseDeUso.NOTA_OUSADO : "ERROU";
            } else {
                nota = seguroOuErro(pedido, t, i, seguro);
            }
            if ("ERROU".equals(nota) && efeito != null && efeito.escudo()) {
                nota = DEFENDIDO;
            }
            marcas.add(nota);
            int bonus = efeito == null ? 0 : efeito.bonus();
            switch (nota) {
                case Flair3dMomentoChave.NOTA -> pontos += Flair3dMomentoChave.PONTOS + bonus;
                case Flair3dFaseDeUso.NOTA_OUSADO -> pontos += Flair3dFaseDeUso.OUSADO + bonus;
                case "PERFEITO" -> pontos += Flair3dFaseDeUso.SEGURO_PERFEITO + bonus;
                case "BOM" -> pontos += Flair3dFaseDeUso.SEGURO_BOM + bonus;
                case DEFENDIDO -> {
                }
                default -> {
                    pontos -= Flair3dExecucao.ERRO;
                    restante -= pedido.dreno();
                }
            }
        }
        int teto = Flair3dExecucao.TETO;
        return new Nota(marcas, Math.max(-teto, Math.min(teto, pontos)), Math.max(0, restante), detalhe(jogadas, torcida, chaveCerta, risco));
    }

    private static boolean dentro(Toque t, int janela) {
        return t.ms() >= Flair3dExecucao.REACAO_MINIMA_MS && t.ms() <= janela;
    }

    /** O lance seguro com a janela da marca (que a rodada, a marca, a carta e o momento-chave já mexeram). */
    private static String seguroOuErro(Pedido pedido, Toque t, int i, int janela) {
        if (t == null || !pedido.botoes().get(i).equals(t.botao()) || !dentro(t, janela)) {
            return "ERROU";
        }
        return t.ms() <= janela / 2 ? "PERFEITO" : "BOM";
    }

    /**
     * O efeito da carta jogada na marca, ou nulo: a carta tem de ser da pessoa, não ter sido jogada antes nesta fase (a
     * Especial volta depois da recarga) e caber no máximo de cartas da fase.
     */
    private static Flair3dCartaDeUso.Efeito cartaDaMarca(Pedido pedido, Toque t, Map<UUID, CbcRules.Card> cartas, Map<UUID, Integer> ultimaVez, int marca) {
        if (t == null || t.carta() == null || !cartas.containsKey(t.carta())) {
            return null;
        }
        CbcRules.Card carta = cartas.get(t.carta());
        Integer antes = ultimaVez.get(t.carta());
        boolean especial = Flair3dCartaDeUso.ESPECIAL.equals(carta.tier());
        boolean recarregada = antes == null || (especial && marca - antes > Flair3dCartaDeUso.RECARGA);
        boolean cabe = antes != null || ultimaVez.size() < Flair3dCartaDeUso.MAXIMO;
        if (!recarregada || !cabe) {
            return null;
        }
        Flair3dCartaDeUso.Efeito efeito = Flair3dCartaDeUso.de(pedido.risco().jogo(), carta, pedido.risco().uniforme());
        if (efeito != null) {
            ultimaVez.put(t.carta(), marca);
        }
        return efeito;
    }

    private static Map<String, Object> detalhe(List<Object> jogadas, Flair3dHype.Band torcida, Boolean chaveCerta, Risco risco) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cartas", jogadas);
        m.put("torcida", torcida == null ? null : torcida.name());
        m.put("chaveCerta", chaveCerta);
        m.put("nivel", risco.nivel());
        return m;
    }
}
