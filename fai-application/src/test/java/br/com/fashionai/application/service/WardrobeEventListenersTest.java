package br.com.fashionai.application.service;

import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.application.testkit.MemoryRepository;
import br.com.fashionai.application.testkit.World;
import br.com.fashionai.domain.model.PieceUsageDiaryEntry;
import br.com.fashionai.domain.model.WardrobeAvailabilityChange;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.repository.PieceUsageDiaryEntryRepository;
import br.com.fashionai.domain.repository.WardrobeAvailabilityChangeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Ouvintes do guarda-roupa (RF32–RF35): cada look salvo e Look do Dia vira uso no diário da peça (uma vez por dia), a
 * peça esquecida há 60 dias que volta a ser usada conta como resgate, a disponibilidade fica registrada, e as ações do
 * acervo pagam os FAI Points da regra (interação consigo mesmo não pontua).
 */
class WardrobeEventListenersTest {
    private Kit kit;
    private World world;
    private WardrobeEventListeners listeners;
    private FaiPointsService points;
    private final LocalDate today = LocalDate.now(FaiPointsService.ZONE);

    @BeforeEach
    void setUp() {
        kit = new Kit();
        world = new World(kit);
        listeners = kit.build(WardrobeEventListeners.class);
        points = kit.dep(FaiPointsService.class);
    }

    private List<PieceUsageDiaryEntry> diary() {
        return MemoryRepository.rows(kit.dep(PieceUsageDiaryEntryRepository.class));
    }

    @Test
    void lookSalvoViraUsoNoDiarioEResgatePontua() {
        List<WardrobeItem> mine = world.piecesOf(world.me);
        mine.get(0).markCreatedAt(Instant.now().minusSeconds(120L * 86_400));   // esquecida
        mine.get(1).setLastWornDate(today.minusDays(3));
        UUID scheme = UUID.randomUUID();
        List<UUID> ids = List.of(mine.get(0).getId(), mine.get(1).getId(), world.piecesOf(world.rival).get(0).getId(), UUID.randomUUID());
        listeners.onSchemeSaved(new DomainEvents.SchemeSaved(world.me.getId(), scheme, ids, "CRIAR_LOOK", true));
        assertThat(diary()).hasSize(2);   // peça de outra pessoa e peça inexistente ficam de fora
        assertThat(diary().stream().filter(e -> e.getNote() != null)).hasSize(1);
        verify(points).award(eq(world.me.getId()), eq("FORGOTTEN_RESCUED"), eq("PIECE"), any(), isNull());
        verify(points).award(world.me.getId(), "SCHEME_CREATED", "SCHEME", scheme.toString(), null);
        // no mesmo dia, não duplica
        listeners.onSchemeSaved(new DomainEvents.SchemeSaved(world.me.getId(), scheme, ids, "CRIAR_LOOK", false));
        assertThat(diary()).hasSize(2);
        assertThat(listeners.lastUseBefore(mine.get(1), today.plusDays(1))).isEqualTo(today);
    }

    @Test
    void lookDoDiaContaUsoEVistaMePontua() {
        WardrobeItem w = world.piecesOf(world.me).get(2);
        int before = w.getWearCount();
        listeners.onDailyLook(new DomainEvents.DailyLookRegistered(world.me.getId(), UUID.randomUUID(), today, "VISTA_ME", List.of(w.getId())));
        assertThat(w.getWearCount()).isEqualTo(before + 1);
        verify(points).award(world.me.getId(), "VISTA_ME_DAILY_LOOK", "DAILY_LOOK", today.toString(), null);
        listeners.onDailyLook(new DomainEvents.DailyLookRegistered(world.me.getId(), UUID.randomUUID(), today.minusDays(1), "MANUAL", List.of(w.getId())));
        assertThat(diary()).hasSize(2);
    }

    @Test
    void cadastroDisponibilidadeEOutrasAcoesPontuam() {
        UUID me = world.me.getId();
        UUID piece = world.piecesOf(world.me).get(0).getId();
        listeners.onPieceCreated(new DomainEvents.PieceCreated(me, piece, true));
        listeners.onPieceCreated(new DomainEvents.PieceCreated(me, UUID.randomUUID(), false));
        listeners.onAvailability(new DomainEvents.AvailabilityChanged(me, piece, false));
        assertThat(MemoryRepository.<WardrobeAvailabilityChange>rows(kit.dep(WardrobeAvailabilityChangeRepository.class))).hasSize(3);
        verify(points).award(me, "PIECE_CATALOGED", "PIECE", piece.toString(), null);
        listeners.onPieceUpdated(new DomainEvents.PieceUpdated(me, piece, 95));
        verify(points).award(me, "PIECE_COMPLETED", "PIECE", piece.toString(), null);
        listeners.onModel3d(new DomainEvents.Model3dGenerated(me, piece));
        verify(points).award(me, "PIECE_3D", "PIECE", piece.toString(), null);
        listeners.onRoomOrganized(new DomainEvents.RoomOrganized(me));
        verify(points).award(me, "ROOM_ORGANIZED", "ROOM", null, null);
        assertThat(listeners.describe()).containsKey("listeners");
    }

    @Test
    void interacaoRecebidaPontuaQuemRecebeMenosConsigoMesmo() {
        UUID me = world.me.getId();
        UUID bia = world.rival.getId();
        UUID target = UUID.randomUUID();
        for (String kind : List.of("LIKE", "COMMENT", "REMIX", "OUTRA")) {
            listeners.onInteraction(new DomainEvents.InteractionReceived(me, bia, kind, target));
        }
        verify(points).award(me, "LIKE_RECEIVED", "LIKE", target + ":" + bia, null);
        verify(points).award(me, "COMMENT_RECEIVED", "COMMENT", target + ":" + bia, null);
        verify(points).award(me, "REMIX_RECEIVED", "REMIX", target + ":" + bia, null);
        listeners.onInteraction(new DomainEvents.InteractionReceived(me, me, "LIKE", target));
        listeners.onInteraction(new DomainEvents.InteractionReceived(null, me, "LIKE", target));
        verify(points, never()).award(me, "LIKE_RECEIVED", "LIKE", target + ":" + me, null);
    }

    @Test
    void usoManualDeResgatePontuaPeloDiario() {
        WardrobeItem w = world.piecesOf(world.me).get(3);
        PieceUsageDiaryEntry e = new PieceUsageDiaryEntry();
        e.setWardrobeItemId(w.getId());
        e.setUserId(world.me.getId());
        e.setUsedOn(today);
        e.setNote("resgate depois de 90 dias");
        e.setSource("MANUAL");
        kit.dep(PieceUsageDiaryEntryRepository.class).save(e);
        listeners.onPieceWorn(new DomainEvents.PieceWorn(world.me.getId(), w.getId(), today, "casual"));
        verify(points).award(world.me.getId(), "FORGOTTEN_RESCUED", "PIECE", w.getId() + ":" + today, null);
    }
}
