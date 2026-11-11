package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Núcleo 12 — Região 1, Rio de Janeiro, 25 por regra: parte de cima leve; parte de baixo leve; uma peça de cor quente;
 * uma peça de marca brasileira.
 */
public class AroundTheWorldNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> VAGAS = List.of("SUP", "INF", "CAL", "ACE");

    @Override
    public String codigo() {
        return "AROUND_THE_WORLD";
    }

    @Override
    public int numero() {
        return 12;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("RIO_DE_JANEIRO", new Regra("CIMA_LEVE", POR_REGRA),
                new Regra("BAIXO_LEVE", POR_REGRA), new Regra("COR_QUENTE", POR_REGRA), new Regra("MARCA_BR", POR_REGRA)),
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(8, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF")), true);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> v = contexto.vestidas(entrega);
        return Resultado.somando(List.of(
                RegraResultado.de("CIMA_LEVE", Flair3dPecas.leve(v.get("SUP")), POR_REGRA),
                RegraResultado.de("BAIXO_LEVE", Flair3dPecas.leve(v.get("INF")), POR_REGRA),
                RegraResultado.de("COR_QUENTE", v.values().stream().anyMatch(c -> Flair3dPecas.daFamilia(c, Flair3dPecas.QUENTES)), POR_REGRA),
                RegraResultado.de("MARCA_BR", v.values().stream().anyMatch(contexto::brasileira), POR_REGRA)), List.of());
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        List<Efeito> out = new ArrayList<>();
        if (Flair3dPecas.leve(carta) && ("SUP".equals(carta.position()) || "INF".equals(carta.position()))) {
            out.add(new Efeito("SUP".equals(carta.position()) ? "CIMA_LEVE" : "BAIXO_LEVE", POR_REGRA));
        }
        if (Flair3dPecas.daFamilia(carta, Flair3dPecas.QUENTES)) {
            out.add(new Efeito("COR_QUENTE", POR_REGRA));
        }
        if (contexto.brasileira(carta)) {
            out.add(new Efeito("MARCA_BR", POR_REGRA));
        }
        return out;
    }
}
