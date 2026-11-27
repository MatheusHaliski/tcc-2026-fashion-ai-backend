package br.com.fashionai.application.flair3d;

import br.com.fashionai.application.flair.CbcRules;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.function.Function;
import java.util.TreeMap;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;

/**
 * Leituras de uma carta usadas pelos núcleos: família de cor (Taxonomy.COLOR_FAMILY), materiais, ocasiões, estilos e
 * subcategoria. Nada aqui olha pele, corpo ou rosto.
 */
public final class Flair3dPecas {
    /** Tecidos leves (o "material leve" dos briefs de verão e do Rio). */
    public static final Set<String> LEVES = Set.of("linen", "cotton", "viscose", "silk", "satin", "mesh");
    /** Famílias quentes da taxonomia. */
    public static final Set<String> QUENTES = Set.of("Vermelho", "Laranja", "Amarelo", "Rosa");
    public static final Set<String> FESTA = Set.of("party", "night_out");
    public static final Set<String> TRABALHO = Set.of("work", "business", "formal");
    public static final Set<String> CASUAL = Set.of("casual", "travel", "outdoor", "vacation", "home");
    public static final Set<String> ESPORTE = Set.of("sport", "gym", "outdoor");
    /** Tecidos quentes (o frio de Seul, a pista de esqui). */
    public static final Set<String> MATERIAIS_QUENTES = Set.of("wool", "cashmere", "fleece", "knit", "corduroy", "velvet", "leather",
            "suede", "shearling");
    /** Materiais que seguram a chuva. */
    public static final Set<String> IMPERMEAVEIS = Set.of("nylon", "polyester", "rubber", "leather", "faux_leather", "eva");
    /** Famílias neutras da taxonomia. */
    public static final Set<String> NEUTRAS = Set.of("Preto", "Branco", "Cinza", "Marrom");

    private Flair3dPecas() {
    }

    /** A carta tem alguma cor da família (nomes da taxonomia: "Azul", "Preto"...). */
    public static boolean daFamilia(CbcRules.Card c, String familia) {
        return c != null && c.colors().stream().anyMatch(cor -> familia.equals(Taxonomy.COLOR_FAMILY.get(cor)));
    }

    public static boolean daFamilia(CbcRules.Card c, Collection<String> familias) {
        return familias.stream().anyMatch(f -> daFamilia(c, f));
    }

    public static boolean temCor(CbcRules.Card c, String... cores) {
        return c != null && Set.of(cores).stream().anyMatch(c.colors()::contains);
    }

    public static boolean temOcasiao(CbcRules.Card c, Collection<String> ocasioes) {
        return c != null && ocasioes.stream().anyMatch(c.occasions()::contains);
    }

    public static boolean temEstilo(CbcRules.Card c, Collection<String> estilos) {
        return c != null && estilos.stream().anyMatch(c.styles()::contains);
    }

    public static boolean temMaterial(CbcRules.Card c, Collection<String> materiais) {
        return c != null && materiais.stream().anyMatch(c.materials()::contains);
    }

    public static boolean leve(CbcRules.Card c) {
        return temMaterial(c, LEVES);
    }

    public static boolean subcategoria(CbcRules.Card c, Collection<String> subcategorias) {
        return c != null && c.subcategory() != null && subcategorias.contains(c.subcategory().toLowerCase(Locale.ROOT));
    }

    public static boolean tenis(CbcRules.Card c) {
        return subcategoria(c, Taxonomy.SNEAKERS);
    }

    public static boolean salto(CbcRules.Card c) {
        return subcategoria(c, Set.of("heels"));
    }

    /** Famílias de cor da carta (cada uma conta uma vez), sem as "Especiais". */
    public static Set<String> familias(CbcRules.Card c) {
        Set<String> out = new LinkedHashSet<>();
        if (c != null) {
            c.colors().stream().map(Taxonomy.COLOR_FAMILY::get).filter(f -> f != null && !"Especiais".equals(f)).forEach(out::add);
        }
        return out;
    }

    /** Quantas peças cumprem o teste. */
    public static int quantas(Collection<CbcRules.Card> pecas, Predicate<CbcRules.Card> teste) {
        return (int) pecas.stream().filter(teste).count();
    }

    /**
     * O maior grupo de peças com uma chave em comum (a mesma família de cor, a mesma ocasião, o mesmo estilo): a chave e
     * quantas peças a têm. Empate fica com a chave que vem antes no alfabeto, para ser sempre a mesma.
     */
    public static Map.Entry<String, Integer> maiorGrupo(Collection<CbcRules.Card> pecas, Function<CbcRules.Card, Set<String>> chaves) {
        Map<String, Integer> conta = new TreeMap<>();
        pecas.forEach(c -> chaves.apply(c).forEach(k -> conta.merge(k, 1, Integer::sum)));
        Map.Entry<String, Integer> melhor = null;
        for (Map.Entry<String, Integer> e : conta.entrySet()) {
            if (melhor == null || e.getValue() > melhor.getValue()) {
                melhor = e;
            }
        }
        return melhor == null ? Map.entry("", 0) : melhor;
    }

    /** O look tem a base vestida: parte de cima e de baixo, ou uma peça inteira. */
    public static boolean temBase(Map<String, CbcRules.Card> look) {
        return look.containsKey("VES") || (look.containsKey("SUP") && look.containsKey("INF"));
    }

    /** Uma regra por vaga ("FIGURINO_SUP"): cumprida quando a peça da vaga passa no teste; vaga vazia não pontua. */
    public static List<Resultado.RegraResultado> porVaga(List<String> vagas, Map<String, CbcRules.Card> vestidas, String codigo,
                                                         double valor, Predicate<CbcRules.Card> teste) {
        List<Resultado.RegraResultado> out = new ArrayList<>();
        for (String vaga : vagas) {
            CbcRules.Card c = vestidas.get(vaga);
            out.add(Resultado.RegraResultado.de(codigo + "_" + vaga, c != null && teste.test(c), valor));
        }
        return out;
    }

    /** Todas as peças da coleção cumprem o teste, e há ao menos uma. */
    public static boolean todas(Collection<CbcRules.Card> pecas, Predicate<CbcRules.Card> teste) {
        return !pecas.isEmpty() && pecas.stream().allMatch(teste);
    }
}
