package br.com.fashionai.application.service;

import br.com.fashionai.application.assets.AssetCatalogService;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.UserPreferences;
import br.com.fashionai.domain.model.enums.ThemeMode;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Caracterização (lote GoF 03) das regras de valor de {@link PreferencesService#update} e
 * {@link PreferencesService#updateProfile}: código de erro de cada recusa, normalização dos valores aceitos, ordem em que
 * as regras são avaliadas (o primeiro erro vence), limites e a regra de conflito entre aparelhos. Só dados sintéticos do
 * {@link World}; nenhum dado pessoal real.
 */
class PreferencesServiceCharacterizationTest {
    private Kit kit;
    private World world;
    private PreferencesService prefs;
    private CurrentUser me;

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        AssetCatalogService assets = kit.dep(AssetCatalogService.class);
        when(assets.isChromeBackground("aurora")).thenReturn(true);
        when(assets.cardSkin("atelier")).thenReturn(Optional.of(Map.of("id", "atelier")));
        when(kit.dep(MediaService.class).requireOwnedMedia(any(), anyString(), any(), anyString()))
                .thenAnswer(i -> new MediaService.OwnedMedia("k", i.getArgument(1)));
        prefs = kit.build(PreferencesService.class);
        me = Kit.as(world.me);
    }

    private Map<String, Object> update(String json) {
        return prefs.update(me, Json.read(json, PreferencesService.Update.class));
    }

    private String codeOf(String json) {
        try {
            update(json);
        } catch (ApiException e) {
            assertThat(e.status()).isEqualTo(400);
            return e.code();
        }
        throw new AssertionError("esperava recusa para " + json);
    }

    private static PreferencesService.ProfileUpdate profile(String country, List<Map<String, String>> links, Map<String, Object> face) {
        return new PreferencesService.ProfileUpdate(null, null, null, null, country, null, null, null, links, face);
    }

    private String profileCode(PreferencesService.ProfileUpdate cmd) {
        try {
            prefs.updateProfile(me, cmd);
        } catch (ApiException e) {
            assertThat(e.status()).isEqualTo(400);
            return e.code();
        }
        throw new AssertionError("esperava recusa");
    }

    @Test
    void cadaRecusaTemSeuCodigoEstavel() {
        assertThat(codeOf("{\"currency\":\"JPY\"}")).isEqualTo("MOEDA_INVALIDA");
        assertThat(codeOf("{\"navOrder\":{\"groups\":[\"admin\"]}}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
        assertThat(codeOf("{\"fontScale\":79}")).isEqualTo("FONTE_INVALIDA");
        assertThat(codeOf("{\"fontScale\":161}")).isEqualTo("FONTE_INVALIDA");
        assertThat(codeOf("{\"coreAesthetic\":\"punk\"}")).isEqualTo("CORE_INVALIDO");
        assertThat(codeOf("{\"chromeBackgroundId\":\"inexistente\"}")).isEqualTo("FUNDO_INVALIDO");
        assertThat(codeOf("{\"contentContainerColor\":\"#abc\"}")).isEqualTo("COR_INVALIDA");
        assertThat(codeOf("{\"contentContainerColor\":\"aabbcc\"}")).isEqualTo("COR_INVALIDA");
        assertThat(codeOf("{\"mannequinSkinTone\":\"verde\"}")).isEqualTo("TOM_INVALIDO");
        assertThat(codeOf("{\"defaultCardSkin\":\"nao-existe\"}")).isEqualTo("SKIN_INVALIDA");
    }

    @Test
    void primeiroErroNaOrdemDoMetodoVence() {
        assertThat(codeOf("{\"currency\":\"JPY\",\"navOrder\":{\"groups\":[\"x\"]},\"fontScale\":1,\"coreAesthetic\":\"punk\",\"contentContainerColor\":\"azul\"}"))
                .isEqualTo("MOEDA_INVALIDA");
        assertThat(codeOf("{\"navOrder\":{\"groups\":[\"x\"]},\"fontScale\":1,\"coreAesthetic\":\"punk\"}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
        assertThat(codeOf("{\"fontScale\":1,\"coreAesthetic\":\"punk\",\"contentContainerColor\":\"azul\"}")).isEqualTo("FONTE_INVALIDA");
        assertThat(codeOf("{\"coreAesthetic\":\"punk\",\"chromeBackgroundId\":\"inexistente\",\"contentContainerColor\":\"azul\"}")).isEqualTo("CORE_INVALIDO");
        assertThat(codeOf("{\"chromeBackgroundId\":\"inexistente\",\"contentContainerColor\":\"azul\"}")).isEqualTo("FUNDO_INVALIDO");
        assertThat(codeOf("{\"contentContainerColor\":\"azul\",\"mannequinSkinTone\":\"verde\"}")).isEqualTo("COR_INVALIDA");
    }

    @Test
    void valoresAceitosSaoNormalizados() {
        assertThat(update("{\"fontScale\":80}")).containsEntry("fontScale", 80);
        assertThat(update("{\"fontScale\":160}")).containsEntry("fontScale", 160);
        assertThat(update("{\"currency\":\" eur \"}")).containsEntry("currency", "EUR");
        assertThat(update("{\"currency\":\"auto\"}").get("currency")).isNull();
        assertThat(update("{\"currency\":\"brl\"}")).containsEntry("currency", "BRL");
        assertThat(update("{\"currency\":\"  \"}").get("currency")).isNull();
        assertThat(update("{\"coreAesthetic\":\" gorpcore \"}")).containsEntry("coreAesthetic", "GORPCORE");
        assertThat(update("{\"contentContainerColor\":\" #a1b2c3 \"}")).containsEntry("contentContainerColor", "#A1B2C3");
        assertThat(update("{\"chromeBackgroundId\":\"aurora\"}")).containsEntry("chromeBackgroundId", "aurora");
        assertThat(world.me.getInterfaceBackgroundPresetId()).isEqualTo("aurora");
        assertThat(update("{\"chromeBackgroundId\":\"   \"}").get("chromeBackgroundId")).isNull();
        assertThat(world.me.getInterfaceBackgroundPresetId()).isNull();
    }

    @Test
    void ordemDoMenuNormalizadaComLimites() {
        Map<String, Object> saved = update("{\"navOrder\":{\"groups\":[\"nav.group.play\"]}}");
        assertThat(saved.get("navOrder")).isEqualTo(Map.of("groups", List.of("nav.group.play"), "items", Map.of()));
        saved = update("{\"navOrder\":{\"items\":{\"nav.group.play\":[\"/a\"]}}}");
        assertThat(saved.get("navOrder")).isEqualTo(Map.of("groups", List.of(), "items", Map.of("nav.group.play", List.of("/a"))));
        String thirteen = String.join(",", IntStream.range(0, 13).mapToObj(i -> "\"nav.group.g" + (char) ('a' + i) + "\"").toList());
        assertThat(codeOf("{\"navOrder\":{\"groups\":[" + thirteen + "]}}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
        String twentyOne = String.join(",", IntStream.range(0, 21).mapToObj(i -> "\"/p" + i + "\"").toList());
        assertThat(codeOf("{\"navOrder\":{\"items\":{\"nav.group.play\":[" + twentyOne + "]}}}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
        assertThat(codeOf("{\"navOrder\":{\"groups\":[1]}}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
        assertThat(codeOf("{\"navOrder\":{\"items\":{\"admin\":[\"/a\"]}}}")).isEqualTo("ORDEM_DO_MENU_INVALIDA");
    }

    @Test
    void conflitoEntreAparelhosAMaisRecenteVence() {
        Instant t = Instant.parse("2026-01-01T10:00:00Z");
        assertThat(update("{\"theme\":\"DARK\",\"clientUpdatedAt\":\"" + t + "\"}")).containsEntry("theme", ThemeMode.DARK)
                .containsEntry("clientUpdatedAt", t);
        // mesmo instante: aplica (só o estritamente anterior é ignorado)
        assertThat(update("{\"theme\":\"LIGHT\",\"clientUpdatedAt\":\"" + t + "\"}")).containsEntry("theme", ThemeMode.LIGHT);
        // anterior: ignorado sem erro, nem validação (valor inválido não é recusado)
        assertThat(update("{\"theme\":\"DARK\",\"fontScale\":1,\"clientUpdatedAt\":\"" + t.minusSeconds(1) + "\"}"))
                .containsEntry("theme", ThemeMode.LIGHT).containsEntry("clientUpdatedAt", t);
        // sem clientUpdatedAt: aplica e grava o instante do servidor
        Map<String, Object> now = update("{\"theme\":\"DARK\"}");
        assertThat(now).containsEntry("theme", ThemeMode.DARK);
        assertThat((Instant) now.get("clientUpdatedAt")).isAfter(t);
    }

    @Test
    void perfilPaisLinksERostoNormalizados() {
        prefs.get(me);
        prefs.updateProfile(me, profile(" pt ", null, null));
        assertThat(world.me.getCountry()).isEqualTo("PT");
        prefs.updateProfile(me, profile("", null, null));
        assertThat(world.me.getCountry()).isNull();
        assertThat(profileCode(profile("BRA", null, null))).isEqualTo("PAIS_INVALIDO");

        String longTitle = "t".repeat(55);
        List<Map<String, String>> links = new ArrayList<>(List.of(
                Map.of("url", " HTTPS://example.com/a ", "title", " "),
                Map.of("url", ""),
                Map.of("url", "http://example.org", "title", longTitle)));
        prefs.updateProfile(me, profile(null, links, null));
        assertThat(Json.list(world.me.getLinksJson())).containsExactly(
                Map.of("title", "example.com/a", "url", "HTTPS://example.com/a"),
                Map.of("title", "t".repeat(40), "url", "http://example.org"));
        List<Map<String, String>> six = IntStream.range(0, 6).mapToObj(i -> Map.of("url", "")).toList();
        assertThat(profileCode(profile(null, six, null))).isEqualTo("LINKS_DEMAIS");
        assertThat(profileCode(profile(null, List.of(Map.of("url", "ftp://example.com")), null))).isEqualTo("LINK_INVALIDO");

        prefs.updateProfile(me, profile(null, null, Map.of("offsetX", 5, "scale", "grande")));
        UserPreferences p = kit.dep(UserPreferencesRepository.class).findByUserId(world.me.getId()).orElseThrow();
        assertThat(Json.map(p.getMannequinFaceJson())).containsExactly(
                Map.entry("offsetX", 0.3), Map.entry("offsetY", 0.0), Map.entry("scale", 1.0));
        prefs.updateProfile(me, profile(null, null, Map.of("offsetX", -1, "offsetY", 0.1, "scale", 9)));
        assertThat(Json.map(p.getMannequinFaceJson())).containsExactly(
                Map.entry("offsetX", -0.3), Map.entry("offsetY", 0.1), Map.entry("scale", 1.8));
    }
}
