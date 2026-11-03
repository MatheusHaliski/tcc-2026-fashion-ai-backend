package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import br.com.fashionai.domain.repository.HypeScoreSnapshotRepository;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** RF53 · P3-13 — o Hype pessoal no pacote LGPD; dependências nulas fora do contexto Spring (o bloco sai como null). */
final class AccountHypeExport {
    /** RF53 · P3-13: Hype pessoal (estado atual, histórico diário e marcos) na exportação LGPD; nulos fora do contexto Spring. */
    private final HypeScoreConfig hypeConfig;
    private final HypeScoreCurrentRepository hypeScores;
    private final HypeScoreSnapshotRepository hypeSnapshots;
    private final HypeMilestoneRepository hypeMilestones;

    AccountHypeExport(HypeScoreConfig hypeConfig, HypeScoreCurrentRepository hypeScores, HypeScoreSnapshotRepository hypeSnapshots,
                      HypeMilestoneRepository hypeMilestones) {
        this.hypeConfig = hypeConfig;
        this.hypeScores = hypeScores;
        this.hypeSnapshots = hypeSnapshots;
        this.hypeMilestones = hypeMilestones;
    }

    /** Lote de ids por consulta IN do histórico (contas com muitas peças não estouram o limite de parâmetros). */
    static final int HYPE_EXPORT_CHUNK = 500;

    /**
     * RF53 · P3-13 — Hype pessoal na exportação LGPD: o estado atual de cada peça/look da própria pessoa (score, faixa,
     * dimensões, se é elegível ao público), o histórico diário dos snapshots e os marcos de Hype já notificados. Só dados
     * da própria pessoa (dono = ela); nada de terceiros nem posição em ranking. Lê o que o job gravou (nada é recalculado).
     */
    Map<String, Object> hypeExport(User u, List<WardrobeItem> myPieces, List<Scheme> mySchemes) {
        if (hypeConfig == null || hypeScores == null) {
            return null;
        }
        String version = hypeConfig.algorithmVersion();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("algorithmVersion", version);
        out.put("note", Msg.k("account.hype.export_note"));
        List<Map<String, Object>> current = new ArrayList<>();
        List<Map<String, Object>> history = new ArrayList<>();
        for (HypeEntityType type : HypeEntityType.values()) {
            List<HypeScoreCurrent> rows = hypeScores.findByOwnerIdAndEntityTypeAndAlgorithmVersion(u.getId(), type, version);
            rows.forEach(c -> current.add(hypeCurrentRow(c)));
            if (hypeSnapshots == null) {
                continue;
            }
            // histórico: das entidades da pessoa (inclusive arquivadas, que saem do estado atual mas mantêm a série)
            java.util.LinkedHashSet<UUID> ids = new java.util.LinkedHashSet<>();
            rows.forEach(c -> ids.add(c.getEntityId()));
            if (type == HypeEntityType.PIECE) {
                myPieces.forEach(p -> ids.add(p.getId()));
            } else {
                mySchemes.forEach(s -> ids.add(s.getId()));
            }
            List<UUID> all = new ArrayList<>(ids);
            for (int i = 0; i < all.size(); i += HYPE_EXPORT_CHUNK) {
                List<UUID> chunk = all.subList(i, Math.min(all.size(), i + HYPE_EXPORT_CHUNK));
                hypeSnapshots.findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(type, chunk, version, java.time.LocalDate.EPOCH)
                        .stream().sorted(java.util.Comparator.comparing(HypeScoreSnapshot::getSnapshotDate))
                        .forEach(sn -> history.add(hypeHistoryRow(sn)));
            }
        }
        out.put("current", current);
        out.put("history", history);
        out.put("milestones", hypeMilestones == null ? List.of() : hypeMilestones.findByOwnerIdOrderByAchievedAtDesc(u.getId()).stream()
                .map(AccountHypeExport::hypeMilestoneRow).toList());
        return out;
    }

    static Map<String, Object> hypeCurrentRow(HypeScoreCurrent c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", c.getEntityType());
        m.put("entityId", c.getEntityId());
        m.put("status", c.getStatus());
        m.put("score", c.getScore());
        m.put("level", c.getLevel());
        m.put("direction", c.getDirection());
        m.put("deltaPoints", c.getDeltaPoints());
        m.put("deltaPercent", c.getDeltaPercent());
        m.put("momentum", c.getMomentum());
        m.put("publicEligible", c.isPublicEligible());
        m.put("dimensions", hypeDimensions(c.getDimensions()));
        m.put("windowStart", c.getWindowStart());
        m.put("windowEnd", c.getWindowEnd());
        m.put("calculatedAt", c.getCalculatedAt());
        return m;
    }

    static Map<String, Object> hypeHistoryRow(HypeScoreSnapshot s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", s.getEntityType());
        m.put("entityId", s.getEntityId());
        m.put("date", s.getSnapshotDate());
        m.put("status", s.getStatus());
        m.put("score", s.getScore());
        m.put("level", s.getLevel());
        m.put("publicEligible", s.isPublicEligible());
        return m;
    }

    static Map<String, Object> hypeMilestoneRow(HypeMilestone x) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("entityType", x.getEntityType());
        m.put("entityId", x.getEntityId());
        m.put("milestone", x.getMilestone());
        m.put("level", x.getLevel());
        m.put("momentum", x.getMomentum());
        m.put("score", x.getScore());
        m.put("publicEligible", x.isPublicEligible());
        m.put("achievedAt", x.getAchievedAt());
        m.put("notified", x.getNotificationId() != null);
        return m;
    }

    /** Dimensões presentes (ausente fica fora — nunca 0 por falta de dado). */
    static Map<String, Object> hypeDimensions(HypeDimensions d) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (d == null) {
            return m;
        }
        java.util.function.BiConsumer<String, BigDecimal> put = (k, v) -> {
            if (v != null) {
                m.put(k, v);
            }
        };
        put.accept("POPULARITY", d.getPopularity());
        put.accept("ENGAGEMENT", d.getEngagement());
        put.accept("TREND", d.getTrend());
        put.accept("TREND_VELOCITY", d.getTrendVelocity());
        put.accept("ORIGINALITY", d.getOriginality());
        put.accept("RARITY", d.getRarity());
        put.accept("LONGEVITY", d.getLongevity());
        put.accept("NOVELTY", d.getNovelty());
        put.accept("INFLUENCE", d.getInfluence());
        return m;
    }
}
