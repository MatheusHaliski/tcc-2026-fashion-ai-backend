package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiCapability;
import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.ai.AiOutcome;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.DnaService.DnaCellForm;
import br.com.fashionai.application.service.DnaService.DnaComposeRequest;
import br.com.fashionai.application.service.DnaService.DnaProposal;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.model.enums.Season;
import br.com.fashionai.domain.repository.SchemeRepository;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Modo IA da etapa 1: contexto dos esquemas (com Hype v2 pessoal), chamada à IA, leitura das propostas
 * e fallback do motor local.
 */
final class DnaCompositions {
    private final AiEngine ai;
    private final SchemeRepository schemes;
    private final DnaSynthesis synthesis;
    private final DnaSchemeViews schemeViews;

    DnaCompositions(AiEngine ai, SchemeRepository schemes, DnaSynthesis synthesis, DnaSchemeViews schemeViews) {
        this.ai = ai;
        this.schemes = schemes;
        this.synthesis = synthesis;
        this.schemeViews = schemeViews;
    }

    /** Score v2 pessoal do dono (só para ordenar as próprias propostas e para o contexto da IA). */
    static Map<UUID, Double> ownerScores(Map<UUID, HypeScoreCurrent> rows) {
        Map<UUID, Double> out = new HashMap<>();
        rows.forEach((id, c) -> {
            if (c.getStatus() == HypeStatus.AVAILABLE && c.getScore() != null) {
                out.put(id, c.getScore().doubleValue());
            }
        });
        return out;
    }

    static final java.time.format.DateTimeFormatter ERA = java.time.format.DateTimeFormatter.ofPattern("MMM/yy", Locale.forLanguageTag("pt-BR"))
            .withZone(java.time.ZoneOffset.UTC);

    /**
     * Etapa 1 (modo IA): propõe até 3 DNAs a partir dos esquemas do usuário, interpretando tudo o que eles carregam —
     * materiais, cores, estampas, marcas, ocasiões, estilos, estação, datas, hype — mais o DNA sintetizado e as
     * orientações livres. Sem IA remota, o motor local monta as propostas.
     */
    Map<String, Object> compositions(CurrentUser user, DnaComposeRequest req) {
        DnaComposeRequest r = req == null ? new DnaComposeRequest(null, List.of(), List.of(), null, null) : req;
        StyleDna dna = synthesis.ensureDna(user);
        List<Scheme> own = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(user.id(), SchemeStatus.ARCHIVED).stream().limit(40).toList();
        if (own.size() < 2) {
            throw new ApiException(422, "ESQUEMAS_INSUFICIENTES", Msg.t("dna.crie_ao_menos_2_esquemas"),
                    Map.of("action", "/schemes/new"));
        }
        Map<UUID, List<SchemeItem>> itemsBy = schemeViews.groupItems(own);
        // contexto da IA com o HypeScore v2 PESSOAL do dono (os looks são dele); sem dados = null, nunca 0
        Map<UUID, HypeScoreCurrent> v2Rows = schemeViews.hypeV2Of(own.stream().map(Scheme::getId).toList());
        Map<UUID, Double> v2 = ownerScores(v2Rows);
        Map<String, Scheme> byRef = new LinkedHashMap<>();
        List<Map<String, Object>> catalog = new ArrayList<>();
        for (Scheme s : own) {
            String ref = "s" + (byRef.size() + 1);
            byRef.put(ref, s);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ref", ref);
            m.put("title", s.getTitle());
            m.put("date", s.getCreatedAt() == null ? null : s.getCreatedAt().toString().substring(0, 10));
            m.put("occasion", Json.csv(s.getOccasion()));
            m.put("style", Json.csv(s.getStyle()));
            m.put("season", s.getSeason() == null ? null : s.getSeason().name());
            m.put("hype", v2.containsKey(s.getId()) ? Math.round(v2.get(s.getId()) * 10) / 10.0 : null);
            m.put("hypeLevel", v2.containsKey(s.getId()) && v2Rows.get(s.getId()).getLevel() != null ? v2Rows.get(s.getId()).getLevel().name() : null);
            m.put("likes", s.getLikeCount());
            m.put("pieces", itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> {
                WardrobeItem w = si.getWardrobeItem();
                Map<String, Object> pm = new LinkedHashMap<>(DnaViews.pieceBrief(w));
                pm.remove("id");
                pm.remove("imageUrl");
                pm.put("material", w.getMaterial());
                pm.put("analysis", CompositionContext.pieceAnalysis(w)); // estampa, textura, caimento lidos da foto (RF4)
                return pm;
            }).toList());
            catalog.add(m);
        }
        String system = """
                Você monta Esquemas de DNA de Estilo do Fashion AI (RF13). Um DNA referencia de 2 a 6 esquemas de vestimenta do PRÓPRIO
                usuário (use só os refs fornecidos) e conta uma história com eles. narrativeType: TIMELINE, MOMENTOS_MARCANTES,
                PRIMEIRA_VEZ, CAPSULA_VERSATILIDADE, POR_OCASIAO, MOOD_BOARD, PALETA_DOMINANTE, HARMONIA_CROMATICA, MARCAS_FAVORITAS,
                HYPE_FOCUS, CARTELA_SAZONAL, LEGO ou null (só a anatomia base). cardLayout: AMPLIADO, GRADE, HORIZONTAL, LATERAL.
                Interprete TUDO o que os esquemas carregam: materiais, cores, estampas, marcas, ocasiões, estilos, estação, datas e hype,
                além do DNA sintetizado e das orientações livres (que podem citar cores, materiais, marcas, épocas ou momentos: respeite-as).
                MOMENTOS_MARCANTES exige exatamente um marco; CARTELA_SAZONAL exige seasonalTheme (SPRING, SUMMER, AUTUMN, WINTER).
                Proponha até 3 DNAs diferentes entre si. Responda SOMENTE com JSON:
                {"compositions":[{"title":string,"narrativeType":string|null,"cardLayout":string,"refs":["s1",...],
                "eraLabels":{"s1":"2024 · primeiro emprego"},"milestone":"s2"|null,"seasonalTheme":string|null,
                "occasion":[...],"style":[...],"rationale":"até 2 frases"}]}""";
        String prompt = Msg.t("dna.esquemas_dna_sintetizado_ocasiao_estilo", Json.write(catalog), Json.write(Map.of("archetype", String.valueOf(dna.getArchetype()), "palette", Json.csv(dna.getColorPalette()),
                "styles", Json.csv(dna.getStyleKeywords()), "silhouette", String.valueOf(dna.getSilhouette()))), r.occasion(), r.style(), r.narrativeType(), r.season(), (r.prompt() == null ? "" : InputSanitizer.clean(r.prompt(), 500)));
        List<String> inputs = List.of(Msg.t("dna.esquemas_de_vestimenta_seus_pecas", (own.size())),
                Msg.t("dna.dna_sintetizado_arquetipo_paleta_estilos"), Msg.t("dna.ocasiao_estilo_narrativa_estacao_pedidos"), Msg.t("common.orientacoes_livres"));
        AiOutcome<List<DnaProposal>> outcome = ai.text(new AiEngine.TextCall<>(user.id(), AiCapability.DNA_SYNTHESIZER, system, prompt, List.of(), 1400,
                inputs, text -> parseProposals(text, byRef), () -> DnaLocalProposals.localProposals(own, itemsBy, r, v2), null));
        List<DnaProposal> list = outcome.value() == null || outcome.value().isEmpty() ? DnaLocalProposals.localProposals(own, itemsBy, r, v2) : outcome.value();
        Map<UUID, Scheme> byId = own.stream().collect(Collectors.toMap(Scheme::getId, s -> s));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("compositions", list.stream().map(pr -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("title", pr.title());
            m.put("narrativeType", pr.narrativeType() == null ? null : pr.narrativeType().name());
            m.put("cardLayout", pr.cardLayout());
            m.put("cells", pr.cells().stream().map(c -> {
                Map<String, Object> cm = new LinkedHashMap<>();
                cm.put("schemeId", c.schemeId());
                cm.put("title", byId.containsKey(c.schemeId()) ? byId.get(c.schemeId()).getTitle() : null);
                cm.put("eraLabel", c.eraLabel());
                cm.put("milestone", Boolean.TRUE.equals(c.milestone()));
                return cm;
            }).toList());
            m.put("occasion", pr.occasion());
            m.put("style", pr.style());
            m.put("seasonalTheme", pr.seasonalTheme() == null ? null : pr.seasonalTheme().name());
            m.put("rationale", pr.rationale());
            return m;
        }).toList());
        out.put("message", outcome.userMessage());
        out.put("fallbackUsed", outcome.fallbackUsed());
        out.put("provider", outcome.provider());
        out.put("explanation", outcome.explanation());
        return out;
    }

    List<DnaProposal> parseProposals(String text, Map<String, Scheme> byRef) {
        Map<String, Object> m = WardrobeService.extractJson(text);
        if (!(m.get("compositions") instanceof List<?> list)) {
            return null;
        }
        List<DnaProposal> out = new ArrayList<>();
        for (Object o : list) {
            if (!(o instanceof Map<?, ?> c) || !(c.get("refs") instanceof List<?> refs)) {
                continue;
            }
            List<String> chosen = refs.stream().map(String::valueOf).filter(byRef::containsKey).distinct().limit(6).toList();
            if (chosen.size() < 2) {
                continue;
            }
            NarrativeType nt = enumOr(NarrativeType.class, c.get("narrativeType"), null);
            String layout = DnaService.LAYOUTS.contains(String.valueOf(c.get("cardLayout"))) ? String.valueOf(c.get("cardLayout")) : "AMPLIADO";
            Map<?, ?> eras = c.get("eraLabels") instanceof Map<?, ?> em ? em : Map.of();
            String milestone = c.get("milestone") == null ? null : String.valueOf(c.get("milestone"));
            if (nt == NarrativeType.MOMENTOS_MARCANTES && (milestone == null || !chosen.contains(milestone))) {
                milestone = chosen.get(0);
            }
            final String mk = milestone;
            List<DnaCellForm> cells = chosen.stream().map(ref -> new DnaCellForm(byRef.get(ref).getId(),
                    eras.get(ref) == null ? era(byRef.get(ref)) : InputSanitizer.clean(String.valueOf(eras.get(ref)), 60), ref.equals(mk))).toList();
            Season season = enumOr(Season.class, c.get("seasonalTheme"), nt == NarrativeType.CARTELA_SAZONAL ? Season.AUTUMN : null);
            out.add(new DnaProposal(c.get("title") == null ? Msg.t("dna.meu_dna") : InputSanitizer.clean(String.valueOf(c.get("title")), 120), nt, layout, cells,
                    strs(c.get("occasion"), Taxonomy.OCCASIONS), strs(c.get("style"), Taxonomy.STYLES),
                    season, c.get("rationale") == null ? null : InputSanitizer.clean(String.valueOf(c.get("rationale")), 300)));
            if (out.size() == 3) {
                break;
            }
        }
        return out.isEmpty() ? null : out;
    }

    static <E extends Enum<E>> E enumOr(Class<E> type, Object raw, E fallback) {
        if (raw == null) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, String.valueOf(raw).trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return fallback;
        }
    }

    static List<String> strs(Object raw, Collection<String> allowed) {
        return raw instanceof List<?> l ? l.stream().map(String::valueOf).filter(allowed::contains).distinct().limit(3).toList() : List.of();
    }

    static String era(Scheme s) {
        return s.getCreatedAt() == null ? null : ERA.format(s.getCreatedAt()).replace(".", "");
    }
}
