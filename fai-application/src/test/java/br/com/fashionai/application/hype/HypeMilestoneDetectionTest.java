package br.com.fashionai.application.hype;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.domain.model.HypeMilestone.Kind;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.HypeSignalType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import br.com.fashionai.domain.repository.HypeSignalDailyRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · P1-10 — detecção do marco de Hype no job de snapshots: só subida (nunca queda), nada sem estado anterior e o
 * evento publicado depois de gravar o estado. A notificação (dedupe, resumo diário, privacidade) fica em {@link HypeMilestoneTest}.
 */
class HypeMilestoneDetectionTest {
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-10-05T15:00:00Z"));   // 12h em São Paulo
    private final User owner = HypeMilestoneTest.user();

    // ------------------------------------------------------------------ detecção no job (só subida)
    @Test
    void soSubidaParaEmAltaTendenciaOuViralViraMarco() {
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, HypeMomentum.STABLE, HypeLevel.HOT, HypeMomentum.STABLE)).containsExactly(Kind.HOT);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, null, HypeLevel.VIRAL, null)).containsExactly(Kind.VIRAL);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, null, HypeLevel.TRENDING, null)).containsExactly(Kind.TRENDING);
        // "dados insuficientes" (faixa nula) → Em alta é subida
        assertThat(HypeSnapshotService.milestones(true, null, null, HypeLevel.HOT, null)).containsExactly(Kind.HOT);
        // faixa e momento sobem juntos: dois marcos
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.RELEVANT, HypeMomentum.RISING, HypeLevel.HOT, HypeMomentum.EMERGING))
                .containsExactly(Kind.HOT, Kind.EMERGING);
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.LOW_SIGNAL, HypeMomentum.STABLE, HypeLevel.NICHE, HypeMomentum.EMERGING))
                .containsExactly(Kind.EMERGING);
    }

    @Test
    void quedaPermanenciaOuFaixaSemMarcoNuncaNotificam() {
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.STABLE, HypeLevel.HOT, HypeMomentum.STABLE)).isEmpty();
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.TRENDING, null, HypeLevel.HOT, null)).isEmpty();          // caiu
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.VIRAL, null, HypeLevel.RELEVANT, null)).isEmpty();        // caiu
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.VIRAL, null, null, null)).isEmpty();                     // ficou sem dados
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.NICHE, null, HypeLevel.RELEVANT, null)).isEmpty();        // subiu, mas não é marco
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.EMERGING, HypeLevel.HOT, HypeMomentum.EMERGING)).isEmpty();
        assertThat(HypeSnapshotService.milestones(true, HypeLevel.HOT, HypeMomentum.EMERGING, HypeLevel.HOT, HypeMomentum.COOLING)).isEmpty();
        // sem estado anterior (1º cálculo ou nova versão do algoritmo): nada de avisos em massa
        assertThat(HypeSnapshotService.milestones(false, null, null, HypeLevel.VIRAL, HypeMomentum.EMERGING)).isEmpty();
    }

    /** O job publica o marco DEPOIS de gravar o estado (e o listener só roda após o commit). */
    @Test
    void jobPublicaOMarcoDepoisDeGravarOEstado() {
        HypeScoreConfig config = HypeScoreConfig.defaults();
        HypeScoreCurrentRepository current = mock(HypeScoreCurrentRepository.class);
        HypeScoreSnapshotRepository snaps = mock(HypeScoreSnapshotRepository.class);
        ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
        HypeSnapshotService job = new HypeSnapshotService(config, pieces, schemes, mock(SchemeItemRepository.class), mock(HypeSignalDailyRepository.class),
                current, snaps, mock(HypeCache.class), events);
        UUID id = UUID.randomUUID();
        HypeInputs strong = strongInputs(config);
        HypeResult r = new HypeCalculator(config).compute(strong, new HypeCalculator(config).baseline(List.of(strong)));
        assertThat(r.level()).as("entrada forte precisa cair numa faixa de marco").isIn(HypeLevel.HOT, HypeLevel.TRENDING, HypeLevel.VIRAL);

        HypeScoreCurrent before = new HypeScoreCurrent();
        before.setEntityType(HypeEntityType.PIECE);
        before.setEntityId(id);
        before.setStatus(HypeStatus.AVAILABLE);
        before.setLevel(HypeLevel.NICHE);
        when(current.findByEntityTypeAndAlgorithmVersion(HypeEntityType.PIECE, config.algorithmVersion())).thenReturn(List.of(before));
        job.persist(HypeEntityType.PIECE, List.of(new HypeSnapshotService.Entry(id, owner.getId(), strong, false, "TOPS", null, null)),
                LocalDate.of(2026, 10, 5), now.get());

        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        InOrder order = inOrder(current, events);
        order.verify(current).saveAll(anyList());
        order.verify(events).publishEvent(published.capture());
        DomainEvents.HypeMilestone m = (DomainEvents.HypeMilestone) published.getValue();
        assertThat(m.milestone()).isEqualTo(Kind.ofLevel(r.level()));
        assertThat(m.ownerId()).isEqualTo(owner.getId());
        assertThat(m.publicEligible()).isFalse();   // item privado: Hype pessoal (o aviso vai só para o dono)

        // segunda execução com o estado já gravado na mesma faixa: nenhum evento novo
        before.setLevel(r.level());
        before.setMomentum(r.momentum());
        job.persist(HypeEntityType.PIECE, List.of(new HypeSnapshotService.Entry(id, owner.getId(), strong, false, "TOPS", null, null)),
                LocalDate.of(2026, 10, 5), now.get());
        verify(events, times(1)).publishEvent(any(Object.class));
    }

    static HypeInputs strongInputs(HypeScoreConfig config) {
        int h = config.horizonDays();
        double[] activity = new double[h];
        double[] interactions = new double[h];
        double[] views = new double[h];
        for (int d = 0; d < h; d++) {
            double v = d < 7 ? 60 : d < 14 ? 6 : 2;   // crescimento forte e recente, com histórico
            activity[d] = v;
            interactions[d] = v * 0.8;
            views[d] = v * 3;
        }
        Map<HypeSignalType, double[]> windows = new EnumMap<>(HypeSignalType.class);
        windows.put(HypeSignalType.LIKE_CREATED, new double[]{200, 20});
        windows.put(HypeSignalType.SAVE_CREATED, new double[]{120, 10});
        return new HypeInputs(HypeEntityType.PIECE, activity, interactions, views, windows, 2000, 5000, 900, 60, 0.05, 40.0, 6.0, null, false);
    }
}
