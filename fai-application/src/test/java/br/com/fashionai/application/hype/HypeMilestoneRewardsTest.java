package br.com.fashionai.application.hype;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import br.com.fashionai.application.aura.AuraUnlocks;
import br.com.fashionai.application.aura.AuraUnlocks.Item;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.events.DomainEvents;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.service.FaiPointsService;
import br.com.fashionai.application.service.NotificationService;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.HypeMilestone.Kind;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.WardrobeItem;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeMomentum;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.HypeMilestoneRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import br.com.fashionai.domain.repository.WardrobeItemRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Circuito Aura (fase 1, elo 3) — marco de Hype que vale algo: FAI Points uma vez por card e marco, o aviso dizendo o
 * que destravou e abrindo o card no painel, e o painel mostrando os pontos só para o dono. Nada disso é sinal de Hype.
 */
class HypeMilestoneRewardsTest {
    private final HypeMilestoneRepository repo = mock(HypeMilestoneRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final FaiPointsService points = mock(FaiPointsService.class);
    private final List<HypeMilestone> store = new ArrayList<>();
    private final List<Notification> sent = new ArrayList<>();
    private final User owner = HypeMilestoneTest.user();
    private HypeMilestoneRewards rewards;
    private HypeMilestoneNotifier notifier;

    @BeforeEach
    void setUp() {
        when(repo.findByEntityTypeAndEntityId(any(), any())).thenAnswer(a -> store.stream()
                .filter(m -> m.getEntityType() == a.getArgument(0) && m.getEntityId().equals(a.getArgument(1))).toList());
        when(repo.findByOwnerIdAndDigestDateOrderByAchievedAtAsc(any(), any())).thenAnswer(a -> List.copyOf(store));
        when(repo.save(any())).thenAnswer(a -> { store.add(a.getArgument(0)); return a.getArgument(0); });
        when(pieces.findByIdIn(anyCollection())).thenAnswer(a -> List.of());
        when(notifications.notify(any(), any(), any(), any(), any(), anyString(), any(), any())).thenAnswer(a -> {
            Notification n = new Notification();
            n.assignId(UUID.randomUUID());
            n.setBody(a.getArgument(6));
            n.setPayloadJson(String.valueOf(a.getArgument(7, Map.class)));
            sent.add(n);
            return n;
        });
        when(points.awardIsolated(any(), any(), any(), any(), any())).thenReturn(new FaiPointsService.Award(true, 20, false, "", null, false));
        rewards = new HypeMilestoneRewards(points, 20, 50, 120);
        notifier = new HypeMilestoneNotifier(repo, notifications, mock(NotificationRepository.class), pieces, schemes,
                HypeScoreConfig.defaults(), null, Clock.fixed(Instant.parse("2026-10-05T15:00:00Z"), ZoneOffset.UTC));
        notifier.useRewards(rewards);
    }

    private WardrobeItem piece() {
        WardrobeItem w = new WardrobeItem();
        w.assignId(UUID.randomUUID());
        w.setUser(owner);
        w.setName("Jaqueta");
        when(pieces.findById(w.getId())).thenReturn(Optional.of(w));
        return w;
    }

    private static DomainEvents.HypeMilestone ev(UUID id, UUID owner, Kind kind, boolean pub) {
        HypeLevel level = kind.isLevel() ? kind.level() : HypeLevel.RELEVANT;
        return new DomainEvents.HypeMilestone(HypeEntityType.PIECE, id, owner, kind, level, HypeMomentum.RISING, 70.0, pub);
    }

    @Test
    void valoresDaConfiguracaoEEmergenteNaoRende() {
        assertThat(rewards.pointsFor(Kind.HOT)).isEqualTo(20);
        assertThat(rewards.pointsFor(Kind.TRENDING)).isEqualTo(50);
        assertThat(rewards.pointsFor(Kind.VIRAL)).isEqualTo(120);
        assertThat(rewards.pointsFor(Kind.EMERGING)).isZero();
        assertThat(new HypeMilestoneRewards(points, -5, 0, 10).pointsFor(Kind.HOT)).isZero();
    }

    @Test
    void marcoCreditaODonoUmaVezPorCardEMarcoEOAvisoAbreOPainel() {
        WardrobeItem w = piece();
        assertThat(notifier.record(ev(w.getId(), owner.getId(), Kind.HOT, true))).isTrue();
        assertThat(notifier.record(ev(w.getId(), owner.getId(), Kind.HOT, true))).isFalse();   // repetido: dedupe, sem crédito

        verify(points, times(1)).awardIsolated(owner.getId(), "HYPE_MILESTONE", "HYPE_MILESTONE", "PIECE:" + w.getId() + ":HOT", 20);
        String body = Msg.resolve(Msg.PT_BR, sent.get(0).getBody());
        assertThat(body).contains("Destravou +20 FAI Points");
        assertThat(sent.get(0).getPayloadJson()).contains("href=/pieces/" + w.getId() + "?destrava=" + w.getId()).contains("points=20");
    }

    @Test
    void hypePessoalTambemRendeEEmergenteNaoCredita() {
        WardrobeItem w = piece();
        notifier.record(ev(w.getId(), owner.getId(), Kind.EMERGING, false));
        verify(points, never()).awardIsolated(any(), any(), any(), any(), anyInt());
        assertThat(Msg.resolve(Msg.PT_BR, sent.get(0).getBody())).doesNotContain("FAI Points");
        notifier.record(ev(w.getId(), owner.getId(), Kind.TRENDING, false));
        verify(points).awardIsolated(eq(owner.getId()), eq("HYPE_MILESTONE"), any(), eq("PIECE:" + w.getId() + ":TRENDING"), eq(50));
    }

    @Test
    void falhaNoCreditoNuncaDerrubaOAviso() {
        when(points.awardIsolated(any(), any(), any(), any(), any())).thenThrow(new IllegalStateException("banco fora"));
        WardrobeItem w = piece();
        assertThat(notifier.record(ev(w.getId(), owner.getId(), Kind.VIRAL, true))).isTrue();
        assertThat(store).hasSize(1);
        assertThat(sent).hasSize(1);
    }

    @Test
    void painelMostraOsPontosDeMarcoSoParaODono() {
        HypeMilestoneUnlocks unlocks = new HypeMilestoneUnlocks(repo, pieces, schemes, rewards);
        WardrobeItem w = piece();
        notifier.record(ev(w.getId(), owner.getId(), Kind.TRENDING, true));   // chegou direto a Tendência
        AuraUnlocks.State state = new AuraUnlocks.State(null, null, null, false, false);
        CurrentUser dono = new CurrentUser(owner.getId(), "dono", "USER", ProfileType.PESSOAL, false, AccountStatus.ACTIVE, null, null);

        List<Item> items = unlocks.items(dono, HypeEntityType.PIECE, w.getId(), state);
        assertThat(items).extracting(Item::requiredLevel).containsExactly(HypeLevel.HOT, HypeLevel.TRENDING, HypeLevel.VIRAL);
        assertThat(items).extracting(Item::met).containsExactly(true, true, false);
        assertThat(items).allSatisfy(i -> assertThat(i.kind()).isEqualTo(AuraUnlocks.Kind.MILESTONE_POINTS));
        assertThat(items.get(0).detail()).contains("passou direto");
        assertThat(items.get(1).title()).isEqualTo("+50 FAI Points de marco");

        CurrentUser visitante = new CurrentUser(UUID.randomUUID(), "outra", "USER", ProfileType.PESSOAL, false, AccountStatus.ACTIVE, null, null);
        assertThat(unlocks.items(visitante, HypeEntityType.PIECE, w.getId(), state)).isEmpty();
        assertThat(unlocks.items(null, HypeEntityType.PIECE, w.getId(), state)).isEmpty();
    }
}
