package br.com.fashionai.application.service;

import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.ports.NotificationProjectionPort;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.Notification;
import br.com.fashionai.domain.model.RoomCatalogItem;
import br.com.fashionai.domain.model.RoomInventoryItem;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.NotificationCategory;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import br.com.fashionai.domain.repository.NotificationRepository;
import br.com.fashionai.domain.repository.RoomCatalogItemRepository;
import br.com.fashionai.domain.repository.RoomInventoryItemRepository;
import br.com.fashionai.domain.repository.UserPreferencesRepository;
import br.com.fashionai.domain.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF30/RF39 — o extrato dos FAI Points aparece na central de notificações (sino da topbar): cada crédito e cada débito
 * do ledger vira uma notificação FAI_POINTS, com cota própria na caixa de entrada.
 */
class FaiPointsStatementTest {
    private static final Locale PT = Msg.PT_BR;
    private final UUID user = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(user, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private FaiPointsLedgerEntryRepository ledger;
    private FaiPointsRuleRepository rules;
    private RoomCatalogItemRepository catalog;
    private NotificationService notifications;
    private FaiPointsService service;

    @BeforeEach
    void setUp() {
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        rules = mock(FaiPointsRuleRepository.class);
        catalog = mock(RoomCatalogItemRepository.class);
        notifications = mock(NotificationService.class);
        RoomInventoryItemRepository inventory = mock(RoomInventoryItemRepository.class);
        when(inventory.save(any())).thenAnswer(inv -> {
            RoomInventoryItem saved = inv.getArgument(0);
            saved.setId(UUID.randomUUID());                    // o @PrePersist do JPA faria isso
            return saved;
        });
        service = new FaiPointsService(ledger, rules, catalog, inventory, null, notifications, mock(WardrobeCreatorService.class));
    }

    private void rule(String code, int points) {
        FaiPointsRule r = new FaiPointsRule();
        r.setActionCode(code);
        r.setPoints(points);
        when(rules.findById(code)).thenReturn(Optional.of(r));
    }

    private record Sent(String title, String body, Map<String, Object> payload) {
    }

    /** Título e corpo (já no idioma de quem lê) e payload da notificação de extrato enviada agora. */
    private Sent sent() {
        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked") ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(notifications).notify(eq(user), isNull(), eq(NotificationType.FAI_POINTS), eq("FAI_POINTS"), any(), title.capture(),
                body.capture(), payload.capture());
        return new Sent(Msg.resolve(PT, title.getValue()), Msg.resolve(PT, body.getValue()), payload.getValue());
    }

    @Test
    void creditoViraNotificacaoComOMotivo() {
        rule("SCHEME_CREATED", 40);
        service.award(user, "SCHEME_CREATED", "SCHEME", "s1", null);
        Sent n = sent();
        assertThat(n.title()).isEqualTo("+40 FAI Points");
        assertThat(n.body()).isEqualTo("Esquema criado");
        assertThat(n.payload()).containsEntry("delta", 40).containsEntry("action", "SCHEME_CREATED").containsEntry("href", "/points");
    }

    @Test
    void compraNaLojaViraNotificacaoDeDebitoComONomeDoItem() {
        User u = new User();
        u.assignId(user);
        when(ledger.lockOwner(user)).thenReturn(Optional.of(u));
        when(ledger.balance(user)).thenReturn(500L);
        RoomCatalogItem item = new RoomCatalogItem();
        item.setSku("FAI-PRT-AB60-NVY-LAC");
        item.setName("Porta 60 · Navy laca");
        item.setPricePoints(180);
        item.setRequiredLevel("ESTREIA");
        when(catalog.lockBySku("FAI-PRT-AB60-NVY-LAC")).thenReturn(Optional.of(item));
        service.buy(me, "FAI-PRT-AB60-NVY-LAC");
        Sent n = sent();
        assertThat(n.title()).isEqualTo("−180 FAI Points");
        assertThat(n.body()).isEqualTo("Compra na loja do quarto: Porta 60 · Navy laca");
        assertThat(n.payload()).containsEntry("delta", -180);
    }

    @Test
    void acaoSemTextoProprioUsaOGenerico() {
        rule("BONUS_DE_TESTE", 5);
        service.award(user, "BONUS_DE_TESTE", null, "r1", null);
        assertThat(sent().body()).isEqualTo("Lançamento: bonus de teste");
    }

    @Test
    void todaAcaoDoLedgerTemTextoNoExtrato() {
        // códigos das regras (V5, V26) e da compra; a V37 lista os mesmos para o histórico
        for (String code : List.of("PIECE_CATALOGED", "PIECE_COMPLETED", "PIECE_3D", "SCHEME_CREATED", "FORGOTTEN_RESCUED",
                "VISTA_ME_DAILY_LOOK", "ROOM_ORGANIZED", "ACHIEVEMENT", "LIKE_RECEIVED", "COMMENT_RECEIVED", "REMIX_RECEIVED",
                "CHALLENGE_COMPLETED", "SHOP_PURCHASE", "GAME_PLAYED", "GAME_WON", "FLAIR_QUEST")) {
            assertThat(Msg.has("faiPoints.extrato." + code)).as(code).isTrue();
        }
    }

    @Test
    void marcadorGravadoPelaMigrationResolveIgualAoDoServico() {
        // V37 monta "§i18n:chave<US>arg§" em SQL (US = CHAR(31)); tem de virar o mesmo texto que Msg.k
        assertThat(Msg.resolve(PT, "§i18n:faiPoints.extrato.credito\u001F40§")).isEqualTo(Msg.resolve(PT, Msg.k("faiPoints.extrato.credito", 40)));
        assertThat(Msg.resolve(PT, "§i18n:faiPoints.extrato.debito\u001F180§")).isEqualTo("−180 FAI Points");
        assertThat(Msg.resolve(PT, "§i18n:faiPoints.extrato.LIKE_RECEIVED§")).isEqualTo("Curtida recebida num look seu");
        assertThat(Msg.resolve(PT, "§i18n:faiPoints.extrato.SHOP_PURCHASE\u001FPorta 60§")).isEqualTo("Compra na loja do quarto: Porta 60");
        assertThat(Msg.resolve(Locale.ENGLISH, "§i18n:faiPoints.extrato.outro\u001Fbonus antigo§")).isEqualTo("Entry: bonus antigo");
    }

    @Test
    void extratoTemCotaPropriaNaCaixaDeEntrada() {
        NotificationRepository repo = mock(NotificationRepository.class);
        NotificationService inbox = new NotificationService(repo, mock(UserRepository.class), mock(UserPreferencesRepository.class),
                mock(NotificationProjectionPort.class));
        Instant now = Instant.now();
        Notification social = notification(NotificationType.NEW_COMMENT, now.minusSeconds(60));
        Notification newer = notification(NotificationType.FAI_POINTS, now);
        Notification older = notification(NotificationType.FAI_POINTS, now.minusSeconds(120));
        when(repo.findTop100ByRecipientIdAndDeliveredTrueAndCategoryNotOrderByCreatedAtDesc(user, NotificationCategory.POINTS)).thenReturn(List.of(social));
        when(repo.findTop100ByRecipientIdAndDeliveredTrueAndCategoryOrderByCreatedAtDesc(user, NotificationCategory.POINTS)).thenReturn(List.of(newer, older));

        @SuppressWarnings("unchecked") List<Object> items = (List<Object>) inbox.inbox(me).get("items");
        assertThat(items).extracting("type").containsExactly("FAI_POINTS", "NEW_COMMENT", "FAI_POINTS");
        assertThat(items).extracting("category").containsExactly("POINTS", "SOCIAL", "POINTS");
    }

    private static Notification notification(NotificationType type, Instant at) {
        Notification n = new Notification();
        n.setType(type);
        n.setCategory(type.category());
        n.setTitle("t");
        n.markCreatedAt(at);
        return n;
    }
}
