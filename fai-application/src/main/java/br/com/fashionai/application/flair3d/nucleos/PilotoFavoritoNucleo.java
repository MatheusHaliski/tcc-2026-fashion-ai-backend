package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Flair3dZonas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;

import java.util.List;
import java.util.Map;

/**
 * Núcleo 11 — capacete da "Equipe Aurora" (amarelo e verde), 25 por regra: topo amarelo; laterais amarelas; faixa da
 * viseira verde; viseira espelhada.
 */
public class PilotoFavoritoNucleo implements Flair3dNucleo {
    public static final double POR_REGRA = 25;
    public static final List<String> ZONAS = List.of("TOPO", "LATERAIS", "FAIXA_VISEIRA", "VISEIRA");

    @Override
    public String codigo() {
        return "PILOTO_FAVORITO";
    }

    @Override
    public int numero() {
        return 11;
    }

    @Override
    public Definicao definicao() {
        return Definicao.zonas(codigo(), numero(), Definicao.objetivo("EQUIPE_AURORA", new Regra("TOPO_AMARELO", POR_REGRA),
                new Regra("LATERAIS_AMARELAS", POR_REGRA), new Regra("FAIXA_VERDE", POR_REGRA), new Regra("VISEIRA_ESPELHADA", POR_REGRA)),
                ZONAS, List.of());
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, Entrega.Zona> z = entrega.zonas();
        return Resultado.somando(List.of(
                RegraResultado.de("TOPO_AMARELO", Flair3dZonas.daFamilia(z.get("TOPO"), "Amarelo"), POR_REGRA),
                RegraResultado.de("LATERAIS_AMARELAS", Flair3dZonas.daFamilia(z.get("LATERAIS"), "Amarelo"), POR_REGRA),
                RegraResultado.de("FAIXA_VERDE", Flair3dZonas.daFamilia(z.get("FAIXA_VISEIRA"), "Verde"), POR_REGRA),
                RegraResultado.de("VISEIRA_ESPELHADA", Flair3dZonas.acabamento(z.get("VISEIRA"), Flair3dZonas.ESPELHADO), POR_REGRA)),
                List.of());
    }
}
