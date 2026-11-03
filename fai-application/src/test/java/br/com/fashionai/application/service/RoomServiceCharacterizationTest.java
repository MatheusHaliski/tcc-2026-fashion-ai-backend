package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.domain.model.DailyLook;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomLayout;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.StyleDna;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.UserAchievement;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AvailabilityStatus;
import br.com.fashionai.domain.model.enums.SchemeSlot;
import br.com.fashionai.domain.model.enums.Visibility;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.function.Supplier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

/**
 * Caracterização do {@link RoomService} com valores fixos (ids, datas, categorias): o retrato das saídas públicas —
 * layout por nível, endereçamento automático, cena do quarto, lista acessível, ações (mover, renomear, estação, luz,
 * monograma, chaves), organização com IA (motor local) e desfazer, loja (acabamentos), etiqueta, diário e ilha — tem de
 * continuar idêntico ao gravado em {@code room/room-service-portrait.txt}. Ids gerados na hora viram marcadores na
 * ordem em que aparecem; o período do dia e a decoração sazonal (relógio) viram marcadores fixos.
 */
class RoomServiceCharacterizationTest {
    private static final String GOLDEN = "/room/room-service-portrait.txt";
    private static final Instant T0 = Instant.parse("2025-03-01T12:00:00Z");
    private static final String[][] WARDROBE = {
            {"upper_piece", "t_shirt", "white"}, {"upper_piece", "jacket", "black"}, {"upper_piece", "sweater", "grey"},
            {"upper_piece", "blazer", "navy"}, {"full_body_piece", "dress", "red"}, {"lower_piece", "jeans", "blue"},
            {"lower_piece", "leggings", "black"}, {"lower_piece", "shorts", "white"}, {"lower_piece", "skirt", "black"},
            {"lower_piece", "skirt", "pink"}, {"shoes_piece", "casual_sneakers", "white"}, {"shoes_piece", "oxford_shoes", "brown"},
            {"accessory_piece", "handbag", "brown"}, {"accessory_piece", "necklace", "gold"}, {"accessory_piece", "socks", "white"},
            {"accessory_piece", "belt", "black"}, {"upper_piece", "hoodie", "green"}, {"accessory_piece", "cap", "red"},
    };

    private final Kit kit = new Kit();
    private final Map<UUID, Long> lifetime = new LinkedHashMap<>();
    private final List<UUID> anaPieces = new ArrayList<>();
    private final List<UUID> anaLooks = new ArrayList<>();
    private User ana;
    private User bia;
    private User caio;

    private static UUID id(int n) {
        return new UUID(0xB00L, n);
    }

    private User person(String name, int base, long points) {
        User u = Kit.user(name);
        u.assignId(id(base));
        u.markCreatedAt(T0);
        lifetime.put(u.getId(), points);
        return kit.dep(UserRepository.class).save(u);
    }

    private WardrobeItem piece(User u, int n, String[] p) {
        WardrobeItem w = Kit.piece(u, p[1].replace('_', ' ') + " " + n, p[0], p[1], p[2]);
        w.assignId(id(u == ana ? 100 + n : 500 + n));
        w.markCreatedAt(T0.plusSeconds(3600L * n));
        w.setOccasionTags(n % 4 == 0 ? "casual,beach" : "casual");
        return kit.dep(WardrobeItemRepository.class).save(w);
    }

    private RoomService setUp() {
        when(kit.dep(FaiPointsLedgerEntryRepository.class).lifetime(any())).thenAnswer(i -> lifetime.getOrDefault(i.getArgument(0), 0L));
        when(kit.dep(Guard.class).deny(any(), any(), any())).thenAnswer(i -> new ApiException(403, "NEGADO", "negado"));
        doAnswer(i -> {
            if (!((CurrentUser) i.getArgument(0)).id().equals(i.getArgument(1))) {
                throw ApiException.forbidden("não é seu: " + i.getArgument(2));
            }
            return null;
        }).when(kit.dep(Guard.class)).requireOwner(any(), any(), anyString());
        ana = person("ana", 1, 1000);
        bia = person("bia", 2, 0);
        caio = person("caio", 3, 400);
        for (int n = 0; n < WARDROBE.length; n++) {
            WardrobeItem w = piece(ana, n, WARDROBE[n]);
            anaPieces.add(w.getId());
            w.setWearCount(n * 3);
            w.setPrice(n % 3 == 0 ? null : new BigDecimal(40 + n * 5));
            w.setFavorite(n == 2);
            w.setForSale(n == 3 || n == 9);
            w.setPieceOrigin(n == 4 ? "GARIMPADA" : "COMPRADA");
            w.setVisibility(n % 5 == 1 ? Visibility.PRIVATE : Visibility.PUBLIC);
            w.setImageUrl(n == 6 ? null : w.getImageUrl());
            w.setLastWornDate(n == 7 ? LocalDate.now(RoomService.ZONE).minusDays(3) : null);
            if (n == 8) {
                w.setAvailabilityStatus(AvailabilityStatus.UNAVAILABLE);
            }
        }
        for (int n = 0; n < 30; n++) {
            piece(bia, n, WARDROBE[n % 5]);
        }
        StyleDna dna = new StyleDna();
        dna.setUser(ana);
        dna.setIconPieceName("blazer 3");
        kit.dep(StyleDnaRepository.class).save(dna);
        for (int i = 0; i < 3; i++) {
            Scheme s = Kit.look(i < 2 ? ana : bia, "Look " + i);
            s.assignId(id(200 + i));
            s.markCreatedAt(T0);
            s.setTotalPrice(new BigDecimal(100 + i));
            kit.dep(SchemeRepository.class).save(s);
            for (int j = 0; j < 3; j++) {
                WardrobeItem w = kit.dep(WardrobeItemRepository.class).findById(id((i < 2 ? 100 : 500) + i * 3 + j)).orElseThrow();
                var si = Kit.slot(s, w, SchemeSlot.values()[j], j);
                si.assignId(id(300 + i * 10 + j));
                kit.dep(SchemeItemRepository.class).save(si);
            }
            if (i < 2) {
                anaLooks.add(s.getId());
            }
        }
        DailyLook dl = new DailyLook();
        dl.assignId(id(400));
        dl.setUser(ana);
        dl.setScheme(kit.dep(SchemeRepository.class).findById(anaLooks.get(0)).orElseThrow());
        dl.setLookDate(LocalDate.now(RoomService.ZONE));
        kit.dep(DailyLookRepository.class).save(dl);
        UserAchievement a = new UserAchievement();
        a.setId(id(410));
        a.setUserId(ana.getId());
        a.setAchievementCode("ROOM_FIRST");
        a.setGrantedAt(Instant.now().minusSeconds(60));
        kit.dep(UserAchievementRepository.class).save(a);
        return kit.build(RoomService.class);
    }

    @Test
    void retratoDasSaidasPublicas() throws Exception {
        RoomService room = setUp();
        CurrentUser me = Kit.as(ana);
        CurrentUser visitor = Kit.as(bia);
        RoomPortrait p = new RoomPortrait();
        List<WardrobeItem> mine = kit.dep(WardrobeItemRepository.class).findByUserIdOrderByCreatedAtDesc(ana.getId());
        p.add("layout", layoutOf(room.layout(ana.getId())));
        p.add("levelOf", List.of(room.levelOf(ana.getId()), room.levelOf(bia.getId()), room.levelOf(caio.getId())));
        p.add("entries", entriesOf(room.entries(ana.getId(), mine)));
        p.add("room", masked(room.room(me)));
        p.add("listView", room.listView(me));
        p.add("open.door1", room.open(me, "door:1"));
        p.add("open.missing", attempt(() -> room.open(me, "nada")));
        p.add("locate", room.locate(ana.getId(), anaPieces.get(5)));
        p.add("locate.other", room.locate(bia.getId(), anaPieces.get(5)));
        p.add("locateAll", new TreeMap<>(room.locateAll(ana.getId())));
        p.add("labels", room.labels(room.layout(ana.getId())));
        p.add("labelSources", room.labelSources(room.layout(ana.getId())));
        p.add("light.studio", room.setLight(me, 9000));
        p.add("light.dim", room.setLight(me, null, 0.3, false));
        p.add("light.invalid", attempt(() -> room.setLight(me, null, 2.0, null)));
        p.add("light.level", attempt(() -> room.setLight(visitor, 3000)));
        p.add("monogram", room.setMonogram(me, "a.b-c d"));
        p.add("monogram.level", attempt(() -> room.setMonogram(visitor, "xy")));
        p.add("giveKey.self", attempt(() -> room.giveKey(me, ana.getId())));
        p.add("giveKey.unknown", attempt(() -> room.giveKey(me, id(999))));
        p.add("giveKey", room.giveKey(me, bia.getId()));
        p.add("giveKey.again", room.giveKey(me, bia.getId()));
        p.add("hasKey", List.of(room.hasKey(ana.getId(), bia.getId()), room.hasKey(ana.getId(), caio.getId())));
        p.add("tour.visitor", masked(room.tour(visitor, ana.getId())));
        p.add("tour.denied", attempt(() -> room.tour(Kit.as(caio), ana.getId())));
        actions(room, me, visitor, p);
        organization(room, me, p);
        shop(room, p);
        tagsAndIsland(room, me, visitor, p);
        statics(p);
        p.add("bia.room", masked(room.room(visitor)));
        p.add("bia.listView", room.listView(visitor));
        p.verify(GOLDEN);
    }

    private void actions(RoomService room, CurrentUser me, CurrentUser visitor, RoomPortrait p) {
        UUID tee = anaPieces.get(0);
        UUID jeans = anaPieces.get(5);
        p.add("move.invalid", attempt(() -> room.move(me, tee, "qualquer coisa")));
        p.add("move.category", attempt(() -> room.move(me, tee, "drawer:10")));
        p.add("move.position", attempt(() -> room.move(me, tee, "door:1/hanger:99")));
        p.add("move.module", attempt(() -> room.move(me, tee, "door:9/hanger:1")));
        p.add("move.other", attempt(() -> room.move(visitor, tee, "chair:1")));
        p.add("move.chair", room.move(me, tee, "chair:1"));
        p.add("move.door", room.move(me, tee, "door:6/hanger:4"));
        p.add("move.taken", attempt(() -> room.move(me, anaPieces.get(1), "door:6/hanger:4")));
        p.add("move.drawer", room.move(me, jeans, "drawer:20"));
        p.add("move.drawerOther", attempt(() -> room.move(me, anaPieces.get(10), "drawer:20")));
        p.add("move.shoe", room.move(me, anaPieces.get(10), "drawer:21"));
        p.add("move.shoeFull", attempt(() -> room.move(me, anaPieces.get(11), "drawer:21")));
        p.add("rename", room.renameDrawer(me, 7, "  Shorts de praia  "));
        p.add("rename.clear", room.renameDrawer(me, 2, " "));
        p.add("rename.missing", attempt(() -> room.renameDrawer(me, 99, "x")));
        p.add("showInRoom", room.showInRoom(me, jeans));
        p.add("showInRoom.other", attempt(() -> room.showInRoom(visitor, jeans)));
        p.add("season.level", attempt(() -> room.seasonStorage(visitor, List.of(), true)));
        p.add("season.unknown", attempt(() -> room.seasonStorage(me, List.of(id(777)), true)));
        p.add("season.store", room.seasonStorage(me, List.of(anaPieces.get(2), anaPieces.get(6)), true));
        p.add("outOfSeason", room.outOfSeason(ana.getId()));
        p.add("season.restore", room.seasonStorage(me, List.of(anaPieces.get(2), anaPieces.get(6)), false));
        p.add("storage.afterActions", entriesOf(storageOf(ana.getId())));
        WardrobeItem nova = Kit.piece(ana, "bota nova", "shoes_piece", "boots", "black");
        nova.assignId(id(150));
        nova.markCreatedAt(T0.plusSeconds(86_400L));
        kit.dep(WardrobeItemRepository.class).save(nova);
        room.onPieceCreated(new DomainEvents.PieceCreated(ana.getId(), nova.getId(), true));
        p.add("created.locate", room.locate(ana.getId(), nova.getId()));
        p.add("autoAssign.existing", room.autoAssign(ana.getId(), nova.getId()));
        p.add("autoAssign.missing", attempt(() -> room.autoAssign(ana.getId(), id(888))));
        room.onPieceDeleted(new DomainEvents.PieceDeleted(ana.getId(), nova.getId()));
        p.add("deleted.storage", storageOf(ana.getId()).stream().anyMatch(e -> e.getWardrobeItemId().equals(nova.getId())));
    }

    private void organization(RoomService room, CurrentUser me, RoomPortrait p) {
        Map<String, Object> local = room.organizePreview(me, false);
        p.add("organize.local", local);
        Map<String, Object> ai = room.organizePreview(me, true);
        p.add("organize.ai", ai);
        p.add("undo.empty", attempt(() -> room.undoOrganization(me)));
        @SuppressWarnings("unchecked") Map<String, String> labels = new LinkedHashMap<>((Map<String, String>) ai.get("labels"));
        labels.put("8", "Saias");
        labels.put("9", "");
        labels.put("99", "Fantasma");
        @SuppressWarnings("unchecked") List<Map<String, Object>> moves = new ArrayList<>((List<Map<String, Object>>) ai.get("moves"));
        moves.add(Map.of("pieceId", id(777).toString(), "to", "drawer:3"));
        p.add("apply", room.applyOrganization(me, labels, moves));
        p.add("apply.layout", layoutOf(room.layout(ana.getId())));
        p.add("apply.storage", entriesOf(storageOf(ana.getId())));
        p.add("undo", room.undoOrganization(me));
        p.add("undo.storage", entriesOf(storageOf(ana.getId())));
        p.add("undo.again", attempt(() -> room.undoOrganization(me)));
        p.add("apply.null", room.applyOrganization(me, null, null));
    }

    private void shop(RoomService room, RoomPortrait p) {
        RoomCatalogItem door = new RoomCatalogItem();
        door.setSku("FAI-PRT-AB60-NOZ");
        door.setKind("MODULE");
        door.setSlotType("DOOR");
        door.setWidthCm(60);
        door.setMoldId("PRT-AB60");
        door.setFinishJson("{\"color\":\"#5a3a22\",\"texture\":\"nogueira\"}");
        door.setRarity("RARE");
        p.add("compatible.door", room.compatibleModules(ana.getId(), door));
        room.applyFinish(ana.getId(), "door:1", door);
        RoomCatalogItem wardrobe = new RoomCatalogItem();
        wardrobe.setSku("FAI-WARD-MAISON");
        wardrobe.setKind("WARDROBE");
        wardrobe.setRarity("EPIC");
        wardrobe.setBundleJson("[{\"slotType\":\"DRAWER\",\"moldId\":\"GAV-X\",\"finish\":{\"color\":\"#000\"}}]");
        p.add("compatible.wardrobe", room.compatibleModules(ana.getId(), wardrobe));
        room.applyFinish(ana.getId(), null, wardrobe);
        p.add("finish.applied", layoutOf(room.layout(ana.getId())));
        room.resetFinish(ana.getId(), "door:1", door);
        room.resetFinish(ana.getId(), "ALL", wardrobe);
        p.add("finish.reset", layoutOf(room.layout(ana.getId())));
        room.setLevel(caio.getId(), "MAISON");
        p.add("setLevel.caio", layoutOf(room.layout(caio.getId())));
        room.setLevel(caio.getId(), "STUDIO");
        p.add("setLevel.caio.studio", layoutOf(room.layout(caio.getId())));
    }

    private void tagsAndIsland(RoomService room, CurrentUser me, CurrentUser visitor, RoomPortrait p) {
        UUID blazer = anaPieces.get(3);
        p.add("diary.future", attempt(() -> room.diaryEntry(me, blazer, LocalDate.now(RoomService.ZONE).plusDays(2), null, null)));
        p.add("diary.occasion", attempt(() -> room.diaryEntry(me, blazer, LocalDate.of(2025, 5, 1), "inventada", null)));
        p.add("diary", room.diaryEntry(me, blazer, LocalDate.of(2025, 5, 1), "casual", "Almoço com a família"));
        p.add("diary.same", room.diaryEntry(me, blazer, LocalDate.of(2025, 5, 1), "casual", "de novo"));
        p.add("diary.second", room.diaryEntry(me, blazer, LocalDate.of(2025, 4, 20), "", null));
        p.add("pieceTag", room.pieceTag(me, anaPieces.get(4)));
        p.add("pieceTag.other", attempt(() -> room.pieceTag(visitor, anaPieces.get(4))));
        p.add("usedRecently", room.usedRecently(ana.getId(), LocalDate.of(2025, 1, 1)));
        p.add("lastDiaryDates", room.lastDiaryDates(ana.getId(), LocalDate.of(2025, 1, 1)));
        p.add("island", room.island(me, anaLooks));
        p.add("island.one", attempt(() -> room.island(me, anaLooks.subList(0, 1))));
        p.add("island.other", attempt(() -> room.island(me, List.of(anaLooks.get(0), id(202)))));
        p.add("island.level", attempt(() -> room.island(visitor, anaLooks)));
    }

    private void statics(RoomPortrait p) {
        for (FaiPointsService.Level level : FaiPointsService.Level.values()) {
            p.add("defaultModules." + level, RoomService.defaultModules(level));
        }
        Map<String, String> labels = Map.of("1", "Jeans", "2", "Academia", "3", "Praia", "7", "Outra");
        List<String> addresses = List.of("door:1/hanger:1", "door:3/hanger:2", "drawer:1", "drawer:2", "drawer:3", "drawer:7", "drawer:9",
                "base:1", "bags:1", "jewelry:1", "shoe:1", "chair:1", "season:1", "top:1");
        Map<String, Object> coherent = new LinkedHashMap<>();
        for (UUID pid : anaPieces) {
            WardrobeItem w = kit.dep(WardrobeItemRepository.class).findById(pid).orElseThrow();
            coherent.put(w.getName(), addresses.stream().map(a -> RoomAddress.parse(a).map(x -> RoomService.coherent(w, x, labels)).orElse(null)).toList());
            LocalDate today = LocalDate.of(2025, 6, 1);
            LocalDate last = RoomService.lastUse(w, Map.of(pid, LocalDate.of(2025, 4, 1)));
            String lastText = LocalDate.now(RoomService.ZONE).minusDays(3).equals(last) ? "<hoje-3>" : String.valueOf(last);
            coherent.put(w.getName() + ".use", List.of(lastText,
                    RoomService.forgotten(w, null, today), RoomService.forgotten(w, LocalDate.of(2025, 5, 1), today)));
        }
        p.add("coherent", coherent);
        p.add("drawerCapacity", List.of(RoomService.drawerCapacity("shoes_piece"), RoomService.drawerCapacity("lower_piece"),
                RoomService.drawerCapacity("accessory_piece"), RoomService.drawerCapacity(null)));
    }

    private List<RoomStorageEntry> storageOf(UUID userId) {
        return kit.dep(RoomStorageEntryRepository.class).findByUserId(userId);
    }

    private static List<String> entriesOf(List<RoomStorageEntry> entries) {
        return entries.stream().map(e -> e.getWardrobeItemId() + " @ " + e.getAddress() + " by " + e.getAssignedBy()).sorted().toList();
    }

    private static Map<String, Object> layoutOf(RoomLayout l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("level", l.getLevel());
        m.put("modules", Json.list(l.getModulesJson()));
        m.put("drawerLabels", Json.map(l.getDrawerLabelsJson()));
        m.put("previousMap", l.getPreviousMapJson() == null ? null : Json.map(l.getPreviousMapJson()));
        return m;
    }

    /** O período do dia e a decoração sazonal dependem do relógio: viram marcadores (o resto do ambiente fica). */
    private static Map<String, Object> masked(Map<String, Object> room) {
        Map<String, Object> out = new LinkedHashMap<>(room);
        if (out.get("ambient") instanceof Map<?, ?> amb) {
            Map<String, Object> a = new LinkedHashMap<>();
            amb.forEach((k, v) -> a.put(String.valueOf(k), "period".equals(k) || "seasonal".equals(k) ? "<relógio>" : v));
            out.put("ambient", a);
        }
        return out;
    }

    private static Object attempt(Supplier<?> call) {
        try {
            return call.get();
        } catch (ApiException ex) {
            return Map.of("status", ex.status(), "code", String.valueOf(ex.code()), "message", String.valueOf(ex.getMessage()));
        }
    }
}
