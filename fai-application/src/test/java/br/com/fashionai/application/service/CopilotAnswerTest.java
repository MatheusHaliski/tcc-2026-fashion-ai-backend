package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.insights.InsightService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ModerationStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.i18n.LocaleContextHolder;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Copilot: resposta da IA em JSON (às vezes dentro de ```json) vira o texto da resposta, com as refs da lista "pecas";
 * a frase dos looks traz a ocasião traduzida, no idioma da pessoa (antes: "… para work" em qualquer idioma). Copilot ›
 * Experimentar (P2-16): as combinações novas trazem os mesmos seis números dos looks do chat e do Autopiloto.
 */
@SuppressWarnings("unchecked")
class CopilotAnswerTest {
    @AfterEach
    void resetLocale() {
        LocaleContextHolder.resetLocaleContext();
    }

    @Test
    void respostaEmJsonViraTextoComAsRefs() {
        CopilotService.Answer a = CopilotService.plainAnswer(
                "{\"resposta\":\"Você tem 1 peça azul: a **Camisa azul**.\",\"pecas\":[\"p1\",\"p3\",\"x9\"],\"observacao\":\"...\"}");
        assertThat(a.text()).isEqualTo("Você tem 1 peça azul: a **Camisa azul**.");
        assertThat(a.refs()).containsExactly("p1", "p3");
    }

    @Test
    void jsonDentroDeBlocoDeCodigo() {
        CopilotService.Answer a = CopilotService.plainAnswer("```json\n{\"answer\": \"Use a [[p2]] com a [[p4]].\"}\n```");
        assertThat(a.text()).isEqualTo("Use a [[p2]] com a [[p4]].");
    }

    @Test
    void textoComumPassaComoVeio() {
        assertThat(CopilotService.plainAnswer("  Combine a [[p1]] com a [[p2]].  ").text()).isEqualTo("Combine a [[p1]] com a [[p2]].");
        // começa com chave mas não traz campo de resposta: mostra como veio em vez de apagar
        assertThat(CopilotService.plainAnswer("{sem json válido").text()).isEqualTo("{sem json válido");
        assertThat(CopilotService.plainAnswer(null).text()).isEmpty();
    }

    @Test
    void ocasiaoTraduzidaNaFraseDosLooks() {
        LocaleContextHolder.setLocale(Locale.forLanguageTag("pt-BR"));
        assertThat(CopilotService.lookSummary(2, List.of("work"))).isEqualTo("Separei 2 looks com peças do seu acervo para trabalho.");
        assertThat(CopilotService.lookSummary(3, List.of())).isEqualTo("Separei 3 looks com peças do seu acervo.");
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        assertThat(CopilotService.lookSummary(2, List.of("work", "night_out"))).isEqualTo("I picked 2 looks with pieces from your closet for work/night out.");
    }

    // ================================================================== Experimentar: números nas combinações (P2-16)
    static WardrobeItem piece(User u, String name, String category, String subcategory, int wears) {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(u);
        w.setName(name);
        w.setCategory(category);
        w.setSubcategory(subcategory);
        w.setColor("black");
        w.setMaterial("COTTON");
        w.setStyleTags("casual");
        w.setOccasionTags("casual");
        w.setWearCount(wears);
        w.setLastWornDate(LocalDate.now(FaiPointsService.ZONE).minusDays(3));
        w.markCreatedAt(Instant.now().minusSeconds(200L * 86400));
        w.setAvailabilityStatus(AvailabilityStatus.AVAILABLE);
        w.setModerationStatus(ModerationStatus.APPROVED);
        w.setDisponivel(true);
        return w;
    }

    @Test
    void novasCombinacoesTrazemOsSeisNumerosSemZeroParaSemBase() {
        UUID uid = UUID.randomUUID();
        CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        User u = new User();
        u.assignId(uid);
        u.setProfileType(ProfileType.PESSOAL);
        List<WardrobeItem> closet = new ArrayList<>(List.of(piece(u, "Camiseta preta", "upper_piece", "t_shirt", 10), piece(u, "Camisa branca", "upper_piece", "shirt", 2),
                piece(u, "Calça jeans", "lower_piece", "jeans", 8), piece(u, "Calça de alfaiataria", "lower_piece", "tailored_pants", 1),
                piece(u, "Tênis preto", "shoes_piece", "casual_sneakers", 12), piece(u, "Mocassim", "shoes_piece", "loafers", 0)));
        WardrobeService wardrobe = mock(WardrobeService.class);
        WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
        WeatherService weather = mock(WeatherService.class);
        HypeQueryService hype = mock(HypeQueryService.class);
        when(wardrobe.eligible(uid)).thenReturn(closet);
        when(weather.resolve(any(), any(), any())).thenReturn(WeatherService.Context.none(""));
        when(pieces.findByIdIn(anyCollection())).thenAnswer(inv -> closet.stream().filter(w -> ((Collection<UUID>) inv.getArgument(0)).contains(w.getId())).toList());
        Map<UUID, HypeScoreCurrent> rows = new HashMap<>();
        for (WardrobeItem w : closet) {
            HypeScoreCurrent c = new HypeScoreCurrent();
            c.setEntityType(HypeEntityType.PIECE);
            c.setEntityId(w.getId());
            c.setStatus(HypeStatus.AVAILABLE);
            c.setScore(BigDecimal.valueOf(40));
            c.setDimensions(new HypeDimensions());
            rows.put(w.getId(), c);
        }
        when(hype.currentOf(eq(HypeEntityType.PIECE), anyCollection())).thenReturn(rows);
        CopilotService copilot = new CopilotService(wardrobe, pieces, mock(SchemeRepository.class), mock(SchemeItemRepository.class), mock(DailyLookRepository.class),
                mock(StyleDnaRepository.class), mock(UserPreferencesRepository.class), mock(RoomService.class), mock(MirrorService.class), mock(InventoryScoreService.class),
                mock(ChallengeService.class), mock(AutopilotService.class), mock(DailyLookService.class), weather, mock(AiEngine.class), mock(Audit.class),
                mock(SchemeService.class), mock(BackgroundStudioService.class), hype, mock(InsightService.class));

        Map<String, Object> out = copilot.suggestions(me, null, null, null);
        List<Map<String, Object>> fresh = (List<Map<String, Object>>) out.get("newCombinations");
        assertThat(fresh).isNotEmpty().allSatisfy(c -> {
            assertThat(c).containsKeys("title", "rationale", "occasions", "styles", "pieces", "pieceIds");   // campos de antes intactos
            Map<String, Object> scores = (Map<String, Object>) c.get("scores");
            assertThat(scores).containsOnlyKeys("compatibility", "hype", "novelty", "reuse", "usage", "sustainability");
            assertThat(scores.get("hype")).isEqualTo(40);           // média v2 das peças
            assertThat(scores.get("compatibility")).isNull();      // sem DNA: sem base ("—"), nunca 0
            assertThat(scores.get("novelty")).isEqualTo(100);       // pares nunca combinados em looks salvos
        });
    }
}
