package br.com.fashionai.application.ai;

import br.com.fashionai.application.common.Msg;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * HU-RF6.CA19 / HU-RF24.CA16 / RF21: a era de celebridade é ATMOSFERA, nunca RETRATO. Um prompt de arte
 * que cite o nome de uma pessoa real cadastrada, ou peça rosto, corpo ou silhueta identificável, é
 * rejeitado ANTES do envio ao provedor e a rejeição é registrada.
 */
public final class CelebrityPromptValidator {
    private static final List<String> PORTRAIT_TERMS = List.of(
            "rosto", "retrato", "face", "portrait", "selfie", "corpo de", "body of", "silhueta de", "silhouette of",
            "parecido com", "parecida com", "lookalike", "look-alike", "sosia", Msg.k("celebrityPromptValidator.sosia"), "foto de", "photo of",
            "headshot", "close-up of", "deepfake", "semelhante a", Msg.k("celebrityPromptValidator.identico_a"), Msg.k("celebrityPromptValidator.identica_a"), "likeness");

    private CelebrityPromptValidator() {
    }

    public record Verdict(boolean accepted, List<String> violations) {
    }

    public static Verdict validate(String prompt, Collection<String> protectedNames) {
        List<String> violations = new ArrayList<>();
        String normalized = normalize(prompt);
        for (String term : PORTRAIT_TERMS) {
            if (normalized.contains(normalize(term))) {
                violations.add(Msg.t("celebrityPromptValidator.pede_retrato_rosto_corpo_silhueta", term));
            }
        }
        if (protectedNames != null) {
            for (String name : protectedNames) {
                if (name == null || name.isBlank() || name.trim().length() < 3) {
                    continue;
                }
                String n = normalize(name);
                if (containsWord(normalized, n)) {
                    violations.add(Msg.t("celebrityPromptValidator.cita_o_nome_de_uma", name.trim()));
                }
            }
        }
        return new Verdict(violations.isEmpty(), List.copyOf(violations));
    }

    private static boolean containsWord(String text, String word) {
        int idx = text.indexOf(word);
        while (idx >= 0) {
            boolean startOk = idx == 0 || !Character.isLetterOrDigit(text.charAt(idx - 1));
            int end = idx + word.length();
            boolean endOk = end >= text.length() || !Character.isLetterOrDigit(text.charAt(end));
            if (startOk && endOk) {
                return true;
            }
            idx = text.indexOf(word, idx + 1);
        }
        return false;
    }

    static String normalize(String text) {
        String n = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }
}
