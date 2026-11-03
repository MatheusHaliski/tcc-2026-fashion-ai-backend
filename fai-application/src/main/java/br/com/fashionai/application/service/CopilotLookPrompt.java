package br.com.fashionai.application.service;

import br.com.fashionai.application.service.CopilotService.LookPrompt;
import br.com.fashionai.application.taxonomy.Taxonomy;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static br.com.fashionai.application.service.CopilotText.mentions;

/** Leitura do pedido de look: ocasiões, estilos, humor, estação e faixa de clima citados na mensagem. */
final class CopilotLookPrompt {
    private CopilotLookPrompt() {
    }

    static LookPrompt lookPrompt(String message, List<String> requestedOccasions, String requestedMood) {
        List<String> occasions = new ArrayList<>(requestedOccasions == null ? List.of() : requestedOccasions.stream()
                .filter(Taxonomy.OCCASIONS::contains).distinct().limit(3).toList());
        Map<String, List<String>> occasionTerms = Map.ofEntries(
                Map.entry("casual", List.of("casual", "informal", "dia a dia")), Map.entry("work", List.of("work", "trabalho", "escritorio")),
                Map.entry("business", List.of("business", "executivo", "corporativo")), Map.entry("formal", List.of("formal")),
                Map.entry("party", List.of("party", "festa")), Map.entry("night_out", List.of("night out", "noite")),
                Map.entry("date", List.of("date", "encontro", "romantico")), Map.entry("wedding", List.of("wedding", "casamento")),
                Map.entry("ceremony", List.of("ceremony", "cerimonia")), Map.entry("sport", List.of("sport", "esporte")),
                Map.entry("gym", List.of("gym", "academia")), Map.entry("travel", List.of("travel", "viagem")),
                Map.entry("beach", List.of("beach", "praia")), Map.entry("vacation", List.of("vacation", "ferias")),
                Map.entry("school", List.of("school", "escola")), Map.entry("university", List.of("university", "faculdade")),
                Map.entry("social", List.of("social", "social")), Map.entry("home", List.of("home", "casa")),
                Map.entry("outdoor", List.of("outdoor", "ar livre")), Map.entry("festival", List.of("festival")));
        for (String value : Taxonomy.OCCASIONS) {
            if (!occasions.contains(value) && occasionTerms.getOrDefault(value, List.of(value.replace('_', ' '))).stream().anyMatch(term -> mentions(message, term))) {
                occasions.add(value);
            }
        }
        CopilotLexicon.matches(CopilotLexicon.OCCASIONS, message).stream().filter(Taxonomy.OCCASIONS::contains)
                .filter(value -> !occasions.contains(value)).forEach(occasions::add);
        List<String> detectedStyles = new ArrayList<>(Taxonomy.STYLES.stream().filter(value -> mentions(message, value.replace('_', ' '))).limit(3).toList());
        Map<String, String> translated = Map.ofEntries(Map.entry("classico", "classic"), Map.entry("minimalista", "minimalist"),
                Map.entry("moderno", "modern"), Map.entry("elegante", "chic"), Map.entry("urbano", "urban"),
                Map.entry("romantico", "romantic"), Map.entry("boemio", "boho"), Map.entry("esportivo", "sporty"),
                Map.entry("luxuoso", "luxury"), Map.entry("futurista", "futuristic"), Map.entry("vintage", "vintage"));
        translated.entrySet().stream().filter(e -> mentions(message, e.getKey())).map(Map.Entry::getValue).forEach(detectedStyles::add);
        CopilotLexicon.matches(CopilotLexicon.STYLES, message).stream().filter(Taxonomy.STYLES::contains).forEach(detectedStyles::add);
        List<String> styles = detectedStyles.stream().distinct().limit(3).toList();
        String mood = requestedMood;
        if (mood != null && !Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED").contains(mood.toUpperCase(Locale.ROOT))) mood = null;
        if (mood == null) {
            if (List.of("energetico", "energetica", "vibrante", "animado").stream().anyMatch(term -> mentions(message, term))) mood = "ENERGETIC";
            else if (List.of("elegante", "elegancia", "chique").stream().anyMatch(term -> mentions(message, term))) mood = "ELEGANT";
            else if (List.of("confortavel", "conforto", "cozy").stream().anyMatch(term -> mentions(message, term))) mood = "COMFORTABLE";
            else if (List.of("sofisticado", "sofisticada", "refinado").stream().anyMatch(term -> mentions(message, term))) mood = "SOPHISTICATED";
            else mood = CopilotLexicon.first(CopilotLexicon.MOODS, message);
        }
        String season = null;
        if (List.of("inverno", "winter").stream().anyMatch(term -> mentions(message, term))) season = "WINTER";
        else if (List.of("verao", "summer").stream().anyMatch(term -> mentions(message, term))) season = "SUMMER";
        else if (List.of("outono", "autumn", "fall").stream().anyMatch(term -> mentions(message, term))) season = "AUTUMN";
        else if (List.of("primavera", "spring").stream().anyMatch(term -> mentions(message, term))) season = "SPRING";
        else season = CopilotLexicon.first(CopilotLexicon.SEASONS, message);
        String weatherBand = CopilotLexicon.weatherBand(message);
        if (season == null) season = CopilotLexicon.seasonOfBand(weatherBand);
        return new LookPrompt(occasions.stream().distinct().limit(3).toList(), styles, mood, season, weatherBand);
    }
}
