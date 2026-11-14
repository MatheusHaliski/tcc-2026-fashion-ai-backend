package br.com.fashionai.application.acervo;

import br.com.fashionai.application.taxonomy.TaxonomyRegistry;
import br.com.fashionai.domain.model.WardrobeItem;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Busca espacial: texto livre como "camisa branca M". Cada palavra precisa bater com a peça em algum campo: nome,
 * marca, categoria, tipo (subcategoria), cor ou tamanho. Categoria, tipo e cor são comparados pelos nomes em português,
 * inglês e espanhol da taxonomia, sem acento e sem a terminação (branca = branco). Palavra curta (até 3 letras) ou
 * número só vale como tamanho, para "M" não casar com toda peça que tem a letra m.
 */
final class AcervoBusca {
    static final int MAX_TERMOS = 8;

    private AcervoBusca() {
    }

    static List<String> termos(String texto) {
        List<String> out = new ArrayList<>();
        for (String palavra : normal(texto).split(" ")) {
            if (!palavra.isBlank() && out.size() < MAX_TERMOS) {
                out.add(palavra);
            }
        }
        return out;
    }

    static boolean casa(WardrobeItem w, List<String> termos) {
        if (termos.isEmpty()) {
            return false;
        }
        Set<String> palavras = palavras(w);
        String tamanho = normal(w.getSizeLabel());
        for (String termo : termos) {
            boolean curto = termo.length() <= 3 || termo.chars().allMatch(Character::isDigit);
            boolean bate = curto ? termo.equals(tamanho) : termo.equals(tamanho) || palavras.contains(raiz(termo));
            if (!bate) {
                return false;
            }
        }
        return true;
    }

    /** Raízes de todas as palavras pesquisáveis da peça. */
    private static Set<String> palavras(WardrobeItem w) {
        Set<String> out = new LinkedHashSet<>();
        TaxonomyRegistry taxonomia = TaxonomyRegistry.get();
        juntar(out, List.of(texto(w.getName()), texto(w.getBrandName()), texto(w.getSubcategory()), texto(w.getColor())));
        taxonomia.subcategory(texto(w.getSubcategory())).ifPresent(s -> juntar(out, s.labels().values()));
        taxonomia.categories().stream()
                .filter(c -> c.code().equals(w.getCategory()))
                .forEach(c -> juntar(out, c.labels().values()));
        taxonomia.dimension("COLOR")
                .flatMap(d -> d.value(texto(w.getColor())))
                .ifPresent(v -> juntar(out, v.labels().values()));
        return out;
    }

    private static void juntar(Set<String> out, Collection<String> textos) {
        for (String t : textos) {
            for (String palavra : normal(t).split(" ")) {
                if (!palavra.isBlank()) {
                    out.add(raiz(palavra));
                }
            }
        }
    }

    private static String texto(String valor) {
        return valor == null ? "" : valor;
    }

    /** Minúsculas, sem acento; tudo o que não é letra ou número vira espaço. */
    static String normal(String texto) {
        if (texto == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", " ").trim();
    }

    /** Tira o plural e a vogal final: brancas, branca e branco viram "branc". */
    static String raiz(String palavra) {
        String p = palavra;
        if (p.length() > 3 && p.endsWith("s")) {
            p = p.substring(0, p.length() - 1);
        }
        if (p.length() > 3 && "aeo".indexOf(p.charAt(p.length() - 1)) >= 0) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }
}
