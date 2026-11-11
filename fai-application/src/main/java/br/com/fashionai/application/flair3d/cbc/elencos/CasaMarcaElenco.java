package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.List;

import static br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.linha;

/**
 * Elenco 3 (médio-difícil), formação "Vitrine 3-3-2-1": 9 cartas, 12 linhas; química ≥ 70, 3 linhas por marca, 2 marcas
 * ou mais e 1 carta Ouro ou Especial.
 */
public class CasaMarcaElenco implements FlairCbcElenco {
    @Override
    public String codigo() {
        return "CASA_MARCA";
    }

    @Override
    public List<Vaga> vagas() {
        return List.of(new Vaga("ace1", "ACE", 0, 0), new Vaga("ace2", "ACE", 2, 0), new Vaga("ace3", "ACE", 4, 0),
                new Vaga("sup1", "SUP", 0, 1), new Vaga("sup2", "SUP", 2, 1), new Vaga("sup3", "SUP", 4, 1),
                new Vaga("inf1", "INF", 1, 2), new Vaga("inf2", "INF", 3, 2), new Vaga("cal", "CAL", 2, 3));
    }

    @Override
    public List<CbcLinks.Edge> linhas() {
        return List.of(linha("ace1", "ace2"), linha("ace2", "ace3"), linha("sup1", "sup2"), linha("sup2", "sup3"), linha("inf1", "inf2"),
                linha("ace1", "sup1"), linha("ace2", "sup2"), linha("ace3", "sup3"), linha("sup1", "inf1"), linha("sup3", "inf2"),
                linha("inf1", "cal"), linha("inf2", "cal"));
    }

    @Override
    public List<Requisito> requisitos() {
        return List.of(Requisito.de(Requisito.QUIMICA, 70), Requisito.linhasPor("MARCA", 3), Requisito.de(Requisito.MARCAS, 2),
                Requisito.nivelCarta("OURO", 1));
    }
}
