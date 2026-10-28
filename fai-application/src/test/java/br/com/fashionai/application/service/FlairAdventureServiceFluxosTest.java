package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.flair.AfterpartyEngine;
import br.com.fashionai.application.flair.FlairEngine;
import br.com.fashionai.application.hype.AuraHypeDropService;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.application.testkit.Kit;
import br.com.fashionai.domain.model.FlairAdventureSession;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.SchemeStatus;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FlairAdventureSessionRepository;
import br.com.fashionai.domain.repository.SchemeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** FLAIR Metamorfose Afterparty: montagem do deck, início, estado, ações e prêmio de vitória. */
class FlairAdventureServiceFluxosTest {
    private final FlairAdventureSessionRepository sessions = mock(FlairAdventureSessionRepository.class);
    private final FlairService flair = mock(FlairService.class);
    private final Guard guard = mock(Guard.class);
    private final FaiPointsLedgerEntryRepository ledger = mock(FaiPointsLedgerEntryRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final AuraHypeDropService drops = mock(AuraHypeDropService.class);
    private final FaiPointsService points = mock(FaiPointsService.class);
    private final FlairAdventureService service = new FlairAdventureService(sessions, flair, guard, ledger, schemes, drops, points);
    private final User owner = Kit.user("ana");
    private final CurrentUser me = Kit.as(owner);

    private static FlairEngine.Card card(String rarity, String color, String... styles) {
        return new FlairEngine.Card(UUID.randomUUID().toString(), "Peça", "upper_piece", "shirt", "/img.png", color, null, null,
                List.of(styles), List.of(), null, null, Map.of(), rarity, 1.0, 10, null, FlairEngine.Hype.NONE);
    }

    private static FlairEngine.Deck deck(String id, FlairEngine.Card... cards) {
        return new FlairEngine.Deck(id, "Look " + id, List.of(cards), List.of(), 1.0, null, 0, 10, Map.of(), List.of());
    }

    @BeforeEach
    void loft() {
        when(points.level(any())).thenReturn(FaiPointsService.Level.LOFT);
        when(sessions.save(any())).thenAnswer(i -> {
            FlairAdventureSession s = i.getArgument(0);
            if (s.getId() == null) {
                s.assignId(UUID.randomUUID());
            }
            return s;
        });
    }

    @Test
    void cartaoDoDeckDefineTierPapelCorECusto() {
        var lendario = FlairAdventureService.loadout(deck("a", card("RARE", "#AABBCC", "Formal"), card("RARE", null, "x")), null);
        assertThat(lendario.tier()).isEqualTo("LEGENDARY");
        assertThat(lendario.role()).isEqualTo("VIP");
        assertThat(lendario.color()).isEqualTo("#AABBCC");
        assertThat(lendario.cost()).isEqualTo(35);
        assertThat(lendario.cooldownMs()).isEqualTo(14000);
        assertThat(lendario.techwear()).isFalse();

        var raroSemAlta = FlairAdventureService.loadout(deck("b", card("RARE", "azul", "Street")), Map.of("source", "OTHER"));
        assertThat(raroSemAlta.role()).isEqualTo("GUEST");
        assertThat(raroSemAlta.color()).isEqualTo("#6487a5");

        var premium = FlairAdventureService.loadout(deck("c", card("PREMIUM", null, "Techwear"), card("LIMITED", null, "Sport")), null);
        assertThat(premium.tier()).isEqualTo("RARE");
        assertThat(premium.role()).isEqualTo("GUEST");
        assertThat(premium.cost()).isEqualTo(20);
        assertThat(premium.techwear()).isTrue();

        var comum = FlairAdventureService.loadout(deck("d", card("COMMON", null, "athleisure"), card("RARE", null)), null);
        assertThat(comum.tier()).isEqualTo("COMMON");
        assertThat(comum.role()).isEqualTo("STAFF");
        assertThat(comum.cost()).isEqualTo(10);
        assertThat(comum.cooldownMs()).isEqualTo(6000);

        var evento = FlairAdventureService.loadout(deck("e", card("COMMON", null)), Map.of("source", "VERIFIED_DROP", "seriesCode", "AFTERPARTY_01"));
        assertThat(evento.tier()).isEqualTo("COLLAB_DROP");
        assertThat(evento.role()).isEqualTo("EVENT_VIP");
        assertThat(evento.cost()).isEqualTo(30);
        assertThat(evento.cooldownMs()).isEqualTo(12000);
        var outraSerie = FlairAdventureService.loadout(deck("f", card("COMMON", null)), Map.of("source", "VERIFIED_DROP", "seriesCode", "OUTRA"));
        assertThat(outraSerie.tier()).isEqualTo("COMMON");
    }

    @Test
    void abaixoDoLoftEhBloqueado() {
        when(points.level(any())).thenReturn(FaiPointsService.Level.ESTREIA);
        assertThatThrownBy(() -> service.start(me, List.of(UUID.randomUUID())))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("FAI_LEVEL_REQUIRED"));
    }

    @Test
    void semMissaoAtivaDevolveNulo() {
        assertThat(service.active(me)).isNull();
        verify(guard).requireCanCreate(me);
    }

    @Test
    void deckInvalidoQuandoVazioRepetidoGrandeOuDeOutraPessoa() {
        UUID a = UUID.randomUUID();
        assertThatThrownBy(() -> service.start(me, null)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.start(me, List.of())).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.start(me, List.of(a, a))).isInstanceOf(ApiException.class);
        List<UUID> oito = java.util.stream.Stream.generate(UUID::randomUUID).limit(8).toList();
        assertThatThrownBy(() -> service.start(me, oito)).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("DECK_INVALID"));
        assertThatThrownBy(() -> service.start(me, List.of(a))).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        when(ledger.lockOwner(owner.getId())).thenReturn(Optional.of(owner));
        when(flair.decks(me)).thenReturn(List.of(deck(UUID.randomUUID().toString(), card("COMMON", null))));
        assertThatThrownBy(() -> service.start(me, List.of(a))).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("DECK_INVALID"));
    }

    @Test
    void iniciarGravaSessaoERegistraPartida() {
        UUID a = UUID.randomUUID();
        when(ledger.lockOwner(owner.getId())).thenReturn(Optional.of(owner));
        when(flair.decks(me)).thenReturn(List.of(deck(a.toString(), card("RARE", "#112233", "classic"))));
        when(drops.classifications(any(), any())).thenReturn(Map.of());

        Map<String, Object> out = service.start(me, List.of(a));

        AfterpartyEngine.State st = (AfterpartyEngine.State) out.get("state");
        assertThat(st.loadouts).singleElement().extracting(AfterpartyEngine.Loadout::role).isEqualTo("VIP");
        assertThat(out.get("id")).isNotNull();
        verify(points).game(eq(owner.getId()), eq("FLAIR_METAMORFOSE_AFTERPARTY"), anyString(), eq("PLAY"));
    }

    @Test
    void iniciarComMissaoAtivaDevolveAMesma() {
        FlairAdventureSession s = session(AfterpartyEngine.start(List.of(), System.currentTimeMillis()));
        when(ledger.lockOwner(owner.getId())).thenReturn(Optional.of(owner));
        when(sessions.findFirstByOwnerIdAndStatusOrderByCreatedAtDesc(owner.getId(), "ACTIVE")).thenReturn(Optional.of(s));
        when(sessions.lockOwned(s.getId(), owner.getId())).thenReturn(Optional.of(s));

        Map<String, Object> out = service.start(me, List.of(UUID.randomUUID()));

        assertThat(out.get("id")).isEqualTo(s.getId());
        assertThat(service.active(me).get("id")).isEqualTo(s.getId());
        verify(points, never()).game(any(), anyString(), anyString(), eq("PLAY"));
    }

    private FlairAdventureSession session(AfterpartyEngine.State st) {
        FlairAdventureSession s = new FlairAdventureSession();
        s.assignId(UUID.randomUUID());
        s.setOwnerId(owner.getId());
        s.setStateJson(Json.write(st));
        return s;
    }

    @Test
    void estadoDeMissaoAlheiaDa404EEstadoCorrompidoFalha() {
        assertThatThrownBy(() -> service.state(me, UUID.randomUUID())).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        FlairAdventureSession s = session(AfterpartyEngine.start(List.of(), 0));
        s.setStateJson("{nao json");
        when(sessions.lockOwned(s.getId(), owner.getId())).thenReturn(Optional.of(s));
        assertThatThrownBy(() -> service.state(me, s.getId())).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void acaoDeVitoriaPagaOPremioUmaVez() {
        AfterpartyEngine.State st = AfterpartyEngine.start(List.of(), System.currentTimeMillis());
        st.item = true;
        st.z = 5;
        FlairAdventureSession s = session(st);
        when(sessions.lockOwned(s.getId(), owner.getId())).thenReturn(Optional.of(s));

        Map<String, Object> out = service.action(me, s.getId(), new AfterpartyEngine.Action("INTERACT", null, 0, 0, false, "req_00000001"));

        assertThat(((AfterpartyEngine.State) out.get("state")).status).isEqualTo("COMPLETED");
        assertThat(s.getStatus()).isEqualTo("COMPLETED");
        verify(points).game(owner.getId(), "FLAIR_METAMORFOSE_AFTERPARTY", s.getId().toString(), "WIN");
        service.state(me, s.getId());
        verify(points).game(any(), anyString(), anyString(), eq("WIN"));
    }

    @Test
    void abandonarSoMissaoAtiva() {
        FlairAdventureSession s = session(AfterpartyEngine.start(List.of(), System.currentTimeMillis()));
        when(sessions.lockOwned(s.getId(), owner.getId())).thenReturn(Optional.of(s));
        service.action(me, s.getId(), new AfterpartyEngine.Action("ABANDON", null, 0, 0, false, null));
        assertThat(s.getStatus()).isEqualTo("ABANDONED");
        service.action(me, s.getId(), new AfterpartyEngine.Action("ABANDON", null, 0, 0, false, null));
        assertThat(s.getStatus()).isEqualTo("ABANDONED");
        assertThatThrownBy(() -> service.action(me, s.getId(), null)).isInstanceOf(ApiException.class);
    }

    @Test
    void ativarExigeLookProprioNaoArquivado() {
        FlairAdventureSession s = session(AfterpartyEngine.start(List.of(), System.currentTimeMillis()));
        when(sessions.lockOwned(s.getId(), owner.getId())).thenReturn(Optional.of(s));
        assertThatThrownBy(() -> service.action(me, s.getId(), new AfterpartyEngine.Action("ACTIVATE", "xx", 0, 0, false, "req_00000002")))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("DECK_INVALID"));
        UUID lookId = UUID.randomUUID();
        assertThatThrownBy(() -> service.action(me, s.getId(), new AfterpartyEngine.Action("ACTIVATE", lookId.toString(), 0, 0, false, "req_00000003")))
                .extracting(e -> ((ApiException) e).status()).isEqualTo(404);
        Scheme alheio = Kit.look(Kit.user("bia"), "Alheio");
        when(schemes.findById(lookId)).thenReturn(Optional.of(alheio));
        assertThatThrownBy(() -> service.action(me, s.getId(), new AfterpartyEngine.Action("ACTIVATE", lookId.toString(), 0, 0, false, "req_00000004")))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("DECK_INVALID"));
        Scheme arquivado = Kit.look(owner, "Arquivado");
        arquivado.setStatus(SchemeStatus.ARCHIVED);
        when(schemes.findById(lookId)).thenReturn(Optional.of(arquivado));
        assertThatThrownBy(() -> service.action(me, s.getId(), new AfterpartyEngine.Action("ACTIVATE", lookId.toString(), 0, 0, false, "req_00000005")))
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("DECK_INVALID"));
        Scheme meu = Kit.look(owner, "Meu");
        when(schemes.findById(lookId)).thenReturn(Optional.of(meu));
        assertThatThrownBy(() -> service.action(me, s.getId(), new AfterpartyEngine.Action("ACTIVATE", lookId.toString(), 0, 0, false, "req_00000006")))
                .hasMessageContaining("deck da missão");
    }
}
