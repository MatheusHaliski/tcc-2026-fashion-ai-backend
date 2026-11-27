package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Avatares;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPercurso;
import br.com.fashionai.application.flair3d.Flair3dRateio;
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
                List.of(Definicao.CARTAS), VAGAS, Deck.ate(12, Obrigatoria.uma("SUP"), Obrigatoria.uma("INF")), true)
                .comAvatares(Avatares.solo(null, Avatares.figurante("PASSANTE", 6)))
                .comRodadas(AroundTheWorldRodadas.rodadas().toArray(Definicao.Rodada[]::new));
    }

    @Override
    public Map<String, Object> abertura(Contexto contexto) {
        Flair3dPercurso.Etapas etapas = AroundTheWorldRodadas.etapas(contexto.rodada());
        if (etapas != null) {
            return Map.of("etapa", Flair3dPercurso.primeira(etapas));
        }
        return AroundTheWorldRodadas.SHOPPING.equals(contexto.rodada()) ? Map.of("pedido", AroundTheWorldRodadas.pedido(contexto).codigo()) : Map.of();
    }

    @Override
    public Resultado previa(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = AroundTheWorldRodadas.etapas(contexto.rodada());
        return etapas == null ? pontuar(entrega, contexto) : Flair3dPercurso.previa(entrega, contexto, etapas);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Flair3dPercurso.Etapas etapas = AroundTheWorldRodadas.etapas(contexto.rodada());
        if (etapas != null) {
            return Flair3dPercurso.pontuar(entrega, contexto, etapas);
        }
        Map<String, CbcRules.Card> v = contexto.vestidas(entrega);
        if (AroundTheWorldRodadas.SHOPPING.equals(contexto.rodada())) {
            return AroundTheWorldRodadas.shopping(v, contexto);
        }
        List<RegraResultado> regras = List.of(
                RegraResultado.de("CIMA_LEVE", Flair3dPecas.leve(v.get("SUP")), POR_REGRA),
                RegraResultado.de("BAIXO_LEVE", Flair3dPecas.leve(v.get("INF")), POR_REGRA),
                RegraResultado.de("COR_QUENTE", v.values().stream().anyMatch(AroundTheWorldNucleo::quente), POR_REGRA),
                RegraResultado.de("MARCA_BR", v.values().stream().anyMatch(contexto::brasileira), POR_REGRA));
        Flair3dRateio rateio = new Flair3dRateio(v).vaga("SUP", regras.get(0).pontos()).vaga("INF", regras.get(1).pontos())
                .dividirEntre(regras.get(2).pontos(), AroundTheWorldNucleo::quente)
                .dividirEntre(regras.get(3).pontos(), contexto::brasileira);
        return Resultado.somando(regras, List.of()).comCartas(rateio.lista());
    }

    static boolean quente(CbcRules.Card c) {
        return Flair3dPecas.daFamilia(c, Flair3dPecas.QUENTES);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        if (contexto.rodada() != null && !"RIO_DE_JANEIRO".equals(contexto.rodada())) {
            return List.of(Efeito.conformeAEtapa());
        }
        List<Efeito> out = new ArrayList<>();
        if (Flair3dPecas.leve(carta) && ("SUP".equals(carta.position()) || "INF".equals(carta.position()))) {
            out.add(new Efeito("SUP".equals(carta.position()) ? "CIMA_LEVE" : "BAIXO_LEVE", POR_REGRA));
        }
        if (quente(carta)) {
            out.add(new Efeito("COR_QUENTE", POR_REGRA));
        }
        if (contexto.brasileira(carta)) {
            out.add(new Efeito("MARCA_BR", POR_REGRA));
        }
        return out;
    }
}
