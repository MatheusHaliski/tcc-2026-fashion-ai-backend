package br.com.fashionai.application.service;

import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.domain.model.FaiPointsLedgerEntry;
import br.com.fashionai.domain.model.FaiPointsRule;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.NotificationType;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.FaiPointsLedgerEntryRepository;
import br.com.fashionai.domain.repository.FaiPointsRuleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** FAI Points: regras e tetos do lançamento, subida de nível, conta e níveis (a loja do quarto saiu em 15/11/2026). */
class FaiPointsServiceContaTest {
    private final UUID uid = UUID.randomUUID();
    private final CurrentUser me = new CurrentUser(uid, "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
    private FaiPointsLedgerEntryRepository ledger;
    private FaiPointsRuleRepository rules;
    private NotificationService notifications;
    private FaiPointsService service;

    @BeforeEach
    void setUp() {
        ledger = mock(FaiPointsLedgerEntryRepository.class);
        rules = mock(FaiPointsRuleRepository.class);
        notifications = mock(NotificationService.class);
        service = new FaiPointsService(ledger, rules, notifications);
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
    void subirDeNivelAvisaSemFalarDoQuarto() {
        // o tipo ROOM_LEVEL_UP fica (avisos antigos); o texto fala do nível, e não há mais quarto para atualizar
        rule("BIG", 400, null, null, true);
        when(ledger.lifetime(uid)).thenReturn(0L, 400L);
        FaiPointsService.Award a = service.award(uid, "BIG", "X", "1", null);
        assertThat(a.levelUp()).isTrue();
        assertThat(a.level()).isEqualTo(FaiPointsService.Level.STUDIO);
        verify(notifications).notify(eq(uid), any(), eq(NotificationType.ROOM_LEVEL_UP), eq("ROOM"), any(),
                eq(br.com.fashionai.application.common.Msg.k("faiPoints.subiu_de_nivel", "STUDIO")), any(), any());
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
}
