package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.List;

import static br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.linha;

/** Elenco 2 (médio), formação "2-2-2-1": 7 cartas, 9 linhas; química ≥ 60, 4 linhas por cor e 7 cartas. */
public class PaletaAtelieElenco implements FlairCbcElenco {
    @Override
    public String codigo() {
        return "PALETA_ATELIE";
    }

    @Override
    public List<Vaga> vagas() {
        return List.of(new Vaga("ace1", "ACE", 0, 0), new Vaga("ace2", "ACE", 2, 0), new Vaga("sup1", "SUP", 0, 1), new Vaga("sup2", "SUP", 2, 1),
                new Vaga("inf1", "INF", 0, 2), new Vaga("inf2", "INF", 2, 2), new Vaga("cal", "CAL", 1, 3));
    }

    @Override
    public List<CbcLinks.Edge> linhas() {
        return List.of(linha("ace1", "ace2"), linha("ace1", "sup1"), linha("ace2", "sup2"), linha("sup1", "sup2"), linha("sup1", "inf1"),
                linha("sup2", "inf2"), linha("inf1", "inf2"), linha("inf1", "cal"), linha("inf2", "cal"));
    }

    @Override
    public List<Requisito> requisitos() {
        return List.of(Requisito.de(Requisito.QUIMICA, 60), Requisito.linhasPor("COR", 4), Requisito.de(Requisito.CARTAS, 7));
    }
}
