package br.com.fashionai.application.flair3d.cbc.elencos;

import br.com.fashionai.application.flair.CbcLinks;
import br.com.fashionai.application.flair3d.cbc.FlairCbcElenco;

import java.util.List;

import static br.com.fashionai.application.flair3d.cbc.FlairCbcElenco.linha;

/** Elenco 1 (fácil), formação "Silhueta": 5 cartas, 5 linhas; química ≥ 40 e 2 linhas verdes. */
public class PrimeiroElenco implements FlairCbcElenco {
    @Override
    public String codigo() {
        return "PRIMEIRO_ELENCO";
    }

    @Override
    public List<Vaga> vagas() {
        return List.of(new Vaga("acessorio", "ACE", 0, 0), new Vaga("cima", "SUP", 0, 1), new Vaga("bolsa", "ACE", 2, 1),
                new Vaga("baixo", "INF", 1, 2), new Vaga("calcado", "CAL", 1, 3));
    }

    @Override
    public List<CbcLinks.Edge> linhas() {
        return List.of(linha("acessorio", "cima"), linha("cima", "bolsa"), linha("cima", "baixo"), linha("bolsa", "baixo"), linha("baixo", "calcado"));
    }

    @Override
    public List<Requisito> requisitos() {
        return List.of(Requisito.de(Requisito.QUIMICA, 40), Requisito.de(Requisito.LINHAS_VERDES, 2));
    }
}
