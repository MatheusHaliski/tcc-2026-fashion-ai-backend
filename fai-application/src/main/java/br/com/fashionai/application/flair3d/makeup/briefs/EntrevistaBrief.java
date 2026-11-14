package br.com.fashionai.application.flair3d.makeup.briefs;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dBeleza;
import br.com.fashionai.application.flair3d.Flair3dPecas;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.flair3d.makeup.FlairMakeUpBrief;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Nível 1 — "Entrevista": todas as peças de ocasião trabalho ou formal; calçado fechado; lábios nude ou rosa;
 * acabamento dos lábios fosco.
 */
public class EntrevistaBrief implements FlairMakeUpBrief {
    public static final Set<String> OCASIOES = Set.of("work", "business", "formal");
    public static final Set<String> FECHADOS = fechados();

    private static Set<String> fechados() {
        Set<String> s = new HashSet<>(Taxonomy.SNEAKERS);
        s.addAll(Set.of("loafers", "moccasins", "oxford_shoes", "derby_shoes", "boots", "ankle_boots", "long_boots", "combat_boots", "flats"));
        return Set.copyOf(s);
    }

    @Override
    public String codigo() {
        return "ENTREVISTA";
    }

    @Override
    public int nivelMin() {
        return 1;
    }

    @Override
    public List<Regra> regras() {
        return List.of(new Regra("OCASIAO", POR_REGRA), new Regra("CALCADO_FECHADO", POR_REGRA), new Regra("LABIOS_NUDE_OU_ROSA", POR_REGRA),
                new Regra("ACABAMENTO_FOSCO", POR_REGRA));
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, CbcRules.Card> v = contexto.vestidas(entrega);
        return Resultado.somando(List.of(
                RegraResultado.de("OCASIAO", Flair3dPecas.todas(v.values(), c -> Flair3dPecas.temOcasiao(c, OCASIOES)), POR_REGRA),
                RegraResultado.de("CALCADO_FECHADO", Flair3dPecas.subcategoria(v.get("CAL"), FECHADOS), POR_REGRA),
                RegraResultado.de("LABIOS_NUDE_OU_ROSA", Flair3dBeleza.familia(entrega, Flair3dBeleza.LABIOS, "NUDE", "ROSA"), POR_REGRA),
                RegraResultado.de("ACABAMENTO_FOSCO", Flair3dBeleza.acabamento(entrega, Flair3dBeleza.LABIOS, "FOSCO"), POR_REGRA)),
                List.of());
    }
}
