package br.com.fashionai.application.service;

import br.com.fashionai.application.events.SideEffectRunner;
import br.com.fashionai.domain.repository.ChallengeTemplateRepository;
import br.com.fashionai.domain.repository.InventoryScoreSnapshotRepository;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.RankingOptInRepository;
import br.com.fashionai.domain.repository.RankingPositionRepository;
import br.com.fashionai.domain.repository.SchemeItemRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.StyleDnaRepository;
import br.com.fashionai.domain.repository.UserRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

/**
 * RF34 — colaboradores do {@link InventoryScoreService} por caso de uso, montados uma única vez a partir das mesmas
 * dependências do construtor, na ordem em que um depende do outro (histórico e gravações → cálculo; progresso e cards →
 * aba Destaques; álbum, retrospectiva e rankings independentes).
 */
final class InventoryScoreContext {
    final RankingOptInRepository optIns;
    final InventoryUsageHistory history;
    final InventoryScoreRecorder recorder;
    final InventoryScoreCalculator calculator;
    final InventoryProgress progress;
    final InventoryHighlightCards cards;
    final InventoryHighlightsTab tab;
    final InventoryAlbum album;
    final InventoryRetrospective retrospective;
    final InventoryRankings rankings;

    InventoryScoreContext(WardrobeItemRepository pieces, SchemeRepository schemes, SchemeItemRepository schemeItems,
                          PieceUsageDiaryEntryRepository diary, WardrobeAvailabilityChangeRepository availability,
                          StyleDnaRepository dnas, InventoryScoreSnapshotRepository snapshots, RankingOptInRepository optIns,
                          RankingPositionRepository positions, ChallengeTemplateRepository templates, UserRepository users,
                          RoomService room, AchievementService achievements, SideEffectRunner sideEffects) {
        this.optIns = optIns;
        this.history = new InventoryUsageHistory(diary, availability);
        this.recorder = new InventoryScoreRecorder(snapshots, achievements);
        this.calculator = new InventoryScoreCalculator(pieces, schemes, schemeItems, diary, dnas, room, history, recorder, sideEffects);
        this.progress = new InventoryProgress(snapshots, diary);
        this.cards = new InventoryHighlightCards(pieces, dnas);
        this.tab = new InventoryHighlightsTab(progress, cards, achievements, optIns, templates);
        this.album = new InventoryAlbum(pieces);
        this.retrospective = new InventoryRetrospective(diary, pieces, schemes);
        this.rankings = new InventoryRankings(optIns, positions, snapshots, users, dnas);
    }
}
