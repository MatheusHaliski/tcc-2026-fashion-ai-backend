package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Acionamento;
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
 * Núcleo 6 — Salão 1, "Entrada da gala": acesso com 2 peças ou mais de ocasião formal ou festa; desafio automático com
 * defesa + vida + dano ≥ 50 ou furtividade ≥ 40 (as cores do look, {@link Flair3dCores#DETETIVE}). Os dois = FAVORAVEL
 * (100), um = PARCIAL (50), nenhum = DESFAVORAVEL (0).
 *
 * <p>A partida anda em duas etapas: a entrega mostra os medidores e para no mercado (EM_ACAO); o acionamento, com no
 * máximo uma carta deixada no balcão, faz as compras ({@link FashionDetectiveMercado}) e fecha o salão.</p>
 */
public class FashionDetectiveNucleo implements Flair3dNucleo {
    public static final Set<String> GALA = Set.of("formal", "party");
    public static final int PECAS_GALA = 2;
    public static final int DEFESA = 50;
    public static final int PONTOS_POR_COR = 20;
    public static final int FURTIVIDADE = 40;

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

    static long cor(Collection<CbcRules.Card> pecas, String acao) {
        return Flair3dCores.quantas(Flair3dCores.DETETIVE, pecas, acao);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> vestidas = contexto.vestidas(entrega);
        Collection<CbcRules.Card> pecas = vestidas.values();
        long gala = pecas.stream().filter(c -> Flair3dPecas.temOcasiao(c, GALA)).count();
        int defesa = Flair3dAtributos.soma(pecas).defesa();
        long furtividade = PONTOS_POR_COR * cor(pecas, "FURTIVIDADE");
        long vida = PONTOS_POR_COR * cor(pecas, "VIDA");
        long dano = PONTOS_POR_COR * cor(pecas, "DANO");
        boolean acesso = gala >= PECAS_GALA;
        CbcRules.Card cima = vestidas.containsKey("SUP") ? vestidas.get("SUP") : vestidas.get("VES");
        long abre = cor(pecas, "ABRIR");
        FashionDetectiveMercado mercado = new FashionDetectiveMercado(abre, acesso,
                abre > 0 && "PISTA".equals(Flair3dCores.acao(Flair3dCores.DETETIVE, cima)));
        List<Evento> eventos = new ArrayList<>(List.of(new Evento("PECAS_DE_GALA", gala), new Evento("DEFESA", defesa),
                new Evento("FURTIVIDADE", furtividade), new Evento("VIDA", vida), new Evento("DANO", dano),
                new Evento("MERCADO", mercado.estalecas())));
        List<Acionamento> acionamentos = contexto.andamento().acionamentos();
        if (acionamentos.isEmpty()) {
            return Resultado.parcial(Resultado.EM_ACAO, Resultado.EM_ACAO, List.of(), eventos);
        }
        mercado.vender(acionamentos.get(0), vestidas, contexto, eventos);
        mercado.comprar(desafio(defesa, furtividade, vida, dano), eventos);
        boolean desafio = desafio(defesa + mercado.defesaExtra(), furtividade, vida, dano);
        eventos.add(new Evento("GAVETAS", mercado.gavetas()));
        eventos.add(new Evento("CHAVE", mercado.chave()));
        eventos.add(new Evento("ESTALECAS", mercado.estalecas()));
        int ok = (acesso ? 1 : 0) + (desafio ? 1 : 0);
        String resultado = ok == 2 ? "FAVORAVEL" : ok == 1 ? "PARCIAL" : "DESFAVORAVEL";
        Flair3dRateio rateio = new Flair3dRateio(vestidas).dividirEntre(acesso ? 50 : 0, c -> Flair3dPecas.temOcasiao(c, GALA))
                .dividir(desafio ? 50 : 0, c -> Flair3dAtributos.daCarta(c).defesa());
        return Resultado.of(ok * 50, resultado,
                List.of(RegraResultado.de("ACESSO", acesso, 50), RegraResultado.de("DESAFIO_DEFESA", desafio, 50)), eventos)
                .comCartas(rateio.lista());
    }

    /**
     * O confronto é automático: passa quem soma {@link #DEFESA} entre defesa, vida (amarelo) e dano (azul), ou quem tem
     * furtividade (preto) para passar sem ser visto.
     */
    static boolean desafio(int defesa, long furtividade, long vida, long dano) {
        return defesa + vida + dano >= DEFESA || furtividade >= FURTIVIDADE;
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
