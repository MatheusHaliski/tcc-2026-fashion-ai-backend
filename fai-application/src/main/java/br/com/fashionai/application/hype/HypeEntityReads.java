package br.com.fashionai.application.hype;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeEntityType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import static br.com.fashionai.application.hype.HypeQueryService.MAX_BATCH;
import static br.com.fashionai.application.hype.HypeQueryService.profileOf;

/** HypeScore v2 — cards em lote, análise completa (com a compatibilidade pessoal separada do Hype) e histórico de uma entidade. */
final class HypeEntityReads {
    private final HypeReadCore core;

    HypeEntityReads(HypeReadCore core) {
        this.core = core;
    }

    // ================================================================== leitura em lote (cards)
    Map<String, Object> summaries(CurrentUser viewer, HypeEntityType type, List<UUID> ids) {
        List<UUID> wanted = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().limit(MAX_BATCH).toList();
        Map<String, Object> items = new LinkedHashMap<>();
        if (!wanted.isEmpty()) {
            Set<UUID> ok = core.visible(viewer, type, wanted);
            Map<UUID, HypeScoreCurrent> rows = core.current.findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, ok, core.config.algorithmVersion()).stream()
                    .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a));
            Map<UUID, Map<String,Object>> drops = core.fashionDrops == null ? Map.of() : core.fashionDrops.classifications(type, ok);
            Instant now = Instant.now();
            for (UUID id : wanted) {
                if (ok.contains(id)) {
                    Map<String,Object> card = core.summary(rows.get(id), now);
                    if (drops.containsKey(id)) card.put("fashionCard", drops.get(id));
                    items.put(id.toString(), card);
                }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type.name());
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("deltaWindowDays", core.config.deltaWindowDays());
        out.put("items", items);
        return out;
    }

    // ================================================================== detalhe (análise completa)
    Map<String, Object> detail(CurrentUser viewer, HypeEntityType type, UUID id) {
        StyleCompatibility.Profile item;
        List<SchemeItem> lookItems = List.of();
        long inLooks = 0;
        if (type == HypeEntityType.PIECE) {
            WardrobeItem w = core.pieces.findById(id).filter(x -> core.canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("common.peca")));
            item = profileOf(w);
            inLooks = core.schemeItems.countByWardrobeItemId(id);
        } else {
            Scheme s = core.schemes.findById(id).filter(x -> core.canView(viewer, x)).orElseThrow(() -> ApiException.notFound(Msg.t("entity.esquema")));
            lookItems = core.schemeItems.findBySchemeIdOrderBySortOrder(id);
            item = profileOf(s, lookItems);
        }
        Optional<HypeScoreCurrent> row = core.current.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, core.config.algorithmVersion());
        Map<String, Object> out = new LinkedHashMap<>(core.summary(row.orElse(null), Instant.now()));
        if (core.fashionDrops != null) {
            Map<String,Object> drop = core.fashionDrops.classifications(type, List.of(id)).get(id);
            if (drop != null) out.put("fashionCard", drop);
        }
        out.put("entityType", type.name());
        out.put("entityId", id.toString());
        out.put("reasons", row.map(r -> Json.list(r.getReasonsJson())).orElse(List.of()));
        out.put("signals", row.map(r -> Json.map(r.getSignalsJson())).orElse(Map.of()));
        out.put("publicEligible", row.map(HypeScoreCurrent::isPublicEligible).orElse(false));
        out.put("weights", core.config.describe().get("weights") instanceof Map<?, ?> w ? w.get(type.name()) : null);
        // RF53 — selos de Hype conquistados e o que falta para cada um (drawer "Selos de Hype")
        out.put("sealProgress", HypeSeals.progress(row.orElse(null), core.config.levelThresholds()));
        // compatibilidade PESSOAL — separada do Hype (nunca entra no score)
        out.put("compatibility", viewer == null ? null : core.dnas.findByUserId(viewer.id()).map(d -> StyleCompatibility.score(profileOf(d), item)).orElse(null));
        if (type == HypeEntityType.PIECE) {
            out.put("inLooks", inLooks);   // em quantos looks a peça aparece (sinal de uso "peça em look")
        } else {
            out.put("pieces", core.lookPieces(viewer, lookItems));   // o Hype do look ao lado do Hype de cada peça dele
        }
        return out;
    }

    // ================================================================== histórico
    Map<String, Object> history(CurrentUser viewer, HypeEntityType type, UUID id, int days) {
        boolean ok = type == HypeEntityType.PIECE ? core.pieces.findById(id).filter(w -> core.canView(viewer, w)).isPresent()
                : core.schemes.findById(id).filter(s -> core.canView(viewer, s)).isPresent();
        if (!ok) {
            throw ApiException.notFound(type == HypeEntityType.PIECE ? Msg.t("common.peca") : Msg.t("entity.esquema"));
        }
        int span = Math.max(7, Math.min(core.config.historyMaxDays(), days));
        LocalDate since = LocalDate.now(HypeSignalRecorder.ZONE).minusDays(span - 1L);
        List<Map<String, Object>> points = core.snapshots.findByEntityTypeAndEntityIdAndAlgorithmVersionAndSnapshotDateGreaterThanEqualOrderBySnapshotDateAsc(
                type, id, core.config.algorithmVersion(), since).stream().map(HypeCards::point).toList();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("entityType", type.name());
        out.put("entityId", id.toString());
        out.put("algorithmVersion", core.config.algorithmVersion());
        out.put("days", span);
        out.put("points", points);
        return out;
    }
}
