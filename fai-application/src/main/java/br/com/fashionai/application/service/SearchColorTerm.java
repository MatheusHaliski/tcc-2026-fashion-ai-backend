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
        if (codes.isEmpty()) {
            return found;
        }
        List<WardrobeItem> out = new ArrayList<>(found);
        Set<UUID> seen = new LinkedHashSet<>();
        found.forEach(w -> seen.add(w.getId()));
        for (WardrobeItem w : allPublic.get()) {
            if (w.getColor() != null && codes.contains(w.getColor()) && seen.add(w.getId())) {
                out.add(w);
            }
        }
        return out;
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
