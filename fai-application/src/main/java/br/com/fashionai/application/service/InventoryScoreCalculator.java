package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.service.InventoryScoreService.Dimension;
import br.com.fashionai.application.service.InventoryScoreService.Result;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.SchemeItem;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

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
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.InventoryScoreService.MIN_PIECES;
import static br.com.fashionai.application.service.InventoryScoreService.SATURATION;
import static br.com.fashionai.application.service.InventoryScoreRubric.WEIGHTS;
import static br.com.fashionai.application.service.InventoryScoreService.WINDOW_DAYS;
import static br.com.fashionai.application.service.InventoryScoreService.band;

/**
 * RF34 §3–§4 — um cálculo completo do Inventory Score: carrega a janela, aplica as dimensões, soma a nota ponderada com
 * o fator k (satura em 20 peças), monta as métricas e grava snapshot e conquistas em transações próprias.
 */
final class InventoryScoreCalculator {
    private final WardrobeItemRepository pieces;
    private final SchemeRepository schemes;
    private final SchemeItemRepository schemeItems;
    private final PieceUsageDiaryEntryRepository diary;
    private final StyleDnaRepository dnas;
    private final RoomService room;
    private final InventoryUsageHistory history;
    private final InventoryScoreRecorder recorder;
    private final SideEffectRunner sideEffects;

    InventoryScoreCalculator(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                             PieceUsageDiaryEntryRepository diary, StyleDnaRepository dnas, RoomService room,
                             InventoryUsageHistory history, InventoryScoreRecorder recorder, SideEffectRunner sideEffects) {
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.diary = diary;
        this.dnas = dnas;
        this.room = room;
        this.history = history;
        this.recorder = recorder;
        this.sideEffects = sideEffects;
    }

    /** Janela de 90 dias: peças vivas e disponíveis, looks que sobreviveram 24 h, Looks do Dia e o uso por dia. */
    InventoryScoreSheet load(UUID userId) {
        LocalDate today = LocalDate.now(FaiPointsService.ZONE);
        LocalDate since = today.minusDays(WINDOW_DAYS);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId).stream().filter(InventoryScoreRules::alive).toList();
        List<WardrobeItem> a = all.stream().filter(InventoryScoreRules::available).toList();
        int n = all.size();
        Map<UUID, WardrobeItem> byId = all.stream().collect(Collectors.toMap(WardrobeItem::getId, w -> w));
        List<Scheme> allSchemes = schemes.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, SchemeStatus.ARCHIVED);
        Map<UUID, Scheme> schemeById = allSchemes.stream().collect(Collectors.toMap(Scheme::getId, s -> s));
        Map<UUID, List<UUID>> schemePieces = new HashMap<>();
        if (!allSchemes.isEmpty()) {
            for (SchemeItem si : schemeItems.findBySchemeIdIn(allSchemes.stream().map(Scheme::getId).toList())) {
                schemePieces.computeIfAbsent(si.getScheme().getId(), k -> new ArrayList<>()).add(si.getWardrobeItem().getId());
            }
        }
        Instant survival = Instant.now().minus(24, ChronoUnit.HOURS);
        Instant sinceInstant = since.atStartOfDay(FaiPointsService.ZONE).toInstant();
        // looks da janela (§3.4/§3.6): esquemas criados/editados na janela que sobreviveram 24 h, com ≥ 2 peças, + Looks do Dia da janela
        List<List<UUID>> windowLooks = new ArrayList<>();
        Set<String> usedKeys = new HashSet<>();
        for (Scheme s : allSchemes) {
            List<UUID> ids = schemePieces.getOrDefault(s.getId(), List.of());
            if (ids.size() < 2 || s.getCreatedAt() == null || s.getCreatedAt().isAfter(survival)) {
                continue;
            }
            boolean inWindow = s.getCreatedAt().isAfter(sinceInstant) || (s.getUpdatedAt() != null && s.getUpdatedAt().isAfter(sinceInstant));
            if (inWindow) {
                windowLooks.add(ids);
            }
        }
        List<PieceUsageDiaryEntry> windowDiary = diary.findByUserIdAndUsedOnAfter(userId, since);
        Set<String> dailySeen = new HashSet<>();
        for (PieceUsageDiaryEntry e : windowDiary) {
            if ("DAILY_LOOK".equals(e.getSource()) && e.getSchemeId() != null && dailySeen.add(e.getSchemeId() + ":" + e.getUsedOn())) {
                List<UUID> ids = schemePieces.getOrDefault(e.getSchemeId(), List.of());
                if (ids.size() >= 2) {
                    windowLooks.add(ids);
                }
            }
        }
        Map<UUID, TreeSet<LocalDate>> usage = history.usageDays(userId, since, schemeById);
        Map<UUID, TreeSet<LocalDate>> usageAll = history.usageDays(userId, LocalDate.of(2000, 1, 1), schemeById);

        Map<String, Integer> dims = new LinkedHashMap<>();
        Map<String, Object> metrics = new LinkedHashMap<>();
        List<Dimension> explain = new ArrayList<>();
        InventoryScoreSheet sheet = new InventoryScoreSheet();
        sheet.userId = userId;
        sheet.today = today;
        sheet.since = since;
        sheet.all = all;
        sheet.a = a;
        sheet.n = n;
        sheet.byId = byId;
        sheet.allSchemes = allSchemes;
        sheet.schemeById = schemeById;
        sheet.schemePieces = schemePieces;
        sheet.survival = survival;
        sheet.sinceInstant = sinceInstant;
        sheet.windowLooks = windowLooks;
        sheet.usage = usage;
        sheet.usageAll = usageAll;
        sheet.dims = dims;
        sheet.metrics = metrics;
        sheet.explain = explain;
        return sheet;
    }

    /** As 7 dimensões na ordem da rubrica (C, D, U, V, O, R, I), a nota com o fator k, as métricas e as gravações. */
    Result computeNow(UUID userId) {
        InventoryScoreSheet sheet = load(userId);
        InventoryCatalogDimensions.catalog(sheet);
        InventoryCatalogDimensions.diversity(sheet);
        InventoryUsageDimensions.utilization(sheet, history);
        InventoryCatalogDimensions.versatility(sheet);
        InventoryRoomDimension.organization(sheet, room);
        InventoryUsageDimensions.discovery(sheet);
        InventoryIdentityDimension.identity(sheet, dnas);
        LocalDate today = sheet.today;
        List<WardrobeItem> all = sheet.all;
        List<WardrobeItem> a = sheet.a;
        int n = sheet.n;
        List<Scheme> allSchemes = sheet.allSchemes;
        Map<UUID, List<UUID>> schemePieces = sheet.schemePieces;
        List<List<UUID>> windowLooks = sheet.windowLooks;
        Map<UUID, TreeSet<LocalDate>> usage = sheet.usage;
        Map<UUID, TreeSet<LocalDate>> usageAll = sheet.usageAll;
        Map<String, Integer> dims = sheet.dims;
        Map<String, Object> metrics = sheet.metrics;
        List<Dimension> explain = sheet.explain;
        Set<String> discoveredKeys = sheet.discoveredKeys;
        InventoryComboCounter.Combos combos = sheet.combos;
        List<WardrobeItem> exposed = sheet.exposed;
        long usedInWindow = sheet.usedInWindow;
        List<WardrobeItem> forgottenNow = sheet.forgottenNow;
        Map<UUID, Long> appearances = sheet.appearances;
        Set<UUID> f = sheet.f;
        Set<UUID> rescued = sheet.rescued;
        Map<UUID, Long> rescueGap = sheet.rescueGap;

        // ---- score
        double sumW = 0, sum = 0;
        for (Map.Entry<String, Integer> e : dims.entrySet()) {
            double w = WEIGHTS.get(e.getKey());
            sumW += w;
            sum += w * e.getValue();
        }
        double k = Math.min(1.0, (double) n / SATURATION);
        int score = sumW == 0 ? 0 : (int) Math.round(10 * sum / sumW * k);
        boolean eligible = n >= MIN_PIECES;

        metrics.put("pieces", n);
        metrics.put("available", a.size());
        metrics.put("forgotten", forgottenNow.size());
        metrics.put("rescued", rescued.size());
        metrics.put("rescueOpportunities", f.size());
        metrics.put("uniqueLooks", allSchemes.stream().map(s -> SchemeService.combinationKey(schemePieces.getOrDefault(s.getId(), List.of())))
                .filter(kk -> !kk.isEmpty()).distinct().count());
        metrics.put("windowLooks", windowLooks.size());
        metrics.put("validCombos", combos.total());
        metrics.put("discoveredCombos", discoveredKeys.size());
        metrics.put("exposed", exposed.size());
        metrics.put("usedInWindow", usedInWindow);
        metrics.put("k", k);
        metrics.put("combosEnumerated", combos.enumerated());
        metrics.put("styleCount", allSchemes.stream().flatMap(s -> Json.csv(s.getStyle()).stream()).distinct().count());
        metrics.put("topUsed", appearances.entrySet().stream().sorted(Map.Entry.<UUID, Long>comparingByValue().reversed()).limit(10)
                .map(e -> e.getKey().toString()).toList());
        metrics.put("rescuedIds", rescued.stream().map(UUID::toString).toList());
        metrics.put("rescueGaps", rescueGap.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue)));
        metrics.put("perPieceCombos", combos.perPiece().entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), Map.Entry::getValue)));
        metrics.put("undiscoveredSample", combos.sample().stream().map(l -> l.stream().map(UUID::toString).toList()).toList());
        metrics.put("usageCount", usage.entrySet().stream().collect(Collectors.toMap(e -> e.getKey().toString(), e -> e.getValue().size())));
        Result result = new Result(userId, eligible, n, k, eligible ? score : null, eligible ? band(score) : null, dims, metrics, explain, Instant.now());
        // snapshot do dia e do mês em transação própria: o quarto pede /api/me/room e /api/me/room/list ao mesmo tempo,
        // os dois calculam o score e a segunda gravação batia na chave única (uq_inv_snap), marcando a transação de
        // leitura como rollback-only — a tela recebia 500. Agora a corrida só perde o snapshot repetido.
        sideEffects.run("snapshot do Inventory Score", () -> recorder.snapshot(result, today));
        if (eligible) {   // mesma corrida na conquista (user_achievements tem chave única): também isolada
            sideEffects.run("conquistas do Inventory Score", () -> recorder.checkAchievements(result, all, usageAll));
        }
        return result;
    }
}
