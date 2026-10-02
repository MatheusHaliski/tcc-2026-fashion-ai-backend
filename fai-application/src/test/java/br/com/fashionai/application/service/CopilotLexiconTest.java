package br.com.fashionai.application.service;

import br.com.fashionai.application.taxonomy.Taxonomy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.File;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** Vocabulário ampliado do Copilot: cobertura, destinos válidos e interpretação de prompts reais. */
class CopilotLexiconTest {
    static Map<String, Object> manifest;

    @BeforeAll
    @SuppressWarnings("unchecked")
    static void loadManifest() throws Exception {
        manifest = new ObjectMapper().readValue(new File("../fai-web/src/main/resources/catalog/asset-manifest.json"), Map.class);
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> list(String key) {
        return (List<Map<String, Object>>) manifest.get(key);
    }

    static Set<String> ids(String key) {
        return list(key).stream().map(e -> String.valueOf(e.get("id"))).collect(Collectors.toSet());
    }

    @Test
    void addsMoreThan300KeywordsNotKnownBefore() {
        Set<String> previous = new HashSet<>();
        CopilotService.COLOR_WORDS.keySet().stream().map(CopilotService::normalized).forEach(previous::add);
        CopilotService.TYPE_WORDS.keySet().stream().map(CopilotService::normalized).forEach(previous::add);
        CopilotService.MATERIAL_WORDS.keySet().stream().map(CopilotService::normalized).forEach(previous::add);
        previous.removeAll(CopilotLexicon.COLOR_PREFIXES.keySet().stream().map(CopilotService::normalized).toList());
        previous.removeAll(CopilotLexicon.TYPE_PREFIXES.keySet().stream().map(CopilotService::normalized).toList());
        previous.removeAll(CopilotLexicon.PIECE_MATERIALS.keySet().stream().map(CopilotService::normalized).toList());

        Set<String> added = CopilotLexicon.keywords().stream().map(CopilotService::normalized).collect(Collectors.toSet());
        added.removeAll(previous);
        assertThat(added).hasSizeGreaterThan(300);
    }

    @Test
    void everyKeywordPointsToAnExistingCode() {
        Set<String> subcategories = Taxonomy.SUBCATEGORIES.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        assertThat(CopilotLexicon.OCCASIONS.values()).allMatch(Taxonomy.OCCASIONS::contains);
        assertThat(CopilotLexicon.STYLES.values()).allMatch(Taxonomy.STYLES::contains);
        assertThat(CopilotLexicon.MOODS.values()).allMatch(Set.of("ENERGETIC", "ELEGANT", "COMFORTABLE", "SOPHISTICATED")::contains);
        assertThat(CopilotLexicon.SEASONS.values()).allMatch(Set.of("WINTER", "SUMMER", "AUTUMN", "SPRING")::contains);
        assertThat(CopilotLexicon.WEATHER.values()).allMatch(Set.of("VERAO_LEVE", "MEIA_ESTACAO", "CAMADAS", "INVERNO_PESADO")::contains);
        assertThat(CopilotLexicon.COLOR_PREFIXES.values()).allMatch(codes -> Taxonomy.COLORS.keySet().containsAll(codes));
        assertThat(CopilotLexicon.TYPE_PREFIXES.values()).allMatch(subcategories::containsAll);
        assertThat(CopilotLexicon.PIECE_MATERIALS.values()).allMatch(codes -> Taxonomy.MATERIALS.containsAll(codes));

        Set<String> auraPresets = ids("auraPresets");
        Set<String> auraVariants = list("auraPresets").stream().flatMap(p -> ((List<?>) p.get("variants")).stream())
                .map(v -> String.valueOf(((Map<?, ?>) v).get("id"))).collect(Collectors.toSet());
        assertThat(CopilotLexicon.AURA_PRESETS.values()).allMatch(auraPresets::contains);
        CopilotLexicon.AURA_VARIANTS.forEach((preset, variants) ->
                assertThat(variants.values()).allMatch(suffix -> auraVariants.contains(preset + "__" + suffix)));
        assertThat(CopilotLexicon.BACKGROUND_MATERIALS.values()).allMatch(ids("materials")::contains);
        assertThat(CopilotLexicon.GRADIENTS.values()).allMatch(ids("gradientAuraPresets")::contains);
        assertThat(CopilotLexicon.SEASONAL_PRESETS.values()).allMatch(ids("seasonalPresets")::contains);
    }

    @Test
    void understandsOccasionStyleMoodAndSeasonVocabulary() {
        CopilotService.LookPrompt beach = CopilotService.lookPrompt(
                "Vou ser madrinha num casamento no litoral em janeiro, quero algo delicado e leve", List.of(), null);
        assertThat(beach.occasions()).contains("wedding", "beach");
        assertThat(beach.styles()).contains("romantic");
        assertThat(beach.mood()).isEqualTo("COMFORTABLE");
        assertThat(beach.season()).isEqualTo("SUMMER");

        CopilotService.LookPrompt festival = CopilotService.lookPrompt("Look pro Lollapalooza estilo anos 90, bem chamativo", List.of(), null);
        assertThat(festival.occasions()).contains("festival");
        assertThat(festival.styles()).contains("grunge", "statement");

        CopilotService.LookPrompt office = CopilotService.lookPrompt("Entrevista de emprego com vibe old money e arrumada", List.of(), null);
        assertThat(office.occasions()).contains("business");
        assertThat(office.styles()).contains("classic");
        assertThat(office.mood()).isEqualTo("ELEGANT");
    }

    @Test
    void readsWeatherFromWordsAndTemperatures() {
        assertThat(CopilotService.lookPrompt("Hoje tem garoa e ventania", List.of(), null).weather()).isEqualTo("CAMADAS");
        assertThat(CopilotService.lookPrompt("Onda de calor, dia de sol forte", List.of(), null).weather()).isEqualTo("VERAO_LEVE");
        CopilotService.LookPrompt cold = CopilotService.lookPrompt("Está 8 graus e chovendo, o que visto para a reunião?", List.of(), null);
        assertThat(cold.weather()).isEqualTo("INVERNO_PESADO");
        assertThat(cold.season()).isEqualTo("WINTER");
        assertThat(cold.occasions()).contains("work");
        assertThat(CopilotService.lookPrompt("Faz 32°C aqui", List.of(), null).weather()).isEqualTo("VERAO_LEVE");
        assertThat(CopilotService.lookPrompt("Clima ameno, nem frio nem calor", List.of(), null).weather()).isEqualTo("MEIA_ESTACAO");
    }

    @Test
    void avoidsKnownCollisions() {
        assertThat(CopilotService.lookPrompt("Look com maiô para a praia", List.of(), null).season()).isNull();
        assertThat(CopilotService.hasPieceConstraints("entrevista para o cargo de analista")).isFalse();
        assertThat(CopilotService.hasPieceConstraints("roupa para meia estação")).isFalse();
        assertThat(CopilotService.hasPieceConstraints("onde está a prateleira de cima")).isFalse();
        assertThat(CopilotService.hasPieceConstraints("cachecol de cashmere")).isTrue();
        assertThat(CopilotService.intent("Onde está meu cachecol?")).isEqualTo(CopilotService.Intent.WHERE_IS);
    }

    @Test
    void routesNewVocabularyToLooks() {
        assertThat(CopilotService.intent("Algo para o happy hour de sexta")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Tá garoando, me ajuda?")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Quero um fundo geométrico")).isEqualTo(CopilotService.Intent.LOOKS);
        assertThat(CopilotService.intent("Qual é o seu nome?")).isEqualTo(CopilotService.Intent.GENERAL);
    }

    private CopilotService serviceWithCatalog() {
        BackgroundStudioService studio = Mockito.mock(BackgroundStudioService.class);
        when(studio.catalog()).thenReturn(Map.of("auraPresets", list("auraPresets"), "materials", list("materials"),
                "gradients", list("gradientAuraPresets"), "seasonal", list("seasonalPresets")));
        when(studio.recommend(any(), any())).thenReturn(Map.of());
        CopilotService service = Mockito.mock(CopilotService.class, Mockito.CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "backgroundStudio", studio);
        return service;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> scheme(CopilotService.BackgroundPrompt prompt) {
        assertThat(prompt.configuration()).isNotNull();
        return (Map<String, Object>) prompt.configuration().get("scheme");
    }

    @Test
    void vocabularyHasAtLeastFiveHundredKeywords() {
        // Criar Look · "Gerar com IA": a orientação livre reconhece o vocabulário inteiro do Copilot
        assertThat(CopilotLexicon.keywords().size()).isGreaterThanOrEqualTo(500);
    }

    @Test
    void orientationOfTheLookBuilderReadsBackgroundWithoutTheWordFundo() {
        CopilotService service = serviceWithCatalog();
        Map<String, Object> o = service.orientation("Chrome Iridescent para um jantar de inverno, elegante", List.of(), List.of());
        assertThat(((Map<?, ?>) o.get("background")).get("aura")).asString().contains("aura_avantgarde_cromo");
        assertThat(o.get("season")).isEqualTo("WINTER");
        assertThat(service.orientation("   ", List.of(), List.of())).isEmpty();
    }

    @Test
    void picksAuraPresetAndVariantFromPlainWords() {
        CopilotService service = serviceWithCatalog();
        Map<String, Object> electro = scheme(service.backgroundPrompt("Look de festa com aura elétrica ciano", List.of(), List.of()));
        assertThat(electro.get("aura")).isEqualTo(Map.of("variantId", "aura_electro__01_cyan_pulse"));

        Map<String, Object> geometry = scheme(service.backgroundPrompt("Quero um fundo geométrico, geometria 3", List.of(), List.of()));
        assertThat(geometry.get("aura")).isEqualTo(Map.of("variantId", "aura_geometry__geometry_03"));

        Map<String, Object> splash = scheme(service.backgroundPrompt("aura com respingos de tinta", List.of(), List.of()));
        assertThat(((Map<?, ?>) splash.get("aura")).get("variantId")).asString().startsWith("aura_splash__");

        Map<String, Object> floral = scheme(service.backgroundPrompt("fundo floral para um date", List.of(), List.of()));
        assertThat(((Map<?, ?>) floral.get("aura")).get("variantId")).asString().startsWith("aura_romantico_petala__");
    }

    @Test
    void picksBackgroundMaterialGradientAndSeasonalPalette() {
        CopilotService service = serviceWithCatalog();
        Map<String, Object> velvet = scheme(service.backgroundPrompt("aura glam com textura de veludo", List.of(), List.of()));
        assertThat(velvet.get("materialId")).isEqualTo("veludo_profundo");
        assertThat(((Map<?, ?>) velvet.get("aura")).get("variantId")).asString().startsWith("aura_glam_noite__");

        Map<String, Object> jacket = scheme(service.backgroundPrompt("jaqueta de couro com fundo neon", List.of(), List.of()));
        assertThat(jacket).doesNotContainKey("materialId");

        Map<String, Object> gradient = scheme(service.backgroundPrompt("fundo com gradiente dourado", List.of(), List.of()));
        assertThat(gradient.get("gradientPresetId")).isEqualTo("iconic_gold");
        assertThat(gradient).doesNotContainKey("aura");

        Map<String, Object> winter = scheme(service.backgroundPrompt("fundo com a cartela sazonal de julho", List.of(), List.of()));
        assertThat(winter.get("seasonalPresetId")).isEqualTo("frost");
    }
}
