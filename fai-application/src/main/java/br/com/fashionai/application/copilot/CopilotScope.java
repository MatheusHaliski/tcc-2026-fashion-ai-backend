package br.com.fashionai.application.copilot;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;

import br.com.fashionai.application.service.CopilotService;

/**
 * O Copilot só fala do guarda-roupa. As palavras de peça e de cor são reconhecidas pelo começo ("cap" de boné casa com
 * "capital"), então uma pergunta de outro assunto podia cair em "Não encontrei essa peça no seu acervo". Aqui a pergunta
 * só conta como de guarda-roupa quando traz um termo de moda de verdade: um verbo ou substantivo do assunto, ou a palavra
 * inteira de uma peça ou cor (com plural).
 */
public final class CopilotScope {
    private static final Pattern WARDROBE = Pattern.compile(".*\\b(look|looks|outfit|vest\\w*|visto|roup\\w*|pecas?|guarda|closet|armario|"
            + "acervo|combin\\w*|usar|uso|usei|cadastr\\w*|wear\\w*|cloth\\w*|wardrobe|piece|pieces|ropa|prendas?|llev\\w*|pongo)\\b.*");

    private CopilotScope() {
    }

    public static boolean aboutWardrobe(String message) {
        String text = CopilotText.normalized(message);
        if (WARDROBE.matcher(text).matches() || CopilotLexicon.signalsLook(text)) {
            return true;
        }
        Set<String> words = Set.copyOf(Arrays.asList(text.replaceAll("[^a-z0-9]+", " ").trim().split(" ")));
        return namesWholeWord(words, CopilotService.TYPE_WORDS.keySet()) || namesWholeWord(words, CopilotService.COLOR_WORDS.keySet());
    }

    /** A palavra inteira, o plural dela, ou um radical longo o bastante para não ser coincidência ("vermelh" em "vermelha"). */
    private static boolean namesWholeWord(Set<String> words, Set<String> stems) {
        for (String raw : stems) {
            String stem = CopilotText.normalized(raw);
            for (String word : words) {
                boolean whole = word.equals(stem) || word.equals(stem + "s") || word.equals(stem + "es");
                boolean inflected = stem.length() >= 5 && word.startsWith(stem) && word.length() <= stem.length() + 2;
                if (whole || inflected) {
                    return true;
                }
            }
        }
        return false;
    }
}
