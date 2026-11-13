package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.List;

import static br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.linha;

/**
 * Elenco 5 (lendário), formação "Cápsula 3-3-3-2": 11 cartas, 17 linhas; química 100, nenhuma linha vermelha, 2 cartas
 * Especial e 4 marcas ou mais.
 */
public class LendarioElenco implements FlairCbcElenco {
    @Override
    public String codigo() {
        return "ELENCO_LENDARIO";
    }

    @Override
    public List<Vaga> vagas() {
        return List.of(new Vaga("ace1", "ACE", 0, 0), new Vaga("ace2", "ACE", 2, 0), new Vaga("ace3", "ACE", 4, 0),
                new Vaga("sup1", "SUP", 0, 1), new Vaga("sup2", "SUP", 2, 1), new Vaga("sup3", "SUP", 4, 1),
                new Vaga("inf1", "INF", 0, 2), new Vaga("inf2", "INF", 2, 2), new Vaga("inf3", "INF", 4, 2),
                new Vaga("cal1", "CAL", 1, 3), new Vaga("cal2", "CAL", 3, 3));
    }

    @Override
    public List<CbcLinks.Edge> linhas() {
        return List.of(linha("ace1", "ace2"), linha("ace2", "ace3"), linha("sup1", "sup2"), linha("sup2", "sup3"), linha("inf1", "inf2"),
                linha("inf2", "inf3"), linha("cal1", "cal2"),
                linha("ace1", "sup1"), linha("ace2", "sup2"), linha("ace3", "sup3"), linha("sup1", "inf1"), linha("sup2", "inf2"),
                linha("sup3", "inf3"), linha("inf1", "cal1"), linha("inf2", "cal1"), linha("inf2", "cal2"), linha("inf3", "cal2"));
    }

    @Override
    public List<Requisito> requisitos() {
        return List.of(Requisito.de(Requisito.QUIMICA, 100), Requisito.semLinhaVermelha(null), Requisito.nivelCarta("ESPECIAL", 2),
                Requisito.de(Requisito.MARCAS, 4));
    }
}
