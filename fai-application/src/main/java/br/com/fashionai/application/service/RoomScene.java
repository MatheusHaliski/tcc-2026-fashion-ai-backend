package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.view.Views;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static br.com.fashionai.application.service.RoomService.FORGOTTEN_DAYS;
import static br.com.fashionai.application.service.RoomService.ZONE;
import static br.com.fashionai.application.service.RoomModules.capacity;
import static br.com.fashionai.application.service.RoomModules.keys;
import static br.com.fashionai.application.service.RoomModules.labels;
import static br.com.fashionai.application.service.RoomModules.module;
import static br.com.fashionai.application.service.RoomModules.positions;
import static br.com.fashionai.application.service.RoomPieceStates.period;
import static br.com.fashionai.application.service.RoomPieceStates.pieceSummary;
import static br.com.fashionai.application.service.RoomPieceStates.seasonalDecoration;
import static br.com.fashionai.application.service.RoomPieceStates.statesOf;

/** Meu Quarto — a cena do quarto (CA01, CA06, CA10): versão do dono e Room Tour (DET-K05), lista acessível e conteúdo de um módulo. */
final class RoomScene {
    private final WardrobeItemRepository pieces;
    private final SchemeItemRepository schemeItems;
    private final DailyLookRepository dailyLooks;
    private final StyleDnaRepository dnas;
    private final UserAchievementRepository achievements;
    private final UserPreferencesRepository preferences;
    private final UserRepository users;
    private final ObjectProvider<RoomService.DecorationsProvider> decorations;
    private final Guard guard;
    private final RoomInventoryItemRepository roomInventory;
    private final RoomCatalogItemRepository roomCatalog;
    private final RoomFurniture furniture;
    private final RoomAddressing addressing;
    private final RoomAmbience ambience;
    private final RoomKeys roomKeys;
    private final RoomDiary diaryUse;

    RoomScene(RoomContext ctx) {
        this.pieces = ctx.pieces;
        this.schemeItems = ctx.schemeItems;
        this.dailyLooks = ctx.dailyLooks;
        this.dnas = ctx.dnas;
        this.achievements = ctx.achievements;
        this.preferences = ctx.preferences;
        this.users = ctx.users;
        this.decorations = ctx.decorations;
        this.guard = ctx.guard;
        this.roomInventory = ctx.roomInventory;
        this.roomCatalog = ctx.roomCatalog;
        this.furniture = ctx.furniture;
        this.addressing = ctx.addressing;
        this.ambience = ctx.ambience;
        this.roomKeys = ctx.roomKeys;
        this.diaryUse = ctx.diaryUse;
    }

    private Set<UUID> dailyLookPieces(UUID userId, LocalDate today) {
        return dailyLooks.findByUserIdAndLookDate(userId, today)
                .map(dl -> schemeItems.findBySchemeIdOrderBySortOrder(dl.getScheme().getId()).stream()
                        .map(si -> si.getWardrobeItem().getId()).collect(Collectors.toSet()))
                .orElse(Set.of());
    }

    Map<String, Object> room(CurrentUser user) {
        return render(user.id(), true);
    }

    /** DET-K05 — Room Tour: quem tem a Chave do Quarto visita a versão pública (sem estados nem preços, ETI-04). */
    Map<String, Object> tour(CurrentUser viewer, UUID ownerId) {
        if (!viewer.id().equals(ownerId) && !keys(furniture.layout(ownerId)).contains(viewer.id().toString())) {
            throw guard.deny(viewer, "room:" + ownerId, Msg.t("room.voce_precisa_da_chave_do"));
        }
        return render(ownerId, viewer.id().equals(ownerId));
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> render(UUID userId, boolean owner) {
        LocalDate today = LocalDate.now(ZONE);
        RoomLayout layout = furniture.layout(userId);
        Map<String, String> labels = labels(layout);
        List<WardrobeItem> all = pieces.findByUserIdOrderByCreatedAtDesc(userId);
        if (!owner) {
            all = all.stream().filter(w -> w.getVisibility() == Visibility.PUBLIC).toList();
        }
        List<RoomStorageEntry> entries = addressing.entries(userId, pieces.findByUserIdOrderByCreatedAtDesc(userId));
        Map<UUID, RoomAddress> addr = new HashMap<>();
        for (RoomStorageEntry e : entries) {
            RoomAddress.parse(e.getAddress()).ifPresent(a -> addr.put(e.getWardrobeItemId(), a));
        }
        Map<UUID, LocalDate> lastDiary = owner ? diaryUse.lastDiaryDates(userId, today.minusDays(FORGOTTEN_DAYS + 1L)) : Map.of();
        Set<UUID> dailyPieces = owner ? dailyLookPieces(userId, today) : Set.of();
        String icon = dnas.findByUserId(userId).map(d -> d.getIconPieceName()).orElse(null);

        Map<String, List<Map<String, Object>>> byModule = new LinkedHashMap<>();
        Map<String, Map<String, Object>> byId = new LinkedHashMap<>();
        List<Map<String, Object>> basket = new ArrayList<>();
        List<Map<String, Object>> saleRack = new ArrayList<>();
        List<Map<String, Object>> showcase = new ArrayList<>();
        List<Map<String, Object>> chair = new ArrayList<>();
        int forgottenCount = 0;
        for (WardrobeItem w : all) {
            RoomAddress a = addr.get(w.getId());
            Set<String> states = owner ? statesOf(w, a, today, lastDiary, dailyPieces, icon) : Set.of();
            Map<String, Object> summary = pieceSummary(w, a, labels, owner, states);
            byId.put(w.getId().toString(), summary);
            if (states.contains("ESQUECIDA")) {
                forgottenCount++;
            }
            if (states.contains("INDISPONIVEL")) {
                basket.add(summary);
            }
            if (states.contains("A_VENDA")) {
                saleRack.add(summary);
            }
            if (states.contains("ICONE")) {
                showcase.add(summary);
            }
            if (a != null && a.zone().equals("chair")) {
                chair.add(summary);
            }
            String moduleId = a == null ? "chair" : a.moduleId();
            byModule.computeIfAbsent(moduleId, k -> new ArrayList<>()).add(summary);
        }

        List<Map<String, Object>> modules = RoomModuleViews.moduleViews(layout, labels, byModule);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("owner", owner);
        out.put("level", layout.getLevel());
        out.put("levelInfo", Map.of("unlocks", FaiPointsService.Level.parse(layout.getLevel()).unlocks,
                "aesthetic", FaiPointsService.Level.parse(layout.getLevel()).aesthetic));
        out.put("modules", modules);
        out.put("drawerLabels", labels);
        out.put("pieces", byId);
        out.put("basket", basket);
        out.put("saleRack", Map.of("name", Msg.t("room.arara_do_desapego"), "pieces", saleRack));
        out.put("showcase", showcase);
        out.put("chair", chair);
        out.put("capacity", Map.of("pieces", all.size(), "positions", positions(layout), "overflow", chair.size()));
        out.put("forgottenCount", forgottenCount);
        if (owner) {
            DailyLook dl = dailyLooks.findByUserIdAndLookDate(userId, today).orElse(null);
            out.put("mirrorDailyLook", dl == null ? null : Map.of("schemeId", dl.getScheme().getId(), "title", String.valueOf(dl.getScheme().getTitle()),
                    "coverImageUrl", String.valueOf(dl.getScheme().getCoverImageUrl()), "pieceIds", dailyPieces));
            List<UserAchievement> recent = achievements.findByUserIdOrderByGrantedAtDesc(userId).stream()
                    .filter(a -> a.getGrantedAt().isAfter(Instant.now().minus(1, ChronoUnit.DAYS))).toList();
            out.put("celebrations", recent.stream().map(a -> Map.of("code", a.getAchievementCode(), "secret", a.isSecret(),
                    "grantedAt", a.getGrantedAt())).toList());
            List<Map<String, Object>> decos = new ArrayList<>();
            decorations.orderedStream().forEach(p -> decos.addAll(p.decorations(userId)));
            out.put("decorations", decos);
            boolean reduceMotion = preferences.findByUserId(userId).map(p -> p.isReduceMotion()).orElse(false);
            boolean sound = preferences.findByUserId(userId).map(p -> p.isSoundEnabled()).orElse(false);
            boolean haptics = preferences.findByUserId(userId).map(p -> p.isHapticsEnabled()).orElse(true);
            LocalDateTime now = LocalDateTime.now(ZONE);
            out.put("ambient", Map.of("period", period(now), "seasonal", String.valueOf(seasonalDecoration(today)),
                    "reduceMotion", reduceMotion, "sound", sound, "haptics", haptics));
            out.put("monogram", module(layout, "monogram").map(m -> String.valueOf(m.get("initials"))).orElse(null));
            out.put("closetLights", ambience.closetLights(userId));
            out.put("unboxing", roomInventory.findByUserId(userId).stream().filter(i -> i.getAppliedModule() == null)
                    .sorted(Comparator.comparing(RoomInventoryItem::getAcquiredAt, Comparator.nullsLast(Comparator.reverseOrder()))).limit(6)
                    .map(i -> Map.of("inventoryId", i.getId(), "sku", i.getSku(), "name", roomCatalog.findById(i.getSku()).map(WardrobeCreatorService::displayName).orElse(i.getSku()),
                            "slotType", roomCatalog.findById(i.getSku()).map(RoomCatalogItem::getSlotType).orElse(""))).toList());
            List<UUID> keyIds = roomKeys.keyUserIds(layout);
            out.put("keys", users.findAllById(keyIds).stream().map(Views::user).toList());
            out.put("light", module(layout, "light").map(m -> m.get("finish")).orElse(Map.of("kelvin", 4000, "guided", false)));
        }
        out.put("camera", Map.of("preset", "editorial_3_4", "azimuth", List.of(-35, 35), "polar", List.of(55, 80), "zoom", List.of(0.8, 1.6),
                "free", false));
        out.put("render", Map.of("preferred", "3d", "fallback", "2.5d", "note", Msg.t("room.sem_webgl_ou_abaixo_do")));
        out.put("photoMode", Map.of("framings", List.of("frontal", "tres_quartos", "detalhe_espelho", "gaveta_aberta"),
                "filters", List.of("editorial", "quente", "pb"), "depthOfField", true, "exportWithoutUi", true));
        return out;
    }

    /** RF32.CA10 — alternativa em lista com as mesmas ações. */
    List<Map<String, Object>> listView(CurrentUser user) {
        Map<String, Object> room = render(user.id(), true);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> m : (List<Map<String, Object>>) room.get("modules")) {
            if (capacity(m) == 0 && !"TOP".equals(m.get("slotType"))) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("moduleId", m.get("id"));
            row.put("label", m.get("accessibleLabel"));
            row.put("count", m.get("count"));
            row.put("pieces", m.get("pieces"));
            row.put("actions", List.of("abrir", "levar_ao_espelho", "mover", "renomear"));
            out.add(row);
        }
        List<Map<String, Object>> chair = (List<Map<String, Object>>) room.get("chair");
        if (!chair.isEmpty()) {
            out.add(Map.of("moduleId", "chair", "label", Msg.t("room.cadeira_pecas_excedentes", chair.size()), "count", chair.size(),
                    "pieces", chair, "actions", List.of("abrir", "mover")));
        }
        return out;
    }

    /** Conteúdo de uma porta/gaveta/posição (CA03). */
    Map<String, Object> open(CurrentUser user, String moduleId) {
        Map<String, Object> room = render(user.id(), true);
        @SuppressWarnings("unchecked") List<Map<String, Object>> modules = (List<Map<String, Object>>) room.get("modules");
        return modules.stream().filter(m -> moduleId.equals(String.valueOf(m.get("id")))).findFirst()
                .orElseThrow(() -> ApiException.notFound(Msg.t("room.modulo")));
    }
}
