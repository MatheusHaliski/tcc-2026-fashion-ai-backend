package br.com.fashionai.application.scheme;

import br.com.fashionai.application.service.SchemeService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import br.com.fashionai.application.ai.AiResponseJson;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.Mood;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.model.enums.Visibility;

/**
 * RF9 / RF24.CA10 — "melhorar com IA" por diff: os campos editáveis do look, a instrução da IA, a leitura das propostas
 * e a aplicação de cada campo aceito. Puro; a chamada à IA, a autorização e a transação ficam no
 * {@link SchemeService#improve} e no {@link SchemeService#applyDiff}. Extraído do SchemeService.
 */
public final class SchemeEditDiff {
    private SchemeEditDiff() {
    }

    /** Os campos editáveis do look, como a IA os recebe. */
    static Map<String, Object> current(Scheme s) {
        Map<String, Object> current = new LinkedHashMap<>();
        current.put("title", s.getTitle());
        current.put("description", s.getDescription());
        current.put("occasion", Json.csv(s.getOccasion()));
        current.put("style", Json.csv(s.getStyle()));
        current.put("season", s.getSeason() == null ? null : s.getSeason().name());
        current.put("mood", s.getMood() == null ? null : s.getMood().name());
        current.put("visibility", s.getVisibility().name());
        return current;
    }

    static String system() {
        return """
                Você é o Edit Assistant do Fashion AI. Proponha alterações ao esquema a partir da instrução do usuário.
                Campos editáveis: title, description, occasion (máx 3 códigos), style (máx 3 códigos), season
                (SPRING/SUMMER/AUTUMN/WINTER), mood (ENERGETIC/ELEGANT/COMFORTABLE/SOPHISTICATED), visibility
                (PRIVATE/FOLLOWERS/PUBLIC). Responda SOMENTE com JSON:
                {"changes":[{"field":string,"proposed":valor,"reason":"1 frase"}]}"""
                + "\nEscreva title, description e reason em " + Msg.languageName() + "; field, occasion, style, season, mood e visibility seguem os códigos acima.";
    }

    /** As alterações que a IA propôs, só nos campos que existem e com valor válido; nulo se a resposta não tiver a lista. */
    public static List<LocalAdvisors.FieldChange> parse(String text, Map<String, Object> current) {
        Map<String, Object> m = AiResponseJson.extractJson(text);
        if (!(m.get("changes") instanceof List<?> list)) {
            return null;
        }
        List<LocalAdvisors.FieldChange> out = new ArrayList<>();
        for (Object o : list) {
            if (o instanceof Map<?, ?> c && c.get("field") != null && current.containsKey(String.valueOf(c.get("field")))) {
                String field = String.valueOf(c.get("field"));
                Object proposed = c.get("proposed");
                if (!validChange(field, proposed)) {
                    continue;
                }
                out.add(new LocalAdvisors.FieldChange(field, current.get(field), proposed, String.valueOf(c.get("reason"))));
            }
        }
        return out;
    }

    static boolean validChange(String field, Object v) {
        return switch (field) {
            case "occasion" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.OCCASIONS.contains(String.valueOf(x)));
            case "style" -> v instanceof List<?> l && l.size() <= 3 && l.stream().allMatch(x -> Taxonomy.STYLES.contains(String.valueOf(x)));
            case "season" -> Set.of("SPRING", "SUMMER", "AUTUMN", "WINTER").contains(String.valueOf(v));
            case "mood" -> Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(String.valueOf(v));
            case "visibility" -> Set.of("PRIVATE", "FOLLOWERS", "PUBLIC").contains(String.valueOf(v));
            case "title", "description" -> v instanceof String s && !s.isBlank();
            default -> false;
        };
    }

    /** Aplica um campo já validado ({@link #validChange}). */
    @SuppressWarnings("unchecked")
    static void apply(Scheme s, String field, Object value) {
        switch (field) {
            case "title" -> s.setTitle(InputSanitizer.moderated("title", (String) value, 120));
            case "description" -> s.setDescription(InputSanitizer.moderated("description", (String) value, 1000));
            case "occasion" -> s.setOccasion(Json.csv(((List<Object>) value).stream().map(String::valueOf).toList()));
            case "style" -> s.setStyle(Json.csv(((List<Object>) value).stream().map(String::valueOf).toList()));
            case "season" -> s.setSeason(Season.valueOf(String.valueOf(value)));
            case "mood" -> s.setMood(Mood.valueOf(String.valueOf(value)));
            case "visibility" -> s.setVisibility(Visibility.valueOf(String.valueOf(value)));
            default -> {
            }
        }
    }
}
