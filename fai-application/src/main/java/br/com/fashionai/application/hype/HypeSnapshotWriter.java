package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.hype.HypeCalculator.Baseline;
import br.com.fashionai.application.hype.HypeResult.HypeReason;
import br.com.fashionai.application.hype.HypeScoreConfig.Dimension;
import br.com.fashionai.application.hype.HypeSnapshotService.Entry;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * HypeScore v2 — gravação do job: calcula cada entrada contra a régua pública, grava o estado atual e o ponto do dia,
 * publica os marcos de subida depois de gravar e tira do estado atual o que foi arquivado/excluído.
 */
final class HypeSnapshotWriter {
    private final HypeScoreConfig config;
    private final HypeCalculator calculator;
    private final HypeScoreCurrentRepository current;
    private final HypeScoreSnapshotRepository snapshots;
    private final ApplicationEventPublisher events;
    /** Contagens por tipo de sinal da execução corrente (o mapa do serviço, preenchido no início do recálculo). */
    private final Map<HypeEntityType, Map<UUID, Map<String, Map<String, Object>>>> byType;

    HypeSnapshotWriter(HypeScoreConfig config, HypeCalculator calculator, HypeScoreCurrentRepository current, HypeScoreSnapshotRepository snapshots,
                       ApplicationEventPublisher events, Map<HypeEntityType, Map<UUID, Map<String, Map<String, Object>>>> byType) {
        this.config = config;
        this.calculator = calculator;
        this.current = current;
        this.snapshots = snapshots;
        this.events = events;
        this.byType = byType;
    }

    int persist(HypeEntityType type, List<Entry> entries, LocalDate today, Instant now) {
        String version = config.algorithmVersion();
        Baseline base = calculator.baseline(entries.stream().filter(Entry::publicEligible).map(Entry::inputs).toList());
        Map<UUID, HypeScoreCurrent> existing = current.findByEntityTypeAndAlgorithmVersion(type, version).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, HypeScoreSnapshot> todays = snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, version, today, today).stream()
                .collect(Collectors.toMap(HypeScoreSnapshot::getEntityId, Function.identity(), (a, b) -> a));
        Map<UUID, Double> deltaBase = deltaBase(type, version, today);
        Instant windowStart = now.minus(config.horizonDays(), ChronoUnit.DAYS);
        List<HypeScoreCurrent> toSave = new ArrayList<>();
        List<HypeScoreSnapshot> toSnap = new ArrayList<>();
        List<DomainEvents.HypeMilestone> reached = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Entry e : entries) {
            HypeResult r = calculator.compute(e.inputs(), base);
            seen.add(e.id());
            HypeScoreCurrent c = existing.getOrDefault(e.id(), new HypeScoreCurrent());
            // RF53 · P1-10: estado ANTERIOR (antes de sobrescrever) para detectar subida de faixa / emergente
            boolean hadPrevious = existing.containsKey(e.id());
            HypeLevel levelBefore = c.getLevel();
            HypeMomentum momentumBefore = c.getMomentum();
            for (HypeMilestone.Kind k : milestones(hadPrevious, levelBefore, momentumBefore, r.level(), r.momentum())) {
                reached.add(new DomainEvents.HypeMilestone(type, e.id(), e.ownerId(), k, r.level(), r.momentum(), r.score(), e.publicEligible()));
            }
            c.setEntityType(type);
            c.setEntityId(e.id());
            c.setOwnerId(e.ownerId());
            c.setAlgorithmVersion(version);
            c.setStatus(r.status());
            c.setScore(dec(r.score()));
            c.setLevel(r.level());
            c.setDimensions(dimensions(r.dimensions()));
            Double baseScore = deltaBase.get(e.id());
            if (r.score() != null && baseScore != null) {
                c.setDeltaPoints(dec(r.score() - baseScore));
                c.setDeltaPercent(baseScore > 0 ? dec((r.score() - baseScore) / baseScore * 100) : null);
                c.setDirection(calculator.direction(r.score(), baseScore));
            } else {
                c.setDeltaPoints(null);
                c.setDeltaPercent(null);
                c.setDirection(null);
            }
            c.setMomentum(r.momentum());
            c.setPublicEligible(e.publicEligible());
            c.setCategory(e.category());
            c.setStyles(e.styles());
            c.setOccasions(e.occasions());
            c.setCountry(e.country());
            c.setRegion(e.region());
            c.setCategories(e.categories());
            c.setSubcategories(e.subcategories());
            Map<String, Object> sig = new LinkedHashMap<>(r.signals());
            sig.put("ageDays", e.inputs().ageDays());
            // contagem real por tipo de sinal (janela atual × anterior × horizonte): o que a análise completa lista
            sig.put("byType", byType.getOrDefault(type, Map.of()).getOrDefault(e.id(), Map.of()));
            c.setSignalsJson(Json.write(sig));
            c.setReasonsJson(Json.write(r.reasons().stream().map(HypeSnapshotWriter::reason).toList()));
            c.setWindowStart(windowStart);
            c.setWindowEnd(now);
            c.setCalculatedAt(now);
            toSave.add(c);

            HypeScoreSnapshot s = todays.getOrDefault(e.id(), new HypeScoreSnapshot());
            s.setEntityType(type);
            s.setEntityId(e.id());
            s.setAlgorithmVersion(version);
            s.setSnapshotDate(today);
            s.setStatus(r.status());
            s.setScore(dec(r.score()));
            s.setLevel(r.level());
            s.setDimensions(dimensions(r.dimensions()));
            s.setPublicEligible(e.publicEligible());
            s.setWindowStart(windowStart);
            s.setWindowEnd(now);
            s.setCalculatedAt(now);
            toSnap.add(s);
        }
        current.saveAll(toSave);
        snapshots.saveAll(toSnap);
        // só depois de gravar: o HypeMilestoneNotifier ouve AFTER_COMMIT (rollback do job = nenhum aviso)
        if (events != null) {
            reached.forEach(events::publishEvent);
        }
        // entidade arquivada/excluída sai do estado atual (e, portanto, de qualquer ranking); o histórico fica
        List<HypeScoreCurrent> gone = existing.values().stream().filter(c -> !seen.contains(c.getEntityId())).toList();
        current.deleteAll(gone);
        return toSave.size();
    }

    /**
     * RF53 · P1-10 — marcos de Hype entre o estado anterior e o novo. Só SUBIDA: a faixa nova precisa ser Em alta,
     * Tendência ou Viral e estar acima da anterior (queda ou permanência nunca contam); EMERGING conta quando surge (não
     * estava emergente antes). Sem estado anterior (primeiro cálculo da entidade ou troca de {@code algorithmVersion})
     * não há marco: não se compara com o nada, e uma nova versão do algoritmo não dispara avisos em massa. "Dados
     * insuficientes" (faixa nula) → Em alta conta como subida. A 1ª vez (dedupe) fica com o notifier, que conhece o histórico.
     */
    static List<HypeMilestone.Kind> milestones(boolean hadPrevious, HypeLevel levelBefore, HypeMomentum momentumBefore,
                                               HypeLevel levelAfter, HypeMomentum momentumAfter) {
        if (!hadPrevious) {
            return List.of();
        }
        List<HypeMilestone.Kind> out = new ArrayList<>(2);
        HypeMilestone.Kind level = HypeMilestone.Kind.ofLevel(levelAfter);
        if (level != null && (levelBefore == null || levelAfter.ordinal() > levelBefore.ordinal())) {
            out.add(level);
        }
        if (momentumAfter == HypeMomentum.EMERGING && momentumBefore != HypeMomentum.EMERGING) {
            out.add(HypeMilestone.Kind.EMERGING);
        }
        return out;
    }

    /** Score de referência para o delta: o snapshot mais recente com data ≤ hoje − janela (até 3 dias antes disso). */
    Map<UUID, Double> deltaBase(HypeEntityType type, String version, LocalDate today) {
        LocalDate target = today.minusDays(config.deltaWindowDays());
        Map<UUID, HypeScoreSnapshot> best = new HashMap<>();
        for (HypeScoreSnapshot s : snapshots.findByEntityTypeAndAlgorithmVersionAndSnapshotDateBetween(type, version, target.minusDays(3), target)) {
            if (s.getScore() == null) {
                continue;
            }
            best.merge(s.getEntityId(), s, (a, b) -> a.getSnapshotDate().isAfter(b.getSnapshotDate()) ? a : b);
        }
        Map<UUID, Double> out = new HashMap<>();
        best.forEach((id, s) -> out.put(id, s.getScore().doubleValue()));
        return out;
    }

    static Map<String, Object> reason(HypeReason r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", r.code());
        m.put("tone", r.tone());
        if (r.dimension() != null) {
            m.put("dimension", r.dimension());
        }
        if (r.value() != null) {
            m.put("value", r.value());
        }
        return m;
    }

    static HypeDimensions dimensions(Map<Dimension, Double> d) {
        HypeDimensions out = new HypeDimensions();
        out.setPopularity(dec(d.get(Dimension.POPULARITY)));
        out.setEngagement(dec(d.get(Dimension.ENGAGEMENT)));
        out.setTrend(dec(d.get(Dimension.TREND)));
        out.setTrendVelocity(dec(d.get(Dimension.TREND_VELOCITY)));
        out.setNovelty(dec(d.get(Dimension.NOVELTY)));
        out.setLongevity(dec(d.get(Dimension.LONGEVITY)));
        out.setRarity(dec(d.get(Dimension.RARITY)));
        out.setOriginality(dec(d.get(Dimension.ORIGINALITY)));
        out.setInfluence(dec(d.get(Dimension.INFLUENCE)));
        return out;
    }

    static BigDecimal dec(Double v) {
        return v == null ? null : BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
