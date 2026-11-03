package br.com.fashionai.application.service;

import br.com.fashionai.application.ai.AiEngine;
import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.security.Guard;
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

/**
 * Meu Quarto — dependências do {@link RoomService} e os colaboradores por caso de uso, montados uma única vez, na ordem
 * em que um depende do outro (móvel → endereçamento → ambiente, chaves, ações, diário → cena, organização, ilha).
 */
final class RoomContext {
    final RoomLayoutRepository layouts;
    final RoomStorageEntryRepository storage;
    final WardrobeItemRepository pieces;
    final SchemeRepository schemes;
    final SchemeItemRepository schemeItems;
    final DailyLookRepository dailyLooks;
    final StyleDnaRepository dnas;
    final PieceUsageDiaryEntryRepository diary;
    final UserAchievementRepository achievements;
    final UserPreferencesRepository preferences;
    final UserRepository users;
    final FaiPointsLedgerEntryRepository ledger;
    final ObjectProvider<RoomService.DecorationsProvider> decorations;
    final AiEngine ai;
    final Guard guard;
    final ApplicationEventPublisher events;
    final SideEffectRunner sideEffects;
    final ObjectProvider<InventoryScoreService> inventoryScore;
    final RoomInventoryItemRepository roomInventory;
    final RoomCatalogItemRepository roomCatalog;
    /** RF53 · P3-06: Hype v2 dos looks na ilha (preguiçoso: o HypeQueryService depende de serviços que não podem depender deste). */
    final ObjectProvider<HypeQueryService> hype;

    final RoomFurniture furniture;
    final RoomAddressing addressing;
    final RoomAmbience ambience;
    final RoomKeys roomKeys;
    final RoomMoves moves;
    final RoomDiary diaryUse;
    final RoomScene scene;
    final RoomOrganizer organizer;
    final RoomIsland island;

    RoomContext(RoomLayoutRepository layouts, RoomStorageEntryRepository storage, WardrobeItemRepository pieces,
                SchemeRepository schemes, SchemeItemRepository schemeItems, DailyLookRepository dailyLooks,
                StyleDnaRepository dnas, PieceUsageDiaryEntryRepository diary, UserAchievementRepository achievements,
                UserPreferencesRepository preferences, UserRepository users, FaiPointsLedgerEntryRepository ledger,
                ObjectProvider<RoomService.DecorationsProvider> decorations, AiEngine ai, Guard guard, ApplicationEventPublisher events,
                SideEffectRunner sideEffects, ObjectProvider<InventoryScoreService> inventoryScore, RoomInventoryItemRepository roomInventory,
                RoomCatalogItemRepository roomCatalog, ObjectProvider<HypeQueryService> hype) {
        this.layouts = layouts;
        this.storage = storage;
        this.pieces = pieces;
        this.schemes = schemes;
        this.schemeItems = schemeItems;
        this.dailyLooks = dailyLooks;
        this.dnas = dnas;
        this.diary = diary;
        this.achievements = achievements;
        this.preferences = preferences;
        this.users = users;
        this.ledger = ledger;
        this.decorations = decorations;
        this.ai = ai;
        this.guard = guard;
        this.events = events;
        this.sideEffects = sideEffects;
        this.inventoryScore = inventoryScore;
        this.roomInventory = roomInventory;
        this.roomCatalog = roomCatalog;
        this.hype = hype;
        this.furniture = new RoomFurniture(this);
        this.addressing = new RoomAddressing(this);
        this.ambience = new RoomAmbience(this);
        this.roomKeys = new RoomKeys(this);
        this.moves = new RoomMoves(this);
        this.diaryUse = new RoomDiary(this);
        this.scene = new RoomScene(this);
        this.organizer = new RoomOrganizer(this);
        this.island = new RoomIsland(this);
    }
}
