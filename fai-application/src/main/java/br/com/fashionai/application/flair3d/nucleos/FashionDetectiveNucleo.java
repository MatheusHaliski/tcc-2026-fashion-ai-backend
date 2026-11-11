package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dAtributos;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Núcleo 6 — Salão 1, "Entrada da gala": acesso com 2 peças ou mais de ocasião formal ou festa; desafio com defesa ≥ 50.
 * Os dois = FAVORAVEL (100), um = PARCIAL (50), nenhum = DESFAVORAVEL (0).
 */
public class FashionDetectiveNucleo implements Flair3dNucleo {
    public static final Set<String> GALA = Set.of("formal", "party");
    public static final int PECAS_GALA = 2;
    public static final int DEFESA = 50;

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
                List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(6, Obrigatoria.uma("SUP|VES")), false);
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Collection<CbcRules.Card> pecas = contexto.vestidas(entrega).values();
        long gala = pecas.stream().filter(c -> Flair3dPecas.temOcasiao(c, GALA)).count();
        int defesa = Flair3dAtributos.soma(pecas).defesa();
        boolean acesso = gala >= PECAS_GALA;
        boolean desafio = defesa >= DEFESA;
        int ok = (acesso ? 1 : 0) + (desafio ? 1 : 0);
        String resultado = ok == 2 ? "FAVORAVEL" : ok == 1 ? "PARCIAL" : "DESFAVORAVEL";
        return Resultado.of(ok * 50, resultado,
                List.of(RegraResultado.de("ACESSO", acesso, 50), RegraResultado.de("DESAFIO_DEFESA", desafio, 50)),
                List.of(new Evento("PECAS_DE_GALA", gala), new Evento("DEFESA", defesa)));
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return List.of(new Efeito("ACESSO", Flair3dPecas.temOcasiao(carta, GALA) ? 1 : 0),
                new Efeito("DEFESA", Flair3dAtributos.daCarta(carta).defesa()));
    }
}
