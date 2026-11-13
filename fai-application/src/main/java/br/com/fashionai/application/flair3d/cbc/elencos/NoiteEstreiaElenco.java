package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.List;

import static br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.linha;

/**
 * Elenco 4 (difícil), formação "Estreia 2-3-2-2": 9 cartas, 13 linhas; química ≥ 80, 5 linhas por ocasião e nenhuma
 * linha vermelha na ves.
 */
public class NoiteEstreiaElenco implements FlairCbcElenco {
    @Override
    public String codigo() {
        return "NOITE_ESTREIA";
    }

    @Override
    public List<Vaga> vagas() {
        return List.of(new Vaga("ace1", "ACE", 1, 0), new Vaga("ace2", "ACE", 3, 0),
                new Vaga("sup1", "SUP", 0, 1), new Vaga("ves", "VES", 2, 1), new Vaga("sup2", "SUP", 4, 1),
                new Vaga("inf1", "INF", 1, 2), new Vaga("inf2", "INF", 3, 2), new Vaga("cal1", "CAL", 1, 3), new Vaga("cal2", "CAL", 3, 3));
    }

    @Override
    public List<CbcLinks.Edge> linhas() {
        return List.of(linha("ace1", "ace2"), linha("ace1", "sup1"), linha("ace2", "sup2"), linha("sup1", "ves"), linha("ves", "sup2"),
                linha("ves", "inf1"), linha("ves", "inf2"), linha("sup1", "inf1"), linha("sup2", "inf2"), linha("inf1", "inf2"),
                linha("inf1", "cal1"), linha("inf2", "cal2"), linha("cal1", "cal2"));
    }

    @Override
    public List<Requisito> requisitos() {
        return List.of(Requisito.de(Requisito.QUIMICA, 80), Requisito.linhasPor("OCASIAO", 5), Requisito.semLinhaVermelha("ves"));
    }
}
