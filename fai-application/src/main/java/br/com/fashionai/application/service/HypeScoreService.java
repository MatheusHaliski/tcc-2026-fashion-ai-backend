package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.ai.local.LocalAdvisors;
import br.com.fashionai.application.ai.local.Similarity;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.HypeDimensions;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.HypeScoreCurrentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Painel do Look do Dia e ponte de leitura do HypeScore v2 (docs/hype/HYPESCORE_ARCHITECTURE.md).
 * <p>
 * P3-16 (limpeza final do v1, docs/hype/HYPE_AUDITORIA_ABAS.md §2): o cálculo v1 do RF6 ({@code 0,65·E_norm +
 * 0,35·T_norm}, percentis de 90 dias, 7 faixas de juízo, Top X% semanal, HypeGroups com {@code hypeScoreGlobal}) saiu.
 * Nada mais grava {@code wardrobe_items.hype_score(_global)}, {@code schemes.hype_score(_global)},
 * {@code hype_score_metrics}, {@code hype_groups} nem os snapshots {@code HYPE_CAL_*}; as colunas e tabelas ficam no
 * banco só como histórico. O painel mostra o v2 do look (estado gravado pelo job; o GET nunca recalcula) por trás das
 * 6 versões visuais, e a dica parte das dimensões v2.
 */
@Service
public class HypeScoreService {
    /** Faixa mínima do v2 que libera a capa da FAI Magazine (descritiva: relevância atual, não "arrasando"). */
    public static final HypeLevel MAGAZINE_MIN_LEVEL = HypeLevel.TRENDING;

    private final DailyLookRepository dailyLooks;
    private final AiEngine ai;
    /** HypeScore v2 (estado gravado pelo job; o painel só LÊ — GET nunca recalcula o v2). */
    private final HypeScoreCurrentRepository hypeV2;
    private final HypeScoreConfig hypeV2Config;

    public HypeScoreService(DailyLookRepository dailyLooks, AiEngine ai, HypeScoreCurrentRepository hypeV2, HypeScoreConfig hypeV2Config) {
        this.dailyLooks = dailyLooks;
        this.ai = ai;
        this.hypeV2 = hypeV2;
        this.hypeV2Config = hypeV2Config;
    }

    // ================================================================== painel do Look do Dia (RF6 §6, P2-13)
    /**
     * Painel do Look do Dia: o número de todas as versões visuais vem do v2 do look; "sem dados" chega como status,
     * nunca como 0. A dica (local, ou da IA com {@code withAi}) aponta a dimensão v2 mais fraca e nunca promete Hype.
     */
    @Transactional
    public Map<String, Object> panel(DailyLook dl, boolean withAi) {
        Scheme s = dl.getScheme();
        Map<String, Object> v2 = v2Summary(currentV2(HypeEntityType.SCHEME, s.getId()), hypeV2Config, Instant.now());
        Map<String, Object> dims = v2.get("dimensions") instanceof Map<?, ?> m ? castDims(m) : Map.of();
        String tip = localTip(s, dims);
        AiOutcome<String> outcome = null;
        if (withAi) {
            String localTip = tip;
            outcome = ai.text(new AiEngine.TextCall<>(dl.getUser().getId(), AiCapability.STYLE_ADVISOR,
                    "Você é o Style Advisor do Fashion AI. Dê UMA dica acionável (até 2 frases, em " + Msg.languageName() + ") sobre como "
                            + "mostrar melhor este look para quem o vê (foto, descrição, ocasião, publicação), citando a dimensão mais fraca do "
                            + "HypeScore v2 como contexto. Hype é relevância no FashionAI, não qualidade nem meta: nunca sugira trocar peças para "
                            + "seguir o que está em alta, nunca diga que o look é bom ou ruim e nunca cite marcas reais que não estejam no look. "
                            + "Responda só o texto.",
                    Msg.t("hypeScore.look_dimensoes_v2", s.getTitle(), Json.csv(s.getStyle()), Json.csv(s.getOccasion()), Json.write(dims)),
                    List.of(), 200, List.of(Msg.t("hypeScore.contadores_sociais_do_look"), Msg.t("hypeScore.dimensoes_do_hypescore_v2")),
                    text -> text == null || text.isBlank() ? null : InputSanitizer.clean(text, 300), () -> localTip, null));
            if (outcome.value() != null) {
                tip = outcome.value();
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("v2", v2);
        out.put("magazineCover", magazineCover(v2));
        out.put("tip", tip);
        out.put("aiExplanation", outcome == null ? null : outcome.explanation());
        out.put("previousDailyLook", dailyLooks.findFirstByUserIdAndLookDateBeforeOrderByLookDateDesc(dl.getUser().getId(), dl.getLookDate())
                .map(p -> Map.of("date", p.getLookDate(), "schemeId", p.getScheme().getId())).orElse(null));
        return out;
    }

    /** Dica local: contadores do look + engajamento e tendência v2 (dimensão sem base = neutra 50, nunca 0). */
    static String localTip(Scheme s, Map<String, Object> dims) {
        return LocalAdvisors.styleTip(s.getLikeCount(), s.getCommentCount(), s.getShareCount(), s.getRemixCount(),
                dim(dims, "ENGAGEMENT"), dim(dims, "TREND"));
    }

    private static double dim(Map<String, Object> dims, String key) {
        return dims.get(key) instanceof Number n ? n.doubleValue() : 50.0;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castDims(Map<?, ?> m) {
        return (Map<String, Object>) m;
    }

    // ================================================================== ponte para o HypeScore v2 (leitura)
    /** Estado v2 atual de uma entidade (sem linha = ainda não calculado). Só lê o que o job gravou. */
    HypeScoreCurrent currentV2(HypeEntityType type, UUID id) {
        if (hypeV2 == null || hypeV2Config == null || id == null) {
            return null;
        }
        return hypeV2.findByEntityTypeAndEntityIdAndAlgorithmVersion(type, id, hypeV2Config.algorithmVersion()).orElse(null);
    }

    /**
     * Resumo v2 no MESMO formato de /api/hype/summaries (status, score, level, direction, deltas, momentum, dimensions,
     * calculatedAt, stale, algorithmVersion). Sem linha = NOT_CALCULATED; INSUFFICIENT_DATA = score e faixa nulos — "sem
     * dados" nunca vira 0. Quem chama decide a privacidade (o dono vê o Hype pessoal; terceiros, só o público elegível).
     */
    public static Map<String, Object> v2Summary(HypeScoreCurrent c, HypeScoreConfig cfg, Instant now) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (c == null) {
            m.put("status", "NOT_CALCULATED");
            m.put("score", null);
            m.put("level", null);
            return m;
        }
        boolean available = c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null;
        m.put("status", available ? HypeStatus.AVAILABLE.name() : HypeStatus.INSUFFICIENT_DATA.name());
        m.put("score", available ? v2Number(c.getScore()) : null);
        HypeLevel level = !available ? null : c.getLevel() != null ? c.getLevel() : cfg == null ? null : cfg.level(c.getScore().doubleValue());
        m.put("level", level == null ? null : level.name());
        m.put("direction", c.getDirection());
        m.put("deltaPoints", v2Number(c.getDeltaPoints()));
        m.put("deltaPercent", v2Number(c.getDeltaPercent()));
        m.put("momentum", c.getMomentum() == null ? null : c.getMomentum().name());
        m.put("dimensions", v2Dimensions(c.getDimensions()));
        m.put("calculatedAt", c.getCalculatedAt() == null ? null : c.getCalculatedAt().toString());
        m.put("stale", cfg != null && c.getCalculatedAt() != null && now != null
                && c.getCalculatedAt().isBefore(now.minus(cfg.staleAfterHours(), ChronoUnit.HOURS)));
        m.put("algorithmVersion", c.getAlgorithmVersion());
        return m;
    }

    /** Capa da FAI Magazine (DET-K07) pela faixa v2: liberada a partir de Tendência; sem Hype disponível, bloqueada. */
    public static Map<String, Object> magazineCover(Map<String, Object> v2) {
        Object level = v2 == null ? null : v2.get("level");
        boolean unlocked = false;
        if (level != null) {
            try {
                unlocked = HypeLevel.valueOf(String.valueOf(level)).ordinal() >= MAGAZINE_MIN_LEVEL.ordinal();
            } catch (IllegalArgumentException ignored) {
                // faixa desconhecida (versão nova do algoritmo): não libera
            }
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unlocked", unlocked);
        m.put("minLevel", MAGAZINE_MIN_LEVEL.name());
        return m;
    }

    static Double v2Number(BigDecimal v) {
        return v == null ? null : Math.round(v.doubleValue() * 10) / 10.0;
    }

    static Map<String, Object> v2Dimensions(HypeDimensions d) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (d == null) {
            return m;
        }
        putDim(m, "POPULARITY", d.getPopularity());
        putDim(m, "ENGAGEMENT", d.getEngagement());
        putDim(m, "TREND", d.getTrend());
        putDim(m, "TREND_VELOCITY", d.getTrendVelocity());
        putDim(m, "ORIGINALITY", d.getOriginality());
        putDim(m, "RARITY", d.getRarity());
        putDim(m, "LONGEVITY", d.getLongevity());
        putDim(m, "NOVELTY", d.getNovelty());
        putDim(m, "INFLUENCE", d.getInfluence());
        return m;
    }

    private static void putDim(Map<String, Object> m, String k, BigDecimal v) {
        if (v != null) {
            m.put(k, v2Number(v));
        }
    }

    // ================================================================== agrupamento por similaridade
    /**
     * Agrupamento guloso por similaridade (estilo, ocasião, cor, marca e tipo): similaridade ponderada ≥ 0,70 com o
     * representante; grupos com ≥ 3 membros. Usado pelas sugestões de agrupamento do Lookbook (P3-04). Não é Hype.
     */
    static List<List<Integer>> cluster(List<Similarity.Signature> sigs) {
        List<List<Integer>> out = new ArrayList<>();
        boolean[] used = new boolean[sigs.size()];
        for (int i = 0; i < sigs.size(); i++) {
            if (used[i]) {
                continue;
            }
            List<Integer> members = new ArrayList<>(List.of(i));
            for (int j = i + 1; j < sigs.size(); j++) {
                if (!used[j] && Similarity.weighted(sigs.get(i), sigs.get(j)) >= Similarity.GROUP_THRESHOLD) {
                    members.add(j);
                }
            }
            if (members.size() >= 3) {
                members.forEach(k -> used[k] = true);
                out.add(members);
            }
        }
        return out;
    }
}
