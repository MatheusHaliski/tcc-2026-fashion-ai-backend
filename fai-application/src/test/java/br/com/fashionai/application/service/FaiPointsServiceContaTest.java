package br.com.fashionai.application.service;

import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.LinkedHashMap;
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

/** FAI Points: regras e tetos do lançamento, subida de nível, conta, loja, prova no quarto, aplicação e níveis. */
class FaiPointsServiceContaTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private FaiPointsLedgerEntryRepository ledger;
    private FaiPointsRuleRepository rules;
    private RoomCatalogItemRepository catalog;
    private RoomInventoryItemRepository inventory;
    private FaiPointsService.RoomLayoutAccess layouts;
    private NotificationService notifications;
    private WardrobeCreatorService creator;
    private FaiPointsService service;

    @BeforeEach
    void setUp() {
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        rules = mock(FaiPointsRuleRepository.class);
        catalog = mock(RoomCatalogItemRepository.class);
        inventory = mock(RoomInventoryItemRepository.class);
        layouts = mock(FaiPointsService.RoomLayoutAccess.class);
        notifications = mock(NotificationService.class);
        creator = mock(WardrobeCreatorService.class);
        service = new FaiPointsService(ledger, rules, catalog, inventory, layouts, notifications, creator);
    }

    private FaiPointsRule rule(String code, int points, Integer daily, Integer weekly, boolean active) {
        FaiPointsRule r = new FaiPointsRule();
        r.setActionCode(code);
        r.setPoints(points);
        r.setDailyCap(daily);
        r.setWeeklyCap(weekly);
        r.setActive(active);
        r.setDescription("regra " + code);
        when(rules.findById(code)).thenReturn(Optional.of(r));
        return r;
    }

    private RoomCatalogItem item(String sku, int price, String level) {
        RoomCatalogItem c = new RoomCatalogItem();
        c.setSku(sku);
        c.setPricePoints(price);
        c.setRequiredLevel(level);
        c.setActive(true);
        c.setFinishJson("{\"color\":\"#fff\"}");
        return c;
    }

    // ------------------------------------------------------------------ lançamento
    @Test
    void semRegraOuRegraInativaNaoPontua() {
        assertThat(service.award(uid, "NADA", "X", "1", null).granted()).isFalse();
        rule("OFF", 10, null, null, false);
        assertThat(service.award(uid, "OFF", "X", "1", null).granted()).isFalse();
        verify(ledger, never()).save(any());
    }

    @Test
    void eventoJaPontuadoETetosDiarioESemanal() {
        rule("LIKE", 5, 3, 10, true);
        when(ledger.existsByIdempotencyKey(uid + ":LIKE:dup")).thenReturn(true);
        assertThat(service.award(uid, "LIKE", "X", "dup", null).granted()).isFalse();

        when(ledger.countByUserIdAndActionCodeAndCreatedAtAfter(eq(uid), eq("LIKE"), any())).thenReturn(3L);
        FaiPointsService.Award diario = service.award(uid, "LIKE", "X", "a", null);
        assertThat(diario.capReached()).isTrue();

        when(ledger.countByUserIdAndActionCodeAndCreatedAtAfter(eq(uid), eq("LIKE"), any())).thenReturn(2L, 10L);
        FaiPointsService.Award semanal = service.award(uid, "LIKE", "X", "b", null);
        assertThat(semanal.capReached()).isTrue();
        assertThat(semanal.granted()).isFalse();
    }

    @Test
    void regraDeZeroPontosNaoLancaMasSobrescritaPositivaLanca() {
        rule("ZERO", 0, null, null, true);
        assertThat(service.award(uid, "ZERO", "X", "1", null).granted()).isFalse();
        assertThat(service.award(uid, "ZERO", "X", "1", -5).granted()).isFalse();
        FaiPointsService.Award a = service.award(uid, "ZERO", "X", null, 25);
        assertThat(a.granted()).isTrue();
        assertThat(a.points()).isEqualTo(25);
        verify(ledger).save(any(FaiPointsLedgerEntry.class));
        verify(notifications).notify(eq(uid), any(), eq(NotificationType.FAI_POINTS), eq("FAI_POINTS"), any(), any(), any(), any());
    }

    @Test
    void subirDeNivelAvisaEAtualizaOQuarto() {
        rule("BIG", 400, null, null, true);
        when(ledger.lifetime(uid)).thenReturn(0L, 400L);
        FaiPointsService.Award a = service.award(uid, "BIG", "X", "1", null);
        assertThat(a.levelUp()).isTrue();
        assertThat(a.level()).isEqualTo(FaiPointsService.Level.STUDIO);
        verify(layouts).setLevel(uid, "STUDIO");
        verify(notifications).notify(eq(uid), any(), eq(NotificationType.ROOM_LEVEL_UP), eq("ROOM"), any(), any(), any(), any());
    }

    @Test
    void lancamentoIsoladoEJogoComVitoria() {
        rule("GAME_PLAYED", 5, null, null, true);
        rule("GAME_WON", 7, null, null, true);
        assertThat(service.awardIsolated(uid, "GAME_PLAYED", "GAME", "solo", null).points()).isEqualTo(5);
        assertThat(service.game(uid, "QUIZ", "m1", "WIN")).isEqualTo(12);
        assertThat(service.game(uid, "QUIZ", "m2", "LOSS")).isEqualTo(5);
    }

    // ------------------------------------------------------------------ conta
    @Test
    void contaMostraNivelProximoRegrasERecentes() {
        when(ledger.lifetime(uid)).thenReturn(350L);
        when(ledger.balance(uid)).thenReturn(120L);
        FaiPointsRule com = rule("SCHEME_CREATED", 40, 5, null, true);
        FaiPointsRule sem = rule("ACAO_SEM_TEXTO", 10, null, null, true);
        FaiPointsRule off = rule("OFF", 1, null, null, false);
        when(rules.findAll()).thenReturn(List.of(com, sem, off));
        FaiPointsLedgerEntry e = new FaiPointsLedgerEntry();
        e.setDelta(40);
        e.setActionCode("SCHEME_CREATED");
        e.setCreatedAt(Instant.now());
        when(ledger.findTop100ByUserIdOrderByCreatedAtDesc(uid)).thenReturn(List.of(e));

        Map<String, Object> out = service.account(me);

        assertThat(out).containsEntry("balance", 120L).containsEntry("lifetime", 350L).containsEntry("level", "STUDIO");
        @SuppressWarnings("unchecked")
        Map<String, Object> next = (Map<String, Object>) out.get("nextLevel");
        assertThat(next).containsEntry("level", "LOFT").containsEntry("missing", 550L);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rs = (List<Map<String, Object>>) out.get("rules");
        assertThat(rs).hasSize(2);
        assertThat(rs.get(0)).containsEntry("dailyCap", 5);
        assertThat(rs.get(1)).containsEntry("dailyCap", "").containsEntry("description", "regra ACAO_SEM_TEXTO");
        assertThat((List<?>) out.get("recent")).hasSize(1);

        when(ledger.lifetime(uid)).thenReturn(5000L);
        assertThat(service.account(me).get("nextLevel")).isNull();
    }

    @Test
    void niveisLidosDosNomesAntigos() {
        assertThat(FaiPointsService.Level.parse(null)).isEqualTo(FaiPointsService.Level.ESTREIA);
        assertThat(FaiPointsService.Level.parse(" ")).isEqualTo(FaiPointsService.Level.ESTREIA);
        assertThat(FaiPointsService.Level.parse("studio")).isEqualTo(FaiPointsService.Level.STUDIO);
        assertThat(FaiPointsService.Level.parse("maison")).isEqualTo(FaiPointsService.Level.LOFT);
        assertThat(FaiPointsService.Level.parse("xyz")).isEqualTo(FaiPointsService.Level.ESTREIA);
        assertThat(FaiPointsService.Level.of(900)).isEqualTo(FaiPointsService.Level.LOFT);
        assertThat(FaiPointsService.requestRef("curta")).isNull();
        assertThat(FaiPointsService.requestRef(null)).isNull();
        assertThat(FaiPointsService.requestRef("0123456789abcdef")).isEqualTo("0123456789abcdef");
    }

    // ------------------------------------------------------------------ loja
    @Test
    void lojaMostraCondicoesEItensJaComprados() {
        when(ledger.lifetime(uid)).thenReturn(0L);
        when(ledger.balance(uid)).thenReturn(50L);
        RoomCatalogItem barato = item("A", 30, "ESTREIA");
        RoomCatalogItem caro = item("B", 300, "LOFT");
        RoomCatalogItem expirado = item("C", 10, "ESTREIA");
        expirado.setAvailableUntil(Instant.now().minusSeconds(3600));
        RoomCatalogItem expiradoMeu = item("D", 10, "ESTREIA");
        expiradoMeu.setAvailableUntil(Instant.now().minusSeconds(3600));
        RoomCatalogItem suspenso = item("E", 10, "ESTREIA");
        when(catalog.findByActiveTrueOrderByPricePoints()).thenReturn(List.of(barato, caro, expirado, expiradoMeu, suspenso));
        when(creator.sellerActive(any())).thenAnswer(i -> i.getArgument(0) != suspenso);
        when(creator.view(any(), eq(uid))).thenAnswer(i -> new LinkedHashMap<>(Map.of("sku", ((RoomCatalogItem) i.getArgument(0)).getSku())));
        RoomInventoryItem meu = new RoomInventoryItem();
        meu.setId(UUID.randomUUID());
        meu.setUserId(uid);
        meu.setSku("D");
        meu.setAppliedModule("M1");
        when(inventory.findByUserId(uid)).thenReturn(List.of(meu));
        when(layouts.compatibleModules(eq(uid), any())).thenReturn(List.of("M1"));

        List<Map<String, Object>> out = service.shop(me);

        assertThat(out).extracting(m -> m.get("sku")).containsExactly("A", "B", "D");
        assertThat(out.get(0)).containsEntry("levelOk", true).containsEntry("affordable", true).containsEntry("owned", false);
        assertThat(out.get(1)).containsEntry("levelOk", false).containsEntry("affordable", false);
        assertThat(out.get(2)).containsEntry("owned", true);
        assertThat((List<?>) out.get(2).get("inventory")).hasSize(1);
    }

    @Test
    void provarNoQuartoSemComprar() {
        RoomCatalogItem c = item("A", 30, "ESTREIA");
        when(catalog.findById("A")).thenReturn(Optional.of(c));
        when(layouts.compatibleModules(eq(uid), any())).thenReturn(List.of("M1", "M2"));
        assertThat(service.tryOn(me, "A", null)).containsEntry("module", "M1").containsEntry("preview", true);
        assertThat(service.tryOn(me, "A", "M2")).containsEntry("module", "M2");
        assertThatThrownBy(() -> service.tryOn(me, "A", "M9")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("ENCAIXE_INCOMPATIVEL"));
        when(layouts.compatibleModules(eq(uid), any())).thenReturn(List.of());
        assertThat(service.tryOn(me, "A", null)).containsEntry("module", "");
        assertThatThrownBy(() -> service.tryOn(me, "A", "M1")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.tryOn(me, "Z", null)).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void aplicarItemSoDoDonoEEmModuloCompativel() {
        RoomCatalogItem c = item("A", 30, "ESTREIA");
        when(catalog.findById("A")).thenReturn(Optional.of(c));
        RoomInventoryItem i = new RoomInventoryItem();
        i.setId(UUID.randomUUID());
        i.setUserId(uid);
        i.setSku("A");
        when(inventory.findById(i.getId())).thenReturn(Optional.of(i));
        when(layouts.compatibleModules(eq(uid), any())).thenReturn(List.of("M1"));

        assertThat(service.apply(me, i.getId(), "M1")).containsEntry("applied", true);
        assertThat(i.getAppliedModule()).isEqualTo("M1");
        verify(layouts).applyFinish(uid, "M1", c);
        assertThatThrownBy(() -> service.apply(me, i.getId(), "M2")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("ENCAIXE_INCOMPATIVEL"));
        i.setUserId(UUID.randomUUID());
        assertThatThrownBy(() -> service.apply(me, i.getId(), "M1")).extracting(e -> ((ApiException) e).status()).isEqualTo(403);
        assertThatThrownBy(() -> service.apply(me, UUID.randomUUID(), "M1")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void compraBloqueadaPorNivelCondicaoESaldo() {
        User u = new User();
        u.assignId(uid);
        when(ledger.lockOwner(uid)).thenReturn(Optional.of(u));
        RoomCatalogItem loft = item("L", 10, "LOFT");
        when(catalog.lockBySku("L")).thenReturn(Optional.of(loft));
        assertThatThrownBy(() -> service.buy(me, "L")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("NIVEL_INSUFICIENTE"));
        RoomCatalogItem cond = item("C", 10, "ESTREIA");
        when(catalog.lockBySku("C")).thenReturn(Optional.of(cond));
        when(creator.blocker(uid, cond)).thenReturn("Siga a marca");
        assertThatThrownBy(() -> service.buy(me, "C")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("CONDICAO_DE_COMPRA"));
        RoomCatalogItem caro = item("K", 999, "ESTREIA");
        when(catalog.lockBySku("K")).thenReturn(Optional.of(caro));
        assertThatThrownBy(() -> service.buy(me, "K")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("SALDO_INSUFICIENTE"));
        when(catalog.sellerOf("X")).thenReturn(Optional.of(UUID.randomUUID()));
        RoomCatalogItem trocado = item("X", 1, "ESTREIA");
        when(catalog.lockBySku("X")).thenReturn(Optional.of(trocado));
        when(ledger.lockOwner(any())).thenReturn(Optional.of(u));
        assertThatThrownBy(() -> service.buy(me, "X")).satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo("OFERTA_ALTERADA"));
        when(ledger.lockOwner(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.buy(me, "X")).extracting(e -> ((ApiException) e).status()).isEqualTo(404);
    }

    @Test
    void itemGratuitoSemChaveNaoGeraLancamento() {
        User u = new User();
        u.assignId(uid);
        when(ledger.lockOwner(uid)).thenReturn(Optional.of(u));
        RoomCatalogItem gratis = item("G", 0, "ESTREIA");
        when(catalog.lockBySku("G")).thenReturn(Optional.of(gratis));
        when(inventory.save(any())).thenAnswer(i -> {
            RoomInventoryItem saved = i.getArgument(0);
            saved.setId(UUID.randomUUID());
            return saved;
        });
        Map<String, Object> out = service.buy(me, "G");
        assertThat(out).containsEntry("sku", "G").containsEntry("serial", "null");
        verify(ledger, never()).save(any());
        verify(notifications, never()).notify(any(), any(), any(), anyString(), any(), any(), any(), any());
    }
}
