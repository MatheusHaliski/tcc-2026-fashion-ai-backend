package br.com.fashionai.application.service;

import br.com.fashionai.application.common.InputSanitizer;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.service.DnaService.DnaCellForm;
import br.com.fashionai.application.service.DnaService.DnaComposeRequest;
import br.com.fashionai.application.service.DnaService.DnaProposal;
import br.com.fashionai.application.taxonomy.Taxonomy;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.NarrativeType;
import br.com.fashionai.domain.model.enums.Season;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Motor local das propostas de DNA: narrativa pelas orientações e seleção dos esquemas que a contam.
 */
final class DnaLocalProposals {
    private DnaLocalProposals() {
    }

    /** Motor local sem Hype (todas as células "sem dados"): a narrativa HYPE_FOCUS cai na ordem de criação. */
    static List<DnaProposal> localProposals(List<Scheme> own, Map<UUID, List<SchemeItem>> itemsBy, DnaComposeRequest r) {
        return localProposals(own, itemsBy, r, Map.of());
    }

    /**
     * Motor local: escolhe a narrativa pelas orientações/pedido e seleciona os esquemas que melhor a contam.
     * {@code hypeV2} = score v2 pessoal por look (ausente = sem dados), usado só pela narrativa HYPE_FOCUS.
     */
    static List<DnaProposal> localProposals(List<Scheme> own, Map<UUID, List<SchemeItem>> itemsBy, DnaComposeRequest r, Map<UUID, Double> hypeV2) {
        String q = (r.prompt() == null ? "" : r.prompt()).toLowerCase(Locale.ROOT);
        // filtro pelas orientações: cores, materiais, marcas, estampas, ocasiões e estilos citados
        List<Scheme> pool = own.stream().filter(s -> matches(s, itemsBy.getOrDefault(s.getId(), List.of()), q, r)).toList();
        if (pool.size() < 2) {
            pool = own;
        }
        List<NarrativeType> order = new ArrayList<>();
        if (r.narrativeType() != null) {
            order.add(r.narrativeType());
        }
        Map<String, NarrativeType> keywords = new LinkedHashMap<>();
        keywords.put("tempo|evolu|histór|histor|trajet|timeline|journey|over time|tiempo|trayect", NarrativeType.TIMELINE);
        keywords.put("marco|formatura|momento|conquista|milestone|graduation|achievement|hito|graduación|graduacion|logro", NarrativeType.MOMENTOS_MARCANTES);
        keywords.put("primeir|estreia|first time|debut|primera vez|estreno", NarrativeType.PRIMEIRA_VEZ);
        keywords.put("cápsula|capsula|versát|versat|poucas peças|capsule|versatil|few pieces|pocas piezas", NarrativeType.CAPSULA_VERSATILIDADE);
        keywords.put("ocasi|trabalho|festa|papel|occasion|work|party|role|trabajo|fiesta", NarrativeType.POR_OCASIAO);
        keywords.put("mood|inspira|afinidade", NarrativeType.MOOD_BOARD);
        keywords.put("paleta|cores|tons|cor |palette|colors|colours|tones|colores|tonos", NarrativeType.PALETA_DOMINANTE);
        keywords.put("harmonia|contraste|complement|harmony|contrast|armonía|armonia", NarrativeType.HARMONIA_CROMATICA);
        keywords.put("marca|brand", NarrativeType.MARCAS_FAVORITAS);
        keywords.put("hype|alta|tendên|tenden|bombando|trend|tendencia", NarrativeType.HYPE_FOCUS);
        keywords.put("inverno|verão|verao|outono|primavera|estaç|estac|sazon|winter|summer|autumn|fall|spring|season|invierno|verano|otoño|otono|estación|estacion", NarrativeType.CARTELA_SAZONAL);
        keywords.put("lego|bloco|block|bloque", NarrativeType.LEGO);
        keywords.forEach((re, nt) -> {
            if (java.util.regex.Pattern.compile(re).matcher(q).find() && !order.contains(nt)) {
                order.add(nt);
            }
        });
        for (NarrativeType nt : List.of(NarrativeType.TIMELINE, NarrativeType.POR_OCASIAO, NarrativeType.CAPSULA_VERSATILIDADE, NarrativeType.HYPE_FOCUS,
                NarrativeType.PALETA_DOMINANTE, NarrativeType.MOMENTOS_MARCANTES)) {
            if (!order.contains(nt)) {
                order.add(nt);
            }
        }
        Season season = r.season() != null ? r.season() : q.matches(".*(inverno|winter|invierno).*") ? Season.WINTER : q.matches(".*(verão|verao|summer|verano).*") ? Season.SUMMER
                : q.matches(".*(primavera|spring).*") ? Season.SPRING : Season.AUTUMN;
        List<DnaProposal> out = new ArrayList<>();
        Set<String> used = new HashSet<>();
        for (NarrativeType nt : order) {
            List<Scheme> pick = pickFor(nt, pool, itemsBy, season, hypeV2);
            if (pick.size() < 2 || !used.add(pick.stream().map(s -> s.getId().toString()).sorted().collect(Collectors.joining(",")) + nt)) {
                continue;
            }
            Scheme milestone = nt == NarrativeType.MOMENTOS_MARCANTES ? pick.get(0) : null;
            List<DnaCellForm> cells = pick.stream().map(s -> new DnaCellForm(s.getId(), DnaCompositions.era(s), s == milestone)).toList();
            List<String> occ = pick.stream().flatMap(s -> Json.csv(s.getOccasion()).stream()).distinct().limit(3).toList();
            List<String> sty = pick.stream().flatMap(s -> Json.csv(s.getStyle()).stream()).distinct().limit(3).toList();
            String layout = switch (nt) {
                case MARCAS_FAVORITAS, HYPE_FOCUS -> "HORIZONTAL";
                case PALETA_DOMINANTE, CARTELA_SAZONAL, CAPSULA_VERSATILIDADE -> "GRADE";
                case MOMENTOS_MARCANTES -> "LATERAL";
                default -> "AMPLIADO";
            };
            out.add(new DnaProposal(TITLES.getOrDefault(nt, Msg.t("dna.meu_dna")), nt, layout, cells, occ, sty, nt == NarrativeType.CARTELA_SAZONAL ? season : null,
                    RATIONALE.getOrDefault(nt, "") + (q.isBlank() ? "" : Msg.t("dna.considerou_as_suas_orientacoes", InputSanitizer.clean(r.prompt(), 80)))));
            if (out.size() == 3) {
                break;
            }
        }
        return out;
    }

    static final Map<NarrativeType, String> TITLES = new EnumMap<>(Map.of(NarrativeType.TIMELINE, Msg.k("dna.minha_linha_do_tempo"),
            NarrativeType.MOMENTOS_MARCANTES, Msg.k("dna.momentos_que_me_vestiram"), NarrativeType.PRIMEIRA_VEZ, Msg.k("dna.minhas_estreias"),
            NarrativeType.CAPSULA_VERSATILIDADE, Msg.k("dna.capsula_que_rende"), NarrativeType.POR_OCASIAO, Msg.k("dna.eu_em_cada_ocasiao"),
            NarrativeType.MOOD_BOARD, Msg.k("dna.mood_board_do_meu_estilo"), NarrativeType.PALETA_DOMINANTE, Msg.k("dna.minha_paleta"),
            NarrativeType.HARMONIA_CROMATICA, Msg.k("dna.cores_que_conversam"), NarrativeType.MARCAS_FAVORITAS, Msg.k("dna.marcas_que_me_vestem"),
            NarrativeType.HYPE_FOCUS, Msg.k("hypeDna.title")));
    static final Map<NarrativeType, String> RATIONALE = new EnumMap<>(Map.of(NarrativeType.TIMELINE, Msg.k("dna.looks_em_ordem_cronologica_espacados"),
            NarrativeType.MOMENTOS_MARCANTES, Msg.k("dna.o_look_mais_curtido_vira"),
            NarrativeType.PRIMEIRA_VEZ, Msg.k("dna.um_look_por_estreia_primeira"),
            NarrativeType.CAPSULA_VERSATILIDADE, Msg.k("dna.looks_que_reaproveitam_as_mesmas"),
            NarrativeType.POR_OCASIAO, Msg.k("dna.um_grupo_por_ocasiao_predominante"),
            NarrativeType.MOOD_BOARD, Msg.k("dna.looks_agrupados_por_afinidade_de"),
            NarrativeType.PALETA_DOMINANTE, Msg.k("dna.looks_cuja_cor_dominante_reforca"),
            NarrativeType.HARMONIA_CROMATICA, Msg.k("dna.looks_cujas_cores_formam_uma"),
            NarrativeType.MARCAS_FAVORITAS, Msg.k("dna.looks_que_mostram_as_marcas"),
            NarrativeType.HYPE_FOCUS, Msg.k("hypeDna.rationale")));

    static boolean matches(Scheme s, List<SchemeItem> items, String q, DnaComposeRequest r) {
        if (r.occasion() != null && !r.occasion().isEmpty() && Json.csv(s.getOccasion()).stream().noneMatch(r.occasion()::contains)) {
            return false;
        }
        if (r.style() != null && !r.style().isEmpty() && Json.csv(s.getStyle()).stream().noneMatch(r.style()::contains)) {
            return false;
        }
        if (q.isBlank()) {
            return true;
        }
        List<String> terms = new ArrayList<>();
        for (SchemeItem si : items) {
            WardrobeItem w = si.getWardrobeItem();
            terms.add(String.valueOf(w.getColor()));
            terms.add(String.valueOf(w.getMaterial()));
            terms.add(String.valueOf(w.getBrand() != null ? w.getBrand().getName() : w.getBrandName()));
            terms.add(String.valueOf(w.getName()));
        }
        terms.addAll(Json.csv(s.getOccasion()));
        terms.addAll(Json.csv(s.getStyle()));
        terms.add(String.valueOf(s.getTitle()));
        // só filtra quando a orientação cita algo que existe em algum look; caso contrário a orientação guia só a narrativa
        return terms.stream().map(t -> t.toLowerCase(Locale.ROOT)).filter(t -> t.length() > 2 && !"null".equals(t)).anyMatch(q::contains);
    }

    static List<Scheme> pickFor(NarrativeType nt, List<Scheme> pool, Map<UUID, List<SchemeItem>> itemsBy, Season season) {
        return pickFor(nt, pool, itemsBy, season, Map.of());
    }

    static List<Scheme> pickFor(NarrativeType nt, List<Scheme> pool, Map<UUID, List<SchemeItem>> itemsBy, Season season, Map<UUID, Double> hypeV2) {
        List<Scheme> chrono = pool.stream().sorted(Comparator.comparing(Scheme::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))).toList();
        return switch (nt) {
            case TIMELINE, PRIMEIRA_VEZ, LEGO, MOOD_BOARD, MARCAS_FAVORITAS -> spread(chrono, 5);
            case MOMENTOS_MARCANTES -> pool.stream().sorted(Comparator.comparingLong(Scheme::getLikeCount).reversed()).limit(4).toList();
            // HYPE_FOCUS: maior HypeScore v2 pessoal primeiro; sem Hype (dados insuficientes/não calculado) por último, nunca como 0
            case HYPE_FOCUS -> pool.stream().sorted(Comparator.comparing((Scheme s) -> hypeV2.get(s.getId()), Comparator.nullsLast(Comparator.reverseOrder())))
                    .limit(4).toList();
            case POR_OCASIAO -> {
                Map<String, List<Scheme>> byOcc = new LinkedHashMap<>();
                pool.forEach(s -> byOcc.computeIfAbsent(Json.csv(s.getOccasion()).stream().findFirst().orElse("livre"), k -> new ArrayList<>()).add(s));
                List<Scheme> out = new ArrayList<>();
                byOcc.values().stream().limit(3).forEach(l -> out.addAll(l.stream().limit(2).toList()));
                yield out.size() >= 2 && byOcc.size() >= 2 ? out : List.of();
            }
            case CAPSULA_VERSATILIDADE -> {
                Map<UUID, Set<UUID>> piecesOf = new HashMap<>();
                pool.forEach(s -> piecesOf.put(s.getId(), itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet())));
                List<Scheme> out = new ArrayList<>();
                Set<UUID> base = new HashSet<>();
                List<Scheme> rest = new ArrayList<>(pool);
                while (out.size() < 5 && !rest.isEmpty()) {
                    Scheme best = rest.stream().max(Comparator.comparingLong((Scheme s) -> piecesOf.get(s.getId()).stream()
                            .filter(id -> base.isEmpty() || base.contains(id)).count())).orElseThrow();
                    if (!base.isEmpty() && piecesOf.get(best.getId()).stream().noneMatch(base::contains)) {
                        break;
                    }
                    out.add(best);
                    base.addAll(piecesOf.get(best.getId()));
                    rest.remove(best);
                }
                yield out.size() >= 2 ? out : List.of();
            }
            case CARTELA_SAZONAL -> {
                List<Scheme> inSeason = pool.stream().filter(s -> s.getSeason() == season).toList();
                List<Scheme> out = new ArrayList<>(inSeason.stream().limit(4).toList());
                pool.stream().filter(s -> !out.contains(s)).limit(Math.max(0, 4 - out.size())).forEach(out::add);
                yield out;
            }
            case PALETA_DOMINANTE, HARMONIA_CROMATICA -> {
                Map<String, List<Scheme>> byFam = new LinkedHashMap<>();
                pool.forEach(s -> {
                    String c = itemsBy.getOrDefault(s.getId(), List.of()).stream().map(si -> si.getWardrobeItem().getColor()).filter(Objects::nonNull)
                            .collect(Collectors.groupingBy(x -> x, Collectors.counting())).entrySet().stream().max(Map.Entry.comparingByValue())
                            .map(Map.Entry::getKey).orElse("");
                    byFam.computeIfAbsent(String.valueOf(Taxonomy.COLOR_FAMILY.getOrDefault(c, "Neutro")), k -> new ArrayList<>()).add(s);
                });
                List<Scheme> out = new ArrayList<>();
                byFam.values().stream().sorted(Comparator.comparingInt((List<Scheme> l) -> l.size()).reversed()).forEach(l -> {
                    if (out.size() < 4) {
                        out.addAll(l.stream().limit(4 - out.size()).toList());
                    }
                });
                yield out;
            }
        };
    }

    /** Até n esquemas espaçados na ordem dada (primeiro e último sempre entram). */
    static List<Scheme> spread(List<Scheme> list, int n) {
        if (list.size() <= n) {
            return list;
        }
        List<Scheme> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            out.add(list.get((int) Math.round(i * (list.size() - 1) / (double) (n - 1))));
        }
        return out.stream().distinct().toList();
    }
}
