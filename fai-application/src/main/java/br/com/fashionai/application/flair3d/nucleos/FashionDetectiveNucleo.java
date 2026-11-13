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
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dCores;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dRateio;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Núcleo 6 — Salão 1, "Entrada da gala": acesso com 2 peças ou mais de ocasião formal ou festa; desafio com defesa ≥ 50.
 * Os dois = FAVORAVEL (100), um = PARCIAL (50), nenhum = DESFAVORAVEL (0).
 */
public class FashionDetectiveNucleo implements Flair3dNucleo {
    public static final Set<String> GALA = Set.of("formal", "party");
    public static final int PECAS_GALA = 2;
    public static final int DEFESA = 50;
    public static final int PONTOS_POR_COR = 20;

    @Override
    public String codigo() {
        return "FASHION_DETECTIVE";
    }

    @Override
    public int numero() {
        return 6;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(),
                Definicao.objetivo("ENTRADA_DA_GALA", new Regra("ACESSO", 50), new Regra("DESAFIO_DEFESA", 50)),
                List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(6, Obrigatoria.uma("SUP|VES")), false)
                .comAvatares(Avatares.solo(null, Avatares.figurante("SEGURANCA", 1)));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Collection<CbcRules.Card> pecas = vestidas.values();
        long gala = pecas.stream().filter(c -> Flair3dPecas.temOcasiao(c, GALA)).count();
        int defesa = Flair3dAtributos.soma(pecas).defesa();
        boolean acesso = gala >= PECAS_GALA;
        boolean desafio = defesa >= DEFESA;
        int ok = (acesso ? 1 : 0) + (desafio ? 1 : 0);
        String resultado = ok == 2 ? "FAVORAVEL" : ok == 1 ? "PARCIAL" : "DESFAVORAVEL";
        Flair3dRateio rateio = new Flair3dRateio(vestidas).dividirEntre(acesso ? 50 : 0, c -> Flair3dPecas.temOcasiao(c, GALA))
                .dividir(desafio ? 50 : 0, c -> Flair3dAtributos.daCarta(c).defesa());
        return Resultado.of(ok * 50, resultado,
                List.of(RegraResultado.de("ACESSO", acesso, 50), RegraResultado.de("DESAFIO_DEFESA", desafio, 50)),
                eventos(vestidas, gala, defesa)).comCartas(rateio.lista());
    }

    /**
     * O que as cores do look dão ao detetive ({@link Flair3dCores#DETETIVE}), 20 por peça: verde abre gavetas e armários,
     * preto dá furtividade, amarelo dá vida, azul dá dano. A pista da carta ("a chave está no armário com a blusa branca")
     * rende a chave a quem veste uma peça branca na parte de cima e uma verde, que abre o armário.
     */
    static List<Evento> eventos(Map<String, CbcRules.Card> vestidas, long gala, int defesa) {
        Collection<CbcRules.Card> pecas = vestidas.values();
        List<Evento> out = new ArrayList<>(List.of(new Evento("PECAS_DE_GALA", gala), new Evento("DEFESA", defesa)));
        long abre = Flair3dCores.quantas(Flair3dCores.DETETIVE, pecas, "ABRIR");
        out.add(new Evento("GAVETAS", abre));
        for (String acao : List.of("FURTIVIDADE", "VIDA", "DANO")) {
            out.add(new Evento(acao, PONTOS_POR_COR * Flair3dCores.quantas(Flair3dCores.DETETIVE, pecas, acao)));
        }
        CbcRules.Card cima = vestidas.containsKey("SUP") ? vestidas.get("SUP") : vestidas.get("VES");
        out.add(new Evento("CHAVE", abre > 0 && "PISTA".equals(Flair3dCores.acao(Flair3dCores.DETETIVE, cima))));
        return out;
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        List<Efeito> out = new ArrayList<>(List.of(new Efeito("ACESSO", Flair3dPecas.temOcasiao(carta, GALA) ? 1 : 0),
                new Efeito("DEFESA", Flair3dAtributos.daCarta(carta).defesa())));
        String acao = Flair3dCores.acao(Flair3dCores.DETETIVE, carta);
        if (acao != null) {
            out.add(new Efeito("COR_" + acao, 1));
        }
        return out;
    }
}
