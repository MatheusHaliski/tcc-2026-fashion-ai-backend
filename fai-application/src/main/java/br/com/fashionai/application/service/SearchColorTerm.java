package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.WardrobeItem;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Busca de peças pelo nome da cor (RF8): a cor da peça é gravada como código da taxonomia ("blue"), então o termo
 * "azul" não casava com nada. Quando o termo é o nome de uma cor em algum idioma suportado, ou o nome de uma família de
 * cores ("Azul" = azul, azul-claro, azul-marinho…), as peças públicas dessa cor entram no resultado. Puro: sem
 * repositório; quem chama entrega as peças públicas.
 */
final class SearchColorTerm {
    private SearchColorTerm() {
    }

    /** Códigos de cor que o termo nomeia; vazio quando o termo não é uma cor. */
    static Set<String> codesOf(String term) {
        String needle = fold(term);
        Set<String> out = new LinkedHashSet<>();
        if (needle.isEmpty()) {
            return out;
        }
        for (String code : Taxonomy.COLORS.keySet()) {
            boolean family = needle.equals(fold(Taxonomy.COLOR_FAMILY.get(code)));
            if (family || needle.equals(fold(code.replace('_', ' '))) || namedIn(code, needle)) {
                out.add(code);
            }
        }
        return out;
    }

    /** O resultado da busca por texto mais as peças públicas da cor nomeada pelo termo, sem repetir peça. */
    static List<WardrobeItem> withColor(List<WardrobeItem> found, String term, Supplier<List<WardrobeItem>> allPublic) {
        Set<String> codes = codesOf(term);
        List<String> words = List.of();
        if (codes.isEmpty()) {
            TypeAndColor both = typeAndColor(term);
            if (both == null) {
                return found;
            }
            codes = both.codes();
            words = both.words();
        }
        List<WardrobeItem> out = new ArrayList<>(found);
        Set<UUID> seen = new LinkedHashSet<>();
        found.forEach(w -> seen.add(w.getId()));
        for (WardrobeItem w : allPublic.get()) {
            if (w.getColor() != null && codes.contains(w.getColor()) && describedBy(w, words) && seen.add(w.getId())) {
                out.add(w);
            }
        }
        return out;
    }

    /** As palavras que sobram do termo (o tipo da peça) e os códigos da cor que ele nomeia. */
    record TypeAndColor(List<String> words, Set<String> codes) {
    }

    /**
     * Tipo e cor na mesma busca ("camiseta azul", "azul marinho calça"): a cor é o trecho de uma ou duas palavras que
     * nomeia uma cor; o resto descreve a peça. Nulo quando não há cor no termo ou quando não sobra palavra nenhuma.
     */
    static TypeAndColor typeAndColor(String term) {
        List<String> all = List.of(fold(term).split("\\s+"));
        for (int size = Math.min(2, all.size() - 1); size >= 1; size--) {
            for (int from = 0; from + size <= all.size(); from++) {
                Set<String> codes = codesOf(String.join(" ", all.subList(from, from + size)));
                if (!codes.isEmpty()) {
                    List<String> rest = new ArrayList<>(all.subList(0, from));
                    rest.addAll(all.subList(from + size, all.size()));
                    return new TypeAndColor(rest, codes);
                }
            }
        }
        return null;
    }

    /** Todas as palavras aparecem no nome da peça ou no nome da subcategoria e da categoria, em qualquer idioma. */
    private static boolean describedBy(WardrobeItem w, List<String> words) {
        if (words.isEmpty()) {
            return true;
        }
        StringBuilder text = new StringBuilder(fold(w.getName()));
        for (String code : new String[]{w.getSubcategory(), w.getCategory()}) {
            if (code == null) {
                continue;
            }
            text.append(' ').append(fold(code.replace('_', ' ')));
            for (Locale locale : Msg.SUPPORTED) {
                text.append(' ').append(Msg.has("taxonomy." + code) ? fold(Msg.t(locale, "taxonomy." + code)) : "");
            }
        }
        return words.stream().allMatch(word -> text.indexOf(word) >= 0);
    }

    private static boolean namedIn(String code, String needle) {
        String key = "taxonomy." + code;
        if (!Msg.has(key)) {
            return false;
        }
        for (Locale locale : Msg.SUPPORTED) {
            if (needle.equals(fold(Msg.t(locale, key)))) {
                return true;
            }
        }
        return false;
    }

    /** Minúsculas, sem acento e com hífen como espaço: "Azul-claro" = "azul claro". */
    private static String fold(String s) {
        if (s == null) {
            return "";
        }
        String plain = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return plain.toLowerCase(Locale.ROOT).replace('-', ' ').trim();
    }
}
