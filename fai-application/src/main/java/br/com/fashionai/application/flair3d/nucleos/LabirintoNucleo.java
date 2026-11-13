package br.com.fashionai.application.flair3d.nucleos;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.flair3d.Contexto;
import br.com.fashionai.application.flair3d.Definicao;
import br.com.fashionai.application.flair3d.Definicao.Deck;
import br.com.fashionai.application.flair3d.Definicao.Obrigatoria;
import br.com.fashionai.application.flair3d.Definicao.Regra;
import br.com.fashionai.application.flair3d.Efeito;
import br.com.fashionai.application.flair3d.Entrega;
import br.com.fashionai.application.flair3d.Flair3dNucleo;
import br.com.fashionai.application.flair3d.Resultado;
import br.com.fashionai.application.flair3d.Resultado.Evento;
import br.com.fashionai.application.flair3d.Resultado.RegraResultado;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;

/**
 * Núcleo 10 — Espelho 1, "3 peças da mesma família de cor": abre (100) ou não abre (0). Quando não abre, o evento
 * FALTAM_PECAS diz quantas peças faltaram na família mais perto de fechar.
 */
public class LabirintoNucleo implements Flair3dNucleo {
    public static final int PECAS = 3;

    @Override
    public String codigo() {
        return "LABIRINTO";
    }

    @Override
    public int numero() {
        return 10;
    }

    @Override
    public Definicao definicao() {
        return Definicao.cartas(codigo(), numero(), Definicao.objetivo("ESPELHO_1", new Regra("MESMA_FAMILIA", 100)),
                List.of(Definicao.CARTAS), Definicao.VAGAS, Deck.ate(8, new Obrigatoria(CbcRules.ANY, PECAS)), true);
    }

    /** Famílias de cor de uma carta (cada uma conta uma vez por carta), sem as "Especiais". */
    static Set<String> familias(CbcRules.Card c) {
        Set<String> out = new LinkedHashSet<>();
        c.colors().stream().map(Taxonomy.COLOR_FAMILY::get).filter(Objects::nonNull).filter(f -> !"Especiais".equals(f)).forEach(out::add);
        return out;
    }

    @Override
    public Resultado pontuar(Entrega entrega, Contexto contexto) {
        Map<String, Integer> porFamilia = new TreeMap<>();
        contexto.vestidas(entrega).values().forEach(c -> familias(c).forEach(f -> porFamilia.merge(f, 1, Integer::sum)));
        Map.Entry<String, Integer> melhor = porFamilia.entrySet().stream().max(Map.Entry.comparingByValue()).orElse(null);
        int maior = melhor == null ? 0 : melhor.getValue();
        boolean abre = maior >= PECAS;
        List<Evento> eventos = new ArrayList<>();
        if (melhor != null) {
            eventos.add(new Evento("FAMILIA", codigoFamilia(melhor.getKey())));
        }
        if (!abre) {
            eventos.add(new Evento("FALTAM_PECAS", PECAS - maior));
        }
        return Resultado.of(abre ? 100 : 0, abre ? "ABRE" : "NAO_ABRE", List.of(RegraResultado.de("MESMA_FAMILIA", abre, 100)), eventos);
    }

    static String codigoFamilia(String familia) {
        return "FAMILIA_" + familia.toUpperCase(Locale.ROOT);
    }

    @Override
    public List<Efeito> efeitos(CbcRules.Card carta, Contexto contexto) {
        return familias(carta).stream().map(f -> new Efeito(codigoFamilia(f), 1)).toList();
    }
}
