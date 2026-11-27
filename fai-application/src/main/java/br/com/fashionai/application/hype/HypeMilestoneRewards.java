package br.com.fashionai.application.hype;

import java.util.EnumMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.domain.model.HypeMilestone;

/**
 * Circuito Aura (fase 1, elo 3) — o marco de Hype que vale algo: a primeira vez que um card chega a Em alta,
 * Tendência ou Viral rende FAI Points ao dono, uma única vez por card e marco. O dedupe de {@code hype_milestones}
 * garante a "primeira vez" e o extrato usa ainda uma chave idempotente por card e marco ({@link #ref}).
 *
 * <p>Os valores vêm da configuração ({@code fai.hype.milestone-points.*}). Card privado também rende (Hype pessoal: os
 * pontos são do dono). Nada aqui publica sinal de Hype nem muda a nota; uma falha no crédito nunca derruba o aviso.</p>
 */
@Component
public class HypeMilestoneRewards {
    /** Regra do extrato (fai_points_rules, criada pela V126 com valor 0: o valor vem daqui). */
    public static final String ACTION = "HYPE_MILESTONE";
    private static final Logger log = LoggerFactory.getLogger(HypeMilestoneRewards.class);

    private final FaiPointsService points;
    private final Map<HypeMilestone.Kind, Integer> table = new EnumMap<>(HypeMilestone.Kind.class);

    @Autowired
    public HypeMilestoneRewards(FaiPointsService points, @Value("${fai.hype.milestone-points.hot:20}") int hot,
                                @Value("${fai.hype.milestone-points.trending:50}") int trending,
                                @Value("${fai.hype.milestone-points.viral:120}") int viral) {
        this.points = points;
        table.put(HypeMilestone.Kind.HOT, Math.max(0, hot));
        table.put(HypeMilestone.Kind.TRENDING, Math.max(0, trending));
        table.put(HypeMilestone.Kind.VIRAL, Math.max(0, viral));
    }

    /** Pontos do marco; EMERGING (momento, não faixa) não rende. */
    public int pointsFor(HypeMilestone.Kind kind) {
        return kind == null ? 0 : table.getOrDefault(kind, 0);
    }

    /** Referência única do crédito no extrato: card e marco. */
    static String ref(HypeMilestone m) {
        return m.getEntityType().name() + ":" + m.getEntityId() + ":" + m.getMilestone().name();
    }

    /** Credita o dono (uma vez por card e marco, em transação própria). Devolve os pontos lançados agora. */
    public int credit(HypeMilestone m) {
        int value = m == null ? 0 : pointsFor(m.getMilestone());
        if (value <= 0 || m.getOwnerId() == null || m.getEntityId() == null || m.getEntityType() == null) {
            return 0;
        }
        try {
            return points.awardIsolated(m.getOwnerId(), ACTION, "HYPE_MILESTONE", ref(m), value).points();
        } catch (RuntimeException e) {
            log.warn("Crédito de FAI Points do marco de Hype não lançado ({}): {}", ref(m), e.getClass().getSimpleName());
            return 0;
        }
    }
}
