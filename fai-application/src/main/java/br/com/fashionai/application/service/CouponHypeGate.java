package br.com.fashionai.application.service;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;

import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.seal.SealHypeLookups;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.SealBond;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;

/**
 * Circuito Aura (fase 1) — a faixa de Hype que um card apresenta para destravar um cupom. Só conta Hype
 * <b>público</b> ({@code public_eligible}) e <b>atualizado</b> (a mesma checagem dos selos de Hype,
 * {@link SealHypeLookups#freshHype}); card privado, só para seguidores ou com nota vencida vale como "sem faixa".
 * Só leitura: consulta {@code hype_scores} e nada mais.
 */
public final class CouponHypeGate {
    private final Supplier<HypeScoreConfig> config;
    private final LookUp rows;

    /** Leitura em lote do estado atual do Hype. */
    public interface LookUp {
        Map<UUID, HypeScoreCurrent> currentOf(HypeEntityType type, Collection<UUID> ids);
    }

    public CouponHypeGate(Supplier<HypeScoreConfig> config, LookUp rows) {
        this.config = config;
        this.rows = rows;
    }

    /** Pelo serviço de Hype (selos): sem o serviço disponível, nenhum card tem faixa. */
    public static CouponHypeGate of(Supplier<HypeQueryService> query) {
        return new CouponHypeGate(() -> query.get() == null ? null : query.get().config(),
                (type, ids) -> query.get() == null ? Map.of() : query.get().currentOf(type, ids));
    }

    /** Direto no repositório (FLAIR, que não depende do serviço de Hype). */
    public static CouponHypeGate of(HypeScoreCurrentRepository scores, HypeScoreConfig config) {
        return new CouponHypeGate(() -> config, (type, ids) -> scores
                .findByEntityTypeAndEntityIdInAndAlgorithmVersion(type, new HashSet<>(ids), config.algorithmVersion()).stream()
                .collect(Collectors.toMap(HypeScoreCurrent::getEntityId, Function.identity(), (a, b) -> a)));
    }

    /** Faixa que conta de uma linha de Hype; nula quando não é pública ou não está atualizada. */
    public HypeLevel counted(HypeScoreCurrent row) {
        HypeScoreConfig cfg = config.get();
        return cfg != null && row != null && row.isPublicEligible() && row.getLevel() != null && SealHypeLookups.freshHype(row, cfg) ? row.getLevel() : null;
    }

    /** A melhor faixa que conta entre os cards apresentados; nula quando nenhum conta. */
    public HypeLevel best(HypeEntityType type, Collection<UUID> ids) {
        Collection<UUID> wanted = ids == null ? List.of() : ids.stream().filter(Objects::nonNull).distinct().toList();
        if (wanted.isEmpty() || config.get() == null) {
            return null;
        }
        HypeLevel best = null;
        for (HypeScoreCurrent row : rows.currentOf(type, wanted).values()) {
            HypeLevel level = counted(row);
            if (level != null && (best == null || level.ordinal() > best.ordinal())) {
                best = level;
            }
        }
        return best;
    }

    /** O card que carrega o vínculo do selo: a peça do vínculo de peça ou o look do vínculo de look. */
    public HypeLevel ofBond(SealBond bond) {
        if (bond == null) {
            return null;
        }
        if (bond.getPiece() != null) {
            return best(HypeEntityType.PIECE, List.of(bond.getPiece().getId()));
        }
        return bond.getScheme() == null ? null : best(HypeEntityType.SCHEME, List.of(bond.getScheme().getId()));
    }
}
