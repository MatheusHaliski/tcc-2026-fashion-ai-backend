package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.hype.HypeCache;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.Seal;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.SealBondStatus;
import br.com.fashionai.domain.model.enums.SealTier;
import br.com.fashionai.domain.repository.SealBondRepository;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * RF53 · P2-09 — "Hype do selo" e Hype dos looks vinculados nas métricas do emissor: médias do HypeScore v2 atual
 * só dos itens públicos elegíveis, com cache pelo {@link HypeCache}. Colaborador do {@link SealService} (R80).
 */
final class SealHypeAverages {
    private final SealBondRepository bonds;
    private final Supplier<HypeQueryService> hypeQuery;
    private final Supplier<HypeCache> cache;

    SealHypeAverages(SealBondRepository bonds, Supplier<HypeQueryService> hypeQuery, Supplier<HypeCache> cache) {
        this.bonds = bonds;
        this.hypeQuery = hypeQuery;
        this.cache = cache;
    }

    /**
     * RF53 — "Hype do selo": {@code {avgScore, level, bonded}} = média do HypeScore v2 atual dos itens com vínculo
     * APROVADO e vigente (selo de LOOK: os looks; selo de PEÇA: as peças vinculadas). {@code bonded} conta os itens
     * vinculados; a média usa só os públicos elegíveis com Hype disponível (o Hype de item privado é só do dono).
     * Cache pelo {@link HypeCache} (a geração muda a cada recálculo do Hype; o contador de emissões entra na chave).
     */
    Map<UUID, Map<String, Object>> sealHype(Collection<Seal> list) {
        List<Seal> distinct = list.stream().filter(Objects::nonNull).filter(s -> s.getId() != null).distinct().toList();
        if (distinct.isEmpty()) {
            return Map.of();
        }
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        Map<UUID, Map<String, Object>> batch = new HashMap<>();
        boolean[] loaded = {false};
        Supplier<Map<UUID, Map<String, Object>>> all = () -> {   // uma consulta para todos os selos, só se algum faltar no cache
            if (!loaded[0]) {
                batch.putAll(computeSealHype(distinct));
                loaded[0] = true;
            }
            return batch;
        };
        for (Seal s : distinct) {
            Supplier<Map<String, Object>> loader = () -> all.get().getOrDefault(s.getId(), emptySealHype());
            out.put(s.getId(), cache.get() == null ? loader.get()
                    : cache.get().get("seal-hype:" + s.getId() + ":" + s.getTier() + ":" + s.getUsageCount(), loader));
        }
        return out;
    }

    Map<UUID, Map<String, Object>> computeSealHype(List<Seal> list) {
        Map<UUID, Seal> byId = new HashMap<>();
        list.forEach(s -> byId.put(s.getId(), s));
        Instant now = Instant.now();
        Map<UUID, Set<UUID>> items = new HashMap<>();
        Set<UUID> looks = new HashSet<>();
        Set<UUID> pieces = new HashSet<>();
        for (SealBond b : bonds.findBySealIdInAndStatus(byId.keySet(), SealBondStatus.APPROVED)) {
            if (b.getSeal() == null || !byId.containsKey(b.getSeal().getId()) || (b.getExpiresAt() != null && b.getExpiresAt().isBefore(now))) {
                continue;
            }
            Set<UUID> set = items.computeIfAbsent(b.getSeal().getId(), k -> new LinkedHashSet<>());
            if (byId.get(b.getSeal().getId()).getTier() == SealTier.PECA) {
                for (String id : Json.strings(b.getLinkedPieceIdsJson())) {
                    UUID u = SealPieceBadges.uuid(id);
                    if (u != null) {
                        set.add(u);
                        pieces.add(u);
                    }
                }
            } else if (b.getScheme() != null) {
                set.add(b.getScheme().getId());
                looks.add(b.getScheme().getId());
            }
        }
        HypeQueryService q = hypeQuery.get();
        Map<UUID, HypeScoreCurrent> lookHype = q == null || looks.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.SCHEME, looks);
        Map<UUID, HypeScoreCurrent> pieceHype = q == null || pieces.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.PIECE, pieces);
        Map<UUID, Map<String, Object>> out = new HashMap<>();
        for (Seal s : list) {
            Set<UUID> ids = items.getOrDefault(s.getId(), Set.of());
            Map<UUID, HypeScoreCurrent> rows = s.getTier() == SealTier.PECA ? pieceHype : lookHype;
            double[] scores = ids.stream().map(rows::get).filter(SealHypeAverages::publicHype)
                    .mapToDouble(c -> c.getScore().doubleValue()).toArray();
            Map<String, Object> m = emptySealHype();
            if (scores.length > 0) {
                double avg = Math.round(java.util.Arrays.stream(scores).average().orElse(0) * 10) / 10.0;
                m.put("avgScore", avg);
                m.put("level", q.config().level(avg).name());
            }
            m.put("bonded", ids.size());
            out.put(s.getId(), m);
        }
        return out;
    }

    /** O Hype que entra num agregado de terceiros: disponível, com score e público elegível (o de item privado é só do dono). */
    static boolean publicHype(HypeScoreCurrent c) {
        return c != null && c.getStatus() == HypeStatus.AVAILABLE && c.isPublicEligible() && c.getScore() != null;
    }

    /** Quantos looks vinculados aparecem no "top" do Hype das métricas do emissor. */
    static final int ISSUER_HYPE_TOP = 3;

    /**
     * P2-09 — Hype dos looks vinculados nas métricas do emissor, com a régua do "Hype do selo" ({@link #computeSealHype}):
     * média do HypeScore v2 atual dos looks com vínculo APROVADO e vigente deste emissor, só os públicos elegíveis com Hype
     * disponível ({@link #publicHype}); {@code bonded} conta todos os looks vinculados. Também o Δ médio na janela do
     * delta (só quem tem base de comparação; sem base, nulo e sem seta) e os {@value #ISSUER_HYPE_TOP} de maior Hype.
     * Sem nenhum público com Hype: {@code avgScore}/{@code level} nulos — a interface diz "Dados insuficientes", nunca 0.
     * Só lê o estado gravado pelo job (GET nunca recalcula) e nada aqui vira sinal do Hype.
     */
    Map<String, Object> bondedHype(UUID issuerId) {
        Instant now = Instant.now();
        Map<UUID, Scheme> looks = new LinkedHashMap<>();
        for (SealBond b : bonds.findByTargetOwnerIdAndStatusOrderByCreatedAtDesc(issuerId, SealBondStatus.APPROVED)) {
            if (b.getScheme() != null && b.getStatus() == SealBondStatus.APPROVED && (b.getExpiresAt() == null || b.getExpiresAt().isAfter(now))) {
                looks.putIfAbsent(b.getScheme().getId(), b.getScheme());
            }
        }
        HypeQueryService q = hypeQuery.get();
        Map<UUID, HypeScoreCurrent> rows = q == null || looks.isEmpty() ? Map.of() : q.currentOf(HypeEntityType.SCHEME, looks.keySet());
        List<HypeScoreCurrent> shown = looks.keySet().stream().map(rows::get).filter(SealHypeAverages::publicHype).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("bonded", looks.size());
        m.put("withHype", shown.size());
        Double avg = shown.isEmpty() ? null : Math.round(shown.stream().mapToDouble(c -> c.getScore().doubleValue()).average().orElse(0) * 10) / 10.0;
        m.put("avgScore", avg);
        m.put("level", avg == null ? null : q.config().level(avg).name());
        List<HypeScoreCurrent> withDelta = shown.stream().filter(c -> c.getDeltaPoints() != null).toList();
        Double delta = withDelta.isEmpty() ? null : Math.round(withDelta.stream().mapToDouble(c -> c.getDeltaPoints().doubleValue()).average().orElse(0) * 10) / 10.0;
        m.put("deltaPoints", delta);
        m.put("direction", delta == null ? null : Math.abs(delta) < q.config().stablePoints() ? "STABLE" : delta > 0 ? "UP" : "DOWN");
        m.put("deltaWindowDays", q == null ? null : q.config().deltaWindowDays());
        m.put("top", shown.stream().sorted(Comparator.comparing(HypeScoreCurrent::getScore).reversed()
                        .thenComparing(c -> c.getEntityId().toString())).limit(ISSUER_HYPE_TOP)
                .map(c -> {
                    Map<String, Object> t = new LinkedHashMap<>();
                    Scheme s = looks.get(c.getEntityId());
                    t.put("schemeId", c.getEntityId().toString());
                    t.put("title", s == null ? null : s.getTitle());
                    double score = Math.round(c.getScore().doubleValue() * 10) / 10.0;
                    t.put("score", score);
                    t.put("level", q.config().level(score).name());
                    return t;
                }).toList());
        return m;
    }

    static Map<String, Object> emptySealHype() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("avgScore", null);
        m.put("level", null);
        m.put("bonded", 0);
        return m;
    }
}
