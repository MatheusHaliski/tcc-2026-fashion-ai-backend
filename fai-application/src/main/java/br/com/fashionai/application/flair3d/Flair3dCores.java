package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.Map;
import java.util.TreeSet;

/**
 * A cor da peça decide a ação (docs/flair/flair-3d/CORES_E_ACOES.md): no FASHION_SPORTS a peça que entra em campo dispara
 * na hora a ação da família de cor dela; no FASHION_DETECTIVE cada família de cor é uma ação do detetive. As famílias são
 * as da taxonomia ("Preto", "Verde"...). Peça sem família mapeada não tem ação. Nada aqui olha pele, corpo ou rosto.
 */
public final class Flair3dCores {
    /** Esportes: preto defende (desarme e carrinho), verde chuta, amarelo dribla, azul corre, vermelho passa, branco é o goleiro. */
    public static final Map<String, String> ESPORTE = Map.of("Preto", "DEFESA", "Verde", "CHUTE", "Amarelo", "DRIBLE",
            "Azul", "CORRIDA", "Vermelho", "PASSE", "Branco", "GOLEIRO");
    /** Detetive: verde abre gavetas e armários, preto é furtividade, amarelo é vida, azul é dano, branco é pista, vermelho é moeda. */
    public static final Map<String, String> DETETIVE = Map.of("Verde", "ABRIR", "Preto", "FURTIVIDADE", "Amarelo", "VIDA",
            "Azul", "DANO", "Branco", "PISTA", "Vermelho", "MOEDA");

    private Flair3dCores() {
    }

    /** A ação da carta na tabela: a da primeira cor (em ordem alfabética, para ser sempre a mesma) com família mapeada. */
    public static String acao(Map<String, String> tabela, CbcRules.Card carta) {
        if (carta == null) {
            return null;
        }
        for (String cor : new TreeSet<>(carta.colors())) {
            String familia = Taxonomy.COLOR_FAMILY.get(cor);
            if (familia != null && tabela.containsKey(familia)) {
                return tabela.get(familia);
            }
        }
        return null;
    }

    /** Quantas peças da coleção têm a ação dada. */
    public static long quantas(Map<String, String> tabela, Iterable<CbcRules.Card> pecas, String acao) {
        long n = 0;
        for (CbcRules.Card c : pecas) {
            if (acao.equals(acao(tabela, c))) {
                n++;
            }
        }
        return n;
    }
}
