package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.room.RoomAddress;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.RoomStorageEntry;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.DailyLookRepository;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.RoomLayoutRepository;
import br.com.fashionai.domain.repository.RoomStorageEntryRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserAchievementRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * RF32 — Meu Quarto: visualização espacial do guarda-roupa (FAI Origem), endereçamento estável (§1.1),
 * estados comunicados pelo ambiente (§1.2), organização manual e com IA (CA04/CA05), "Mostrar no quarto"
 * (CA09), lista acessível (CA10), evolução do móvel por nível (RF35 §5.3) e loja (Molde + Acabamento).
 * Nenhum cadastro é bloqueado por capacidade: o excedente vai para a Cadeira (CA07).
 * Facade (R87): este bean é dono das transações, dos ouvintes de eventos e dos contratos públicos; cada caso de uso
 * mora num colaborador do pacote, montado em {@link RoomContext}; a porta do layout (RF35) vem de {@link RoomLayoutPort}.
 */
@Service
public class RoomService extends RoomLayoutPort {
    public static final ZoneId ZONE = FaiPointsService.ZONE;
    /** Esquecida: sem uso há 60+ dias (FORGOTTEN_DAYS, MyWardrobeView.tsx:61). */
    public static final int FORGOTTEN_DAYS = 60;
    public static final int HANGERS_PER_DOOR = 4;
    public static final int DRAWER_CAPACITY = 4;
    public static final int TOP_CAPACITY = 8;
    public static final int BASE_CAPACITY = 12;
    public static final int SHOE_RACK_CAPACITY = 24;
    public static final List<String> DEFAULT_DRAWER_LABELS = List.of("Jeans", "Academia", "Praia", Msg.k("room.acessorios"), Msg.k("room.intimas"), "Favoritas");
    /** Alias mantido para consumidores do pacote (provador); a regra vive em {@link RoomPlacementRules}. */
    static final Set<String> OUTERWEAR = RoomPlacementRules.OUTERWEAR;

    /** Decorações de desafios ativos (RF36 §5) — implementado pelo ChallengeService, sem acoplar o quarto. */
    public interface DecorationsProvider {
        List<Map<String, Object>> decorations(UUID userId);
    }

    public record Location(RoomAddress address, String label, String moduleId) {
    }

    public RoomService(RoomLayoutRepository layouts, RoomStorageEntryRepository storage, WardrobeItemRepository pieces,
                       SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                       StyleDnaRepository dnas, PieceUsageDiaryEntryRepository diary, UserAchievementRepository achievements,
                       UserPreferencesRepository preferences, UserRepository users, FaiPointsLedgerEntryRepository ledger,
                       ObjectProvider<DecorationsProvider> decorations, AiEngine ai, Guard guard, ApplicationEventPublisher events,
            SideEffectRunner sideEffects, ObjectProvider<InventoryScoreService> inventoryScore, RoomInventoryItemRepository roomInventory,
            RoomCatalogItemRepository roomCatalog, ObjectProvider<HypeQueryService> hype) {
        super(new RoomContext(layouts, storage, pieces, schemes, schemeItems, dailyLooks, dnas, diary, achievements, preferences, users,
                ledger, decorations, ai, guard, events, sideEffects, inventoryScore, roomInventory, roomCatalog, hype));
    }

    // ================================================================== ambiente — RoomAmbience
    /** Existing clients may still set temperature; switching/dimming is available in every room. */
    @Transactional
    public Map<String, Object> setLight(CurrentUser user, int kelvin) {
        return setLight(user, kelvin, null, null);
    }

    @Transactional
    public Map<String, Object> setLight(CurrentUser user, Integer kelvin, Double intensity, Boolean on) {
        return ctx.ambience.setLight(user, kelvin, intensity, on);
    }

    @Transactional
    public Map<String, Object> setMonogram(CurrentUser user, String initials) {
        return ctx.ambience.setMonogram(user, initials);
    }

    // ================================================================== endereçamento (§1.1) e atribuição automática (CA02) — RoomAddressing
    /** RF32.CA02 / RF34 §3.5 — o endereço é coerente com o tipo e com a categoria da gaveta? */
    public static boolean coherent(WardrobeItem w, RoomAddress a, Map<String, String> labels) {
        return RoomPlacementRules.coherent(w, a, labels);
    }

    public static int drawerCapacity(String category) {
        return RoomPlacementRules.drawerCapacity(category);
    }

    @Transactional
    public List<RoomStorageEntry> entries(UUID userId, List<WardrobeItem> all) {
        return ctx.addressing.entries(userId, all);
    }

    @Transactional
    public RoomAddress autoAssign(UUID userId, UUID pieceId) {
        return ctx.addressing.autoAssign(userId, pieceId);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onPieceCreated(DomainEvents.PieceCreated ev) {
        // o quarto nunca bloqueia o cadastro (CA07): endereço automático depois do commit, em transação própria
        ctx.sideEffects.run("quarto:PieceCreated", () -> autoAssign(ev.userId(), ev.pieceId()));
    }

    @EventListener
    @Transactional
    public void onPieceDeleted(DomainEvents.PieceDeleted ev) {
        ctx.addressing.onPieceDeleted(ev);
    }

    @Transactional
    public Optional<Location> locate(UUID userId, UUID pieceId) {
        return ctx.addressing.locate(userId, pieceId);
    }

    public Map<UUID, Location> locateAll(UUID userId) {
        return ctx.addressing.locateAll(userId);
    }

    public Set<UUID> outOfSeason(UUID userId) {
        return ctx.addressing.outOfSeason(userId);
    }

    // ================================================================== estados das peças — RoomPieceStates, RoomDiary
    public Set<UUID> usedRecently(UUID userId, LocalDate since) {
        return ctx.diaryUse.usedRecently(userId, since);
    }

    /** Última data de uso conhecida (diário + lastWornDate); null = nunca usada. */
    public static LocalDate lastUse(WardrobeItem w, Map<UUID, LocalDate> lastDiary) {
        return RoomPieceStates.lastUse(w, lastDiary);
    }

    public static boolean forgotten(WardrobeItem w, LocalDate last, LocalDate today) {
        return RoomPieceStates.forgotten(w, last, today);
    }

    public Map<UUID, LocalDate> lastDiaryDates(UUID userId, LocalDate since) {
        return ctx.diaryUse.lastDiaryDates(userId, since);
    }

    // ================================================================== visão do quarto (CA01, CA06, CA10) — RoomScene, RoomKeys
    @Transactional
    public Map<String, Object> room(CurrentUser user) {
        return ctx.scene.room(user);
    }

    @Transactional
    public Map<String, Object> tour(CurrentUser viewer, UUID ownerId) {
        return ctx.scene.tour(viewer, ownerId);
    }

    @Transactional
    public Map<String, Object> giveKey(CurrentUser user, UUID guestId) {
        return ctx.roomKeys.giveKey(user, guestId);
    }

    public boolean hasKey(UUID ownerId, UUID guestId) {
        return ctx.roomKeys.hasKey(ownerId, guestId);
    }

    @Transactional
    public List<Map<String, Object>> listView(CurrentUser user) {
        return ctx.scene.listView(user);
    }

    // ================================================================== ações (CA03/CA04/CA09) — RoomScene, RoomMoves
    @Transactional
    public Map<String, Object> open(CurrentUser user, String moduleId) {
        return ctx.scene.open(user, moduleId);
    }

    @Transactional
    public Map<String, Object> move(CurrentUser user, UUID pieceId, String rawAddress) {
        return ctx.moves.move(user, pieceId, rawAddress);
    }

    @Transactional
    public Map<String, String> renameDrawer(CurrentUser user, int drawer, String label) {
        return ctx.moves.renameDrawer(user, drawer, label);
    }

    @Transactional
    public Map<String, Object> showInRoom(CurrentUser user, UUID pieceId) {
        return ctx.moves.showInRoom(user, pieceId);
    }

    @Transactional
    public Map<String, Object> seasonStorage(CurrentUser user, List<UUID> pieceIds, boolean store) {
        return ctx.moves.seasonStorage(user, pieceIds, store);
    }

    // ================================================================== organizar com IA (CA05) — RoomOrganizer
    @Transactional
    public Map<String, Object> organizePreview(CurrentUser user, boolean useAi) {
        return ctx.organizer.organizePreview(user, useAi);
    }

    @Transactional
    public Map<String, Object> applyOrganization(CurrentUser user, Map<String, String> labels, List<Map<String, Object>> moves) {
        return ctx.organizer.applyOrganization(user, labels, moves);
    }

    @Transactional
    public Map<String, Object> undoOrganization(CurrentUser user) {
        return ctx.organizer.undoOrganization(user);
    }

    // ================================================================== etiqueta da peça (DET-M02/M04/C07) e ilha (Atelier) — RoomDiary, RoomIsland
    @Transactional
    public Map<String, Object> pieceTag(CurrentUser user, UUID pieceId) {
        return ctx.diaryUse.pieceTag(user, pieceId);
    }

    @Transactional
    public Map<String, Object> diaryEntry(CurrentUser user, UUID pieceId, LocalDate date, String occasion, String note) {
        return ctx.diaryUse.diaryEntry(user, pieceId, date, occasion, note);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> island(CurrentUser user, List<UUID> schemeIds) {
        return ctx.island.island(user, schemeIds);
    }
}
