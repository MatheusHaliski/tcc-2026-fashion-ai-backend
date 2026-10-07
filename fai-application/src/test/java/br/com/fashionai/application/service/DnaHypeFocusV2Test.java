package br.com.fashionai.application.service;

import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.DnaScheme;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.DnaCell;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * DNA de estilo › narrativa HYPE_FOCUS em HypeScore v2 (P2-12): score + faixa do v2 (nunca o v1, nunca "%"), "sem dados"
 * como status — nunca 0 —, Hype pessoal para o dono e só o público elegível para quem visita. Hype ≠ DNA: as demais
 * narrativas não mudam com o Hype.
 */
@SuppressWarnings("unchecked")
class DnaHypeFocusV2Test {
    private final User owner = new User();
    private final CurrentUser me = new CurrentUser(UUID.randomUUID(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final CurrentUser visitor = new CurrentUser(UUID.randomUUID(), "bia", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private final HypeScoreCurrentRepository hypeRepo = mock(HypeScoreCurrentRepository.class);
    private final SchemeItemRepository schemeItems = mock(SchemeItemRepository.class);
    private DnaService dna;
    private Scheme viral, insufficient, notCalculated, privateHot;

    Scheme look(String title, int daysAgo) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setTitle(title);
        s.markCreatedAt(Instant.parse("2026-09-30T10:00:00Z").minusSeconds(daysAgo * 86400L));
        return s;
    }

    HypeScoreCurrent row(Scheme s, HypeStatus status, Double score, HypeLevel level, boolean publicEligible) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(HypeEntityType.SCHEME);
        c.setEntityId(s.getId());
        c.setOwnerId(me.id());
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(status);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setPublicEligible(publicEligible);
        c.setDimensions(new HypeDimensions());
        c.setCalculatedAt(Instant.now());
        return c;
    }

    @BeforeEach
    void setUp() {
        owner.assignId(me.id());
        owner.setUsername("ana");
        owner.setProfileType(ProfileType.PESSOAL);
        dna = new DnaService(null, null, null, null, null, null, schemeItems, null, null, null, null, null, null, null, hypeRepo, HypeScoreConfig.defaults());
        viral = look("Look viral", 1);
        insufficient = look("Look novo", 2);
        notCalculated = look("Look sem cálculo", 3);
        privateHot = look("Look privado", 4);
        when(schemeItems.findBySchemeIdIn(anyCollection())).thenReturn(List.of());
        when(hypeRepo.findByEntityTypeAndEntityIdInAndAlgorithmVersion(eq(HypeEntityType.SCHEME), anyCollection(), anyString())).thenReturn(List.of(
                row(viral, HypeStatus.AVAILABLE, 91.6, HypeLevel.VIRAL, true),
                row(insufficient, HypeStatus.INSUFFICIENT_DATA, null, null, true),
                row(privateHot, HypeStatus.AVAILABLE, 70.0, HypeLevel.HOT, false)));
    }

    DnaScheme hypeFocus() {
        DnaScheme d = new DnaScheme();
        d.assignId(UUID.randomUUID());
        d.setUser(owner);
        d.setTitle("Meu DNA");
        d.setNarrativeType(NarrativeType.HYPE_FOCUS);
        d.setTargetElement("DNA_COMPLETO");
        return d;
    }

    List<DnaService.CellRef> cells() {
        return List.of(new DnaService.CellRef(DnaCell.values()[0], notCalculated, null, false), new DnaService.CellRef(DnaCell.values()[1], insufficient, null, false),
                new DnaService.CellRef(DnaCell.values()[2], privateHot, null, false), new DnaService.CellRef(DnaCell.values()[3], viral, null, false));
    }

    static Map<String, Object> hypeOfCell(Map<String, Object> view, Scheme s) {
        return ((List<Map<String, Object>>) view.get("cells")).stream().filter(c -> s.getId().equals(c.get("schemeId"))).findFirst()
                .map(c -> (Map<String, Object>) c.get("hype")).orElseThrow();
    }

    @Test
    void ownerSeesPersonalV2ScoreAndLevelAndNoDataIsNeverZero() {
        Map<String, Object> view = dna.dnaSchemeView(me, hypeFocus(), cells());

        assertThat(hypeOfCell(view, viral)).containsEntry("status", "AVAILABLE").containsEntry("score", 91.6).containsEntry("level", "VIRAL");
        // look privado: o dono vê o próprio Hype pessoal
        assertThat(hypeOfCell(view, privateHot)).containsEntry("score", 70.0).containsEntry("level", "HOT");
        // dados insuficientes e não calculado: status, score nulo — nunca 0
        assertThat(hypeOfCell(view, insufficient)).containsEntry("status", "INSUFFICIENT_DATA").containsEntry("score", null).containsEntry("level", null);
        assertThat(hypeOfCell(view, notCalculated)).containsEntry("status", "NOT_CALCULATED").containsEntry("score", null);
        // o campo v1 (hypeScoreGlobal) saiu na limpeza do v1 (P3-16)
        assertThat(((List<Map<String, Object>>) view.get("cells")).get(0)).doesNotContainKey("hypeScoreGlobal");

        Map<String, Object> narrative = (Map<String, Object>) view.get("narrative");
        assertThat(narrative).containsEntry("basis", "HYPE_V2");
        List<Map<String, Object>> meters = (List<Map<String, Object>>) narrative.get("meters");
        // maior v2 primeiro; sem Hype por último
        assertThat(meters).extracting(m -> m.get("schemeId")).containsExactly(viral.getId(), privateHot.getId(), notCalculated.getId(), insufficient.getId());
        assertThat(meters.get(0)).containsEntry("score", 91.6).containsEntry("level", "VIRAL");
        assertThat(meters.get(3)).containsEntry("score", null).containsEntry("status", "INSUFFICIENT_DATA");
    }

    @Test
    void visitorOnlySeesPublicEligibleHype() {
        Map<String, Object> view = dna.dnaSchemeView(visitor, hypeFocus(), cells());

        assertThat(hypeOfCell(view, viral)).containsEntry("score", 91.6);
        // Hype de look não elegível ao público é só do dono: para quem visita, "ainda não calculado" (sem número)
        assertThat(hypeOfCell(view, privateHot)).containsEntry("status", "NOT_CALCULATED").containsEntry("score", null).containsEntry("level", null);
        List<Map<String, Object>> meters = (List<Map<String, Object>>) ((Map<String, Object>) view.get("narrative")).get("meters");
        assertThat(meters.get(0)).containsEntry("schemeId", viral.getId());
        assertThat(meters.stream().filter(m -> privateHot.getId().equals(m.get("schemeId"))).findFirst().orElseThrow()).containsEntry("score", null);
    }

    @Test
    void hypeFocusProposalPicksByV2AndOtherNarrativesIgnoreHype() {
        List<Scheme> pool = List.of(notCalculated, insufficient, privateHot, viral);
        Map<UUID, Double> v2 = Map.of(viral.getId(), 91.6, privateHot.getId(), 70.0);

        assertThat(DnaService.pickFor(NarrativeType.HYPE_FOCUS, pool, Map.of(), Season.AUTUMN, v2))
                .containsExactly(viral, privateHot, notCalculated, insufficient);
        // Hype ≠ DNA: as outras narrativas escolhem igual com ou sem Hype
        for (NarrativeType nt : List.of(NarrativeType.TIMELINE, NarrativeType.MOMENTOS_MARCANTES, NarrativeType.PALETA_DOMINANTE, NarrativeType.MOOD_BOARD)) {
            assertThat(DnaService.pickFor(nt, pool, Map.of(), Season.AUTUMN, v2)).as(nt.name())
                    .isEqualTo(DnaService.pickFor(nt, pool, Map.of(), Season.AUTUMN, Map.of()));
        }
        // a proposta local da narrativa HYPE_FOCUS usa o v2 e o texto descritivo novo (relevância, não qualidade)
        DnaService.DnaProposal hype = DnaService.localProposals(pool, Map.of(), new DnaService.DnaComposeRequest(null, List.of(), List.of(), NarrativeType.HYPE_FOCUS, null), v2)
                .get(0);
        assertThat(hype.narrativeType()).isEqualTo(NarrativeType.HYPE_FOCUS);
        assertThat(hype.cells()).extracting(DnaService.DnaCellForm::schemeId).startsWith(viral.getId(), privateHot.getId());
    }

    @Test
    void v2SummaryKeepsNoDataAsStatus() {
        assertThat(HypeScoreService.v2Summary(null, HypeScoreConfig.defaults(), Instant.now())).containsEntry("status", "NOT_CALCULATED").containsEntry("score", null);
        HypeScoreCurrent zero = row(viral, HypeStatus.AVAILABLE, 0.0, null, true);
        // score 0 disponível é "sinal baixo" de verdade (diferente de sem dados); a faixa vem do HypeScoreConfig quando falta
        assertThat(HypeScoreService.v2Summary(zero, HypeScoreConfig.defaults(), Instant.now())).containsEntry("score", 0.0).containsEntry("level", "LOW_SIGNAL");
        assertThat(HypeScoreService.magazineCover(Map.of("level", "TRENDING"))).containsEntry("unlocked", true).containsEntry("minLevel", "TRENDING");
        assertThat(HypeScoreService.magazineCover(Map.of("level", "HOT"))).containsEntry("unlocked", false);
        assertThat(HypeScoreService.magazineCover(Map.of("status", "INSUFFICIENT_DATA"))).containsEntry("unlocked", false);
    }
}
