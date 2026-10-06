package br.com.fashionai.application.service;

import br.com.fashionai.application.audit.Audit;
import br.com.fashionai.application.common.ApiException;
import br.com.fashionai.application.common.Json;
import br.com.fashionai.application.common.Msg;
import br.com.fashionai.application.hype.HypeQueryService;
import br.com.fashionai.application.hype.HypeScoreConfig;
import br.com.fashionai.application.security.CurrentUser;
import br.com.fashionai.application.security.Guard;
import br.com.fashionai.domain.model.HypeMilestone;
import br.com.fashionai.domain.model.HypeScoreCurrent;
import br.com.fashionai.domain.model.HypeScoreSnapshot;
import br.com.fashionai.domain.model.Scheme;
import br.com.fashionai.domain.model.User;
import br.com.fashionai.domain.model.enums.AccountStatus;
import br.com.fashionai.domain.model.enums.HypeEntityType;
import br.com.fashionai.domain.model.enums.HypeLevel;
import br.com.fashionai.domain.model.enums.HypeStatus;
import br.com.fashionai.domain.model.enums.ProfileType;
import br.com.fashionai.domain.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * RF53 · Lote 9 (backend): Hype pessoal na exportação LGPD (P3-13), marcos apagados na exclusão da conta e a ilha
 * "Compare looks" do quarto lendo o HypeScore v2 do dono (P3-06), sem perder o campo v1.
 */
class HypePersonalDataTest {
    private final HypeScoreConfig config = HypeScoreConfig.defaults();
    private final UserRepository users = mock(UserRepository.class);
    private final WardrobeItemRepository pieces = mock(WardrobeItemRepository.class);
    private final SchemeRepository schemes = mock(SchemeRepository.class);
    private final HypeScoreCurrentRepository hypeScores = mock(HypeScoreCurrentRepository.class);
    private final HypeScoreSnapshotRepository hypeSnapshots = mock(HypeScoreSnapshotRepository.class);
    private final HypeMilestoneRepository hypeMilestones = mock(HypeMilestoneRepository.class);

    AccountService account() {
        return new AccountService(users, mock(UserPreferencesRepository.class), mock(UserConsentRepository.class), mock(VerificationCodeRepository.class),
                mock(DataExportRequestRepository.class), pieces, schemes, mock(SchemeItemRepository.class), mock(CommentRepository.class),
                mock(ReactionRepository.class), mock(SavedItemRepository.class), mock(FollowRepository.class), mock(PhotoRepository.class),
                mock(NotificationRepository.class), mock(DnaSchemeRepository.class), mock(StyleDnaRepository.class), mock(AiInferenceLogRepository.class),
                mock(BrandProfileRepository.class), mock(CelebrityProfileRepository.class), mock(IdentityService.class), null, null, null,
                new Audit(e -> { }), mock(Avatar3dService.class), null, config, hypeScores, hypeSnapshots, hypeMilestones);
    }

    static User user() {
        User u = new User();
        u.assignId(UUID.randomUUID());
        u.setUsername("ana");
        u.setProfileType(ProfileType.PESSOAL);
        return u;
    }

    static HypeScoreCurrent row(UUID owner, HypeEntityType type, boolean pub, Double score, HypeLevel level) {
        HypeScoreCurrent c = new HypeScoreCurrent();
        c.setEntityType(type);
        c.setEntityId(UUID.randomUUID());
        c.setOwnerId(owner);
        c.setAlgorithmVersion(HypeScoreConfig.DEFAULT_VERSION);
        c.setStatus(score == null ? HypeStatus.INSUFFICIENT_DATA : HypeStatus.AVAILABLE);
        c.setScore(score == null ? null : BigDecimal.valueOf(score));
        c.setLevel(level);
        c.setPublicEligible(pub);
        c.getDimensions().setTrend(score == null ? null : BigDecimal.valueOf(70));
        c.setWindowStart(Instant.parse("2026-07-14T00:00:00Z"));
        c.setWindowEnd(Instant.parse("2026-10-05T00:00:00Z"));
        c.setCalculatedAt(Instant.parse("2026-10-05T00:00:00Z"));
        return c;
    }

    @Test
    @SuppressWarnings("unchecked")
    void exportacaoLgpdTrazOHypePessoalDaPropriaPessoa() {
        User u = user();
        HypeScoreCurrent privatePiece = row(u.getId(), HypeEntityType.PIECE, false, 81.5, HypeLevel.TRENDING);
        HypeScoreCurrent look = row(u.getId(), HypeEntityType.SCHEME, true, null, null);
        when(hypeScores.findByOwnerIdAndEntityTypeAndAlgorithmVersion(u.getId(), HypeEntityType.PIECE, config.algorithmVersion())).thenReturn(List.of(privatePiece));
        when(hypeScores.findByOwnerIdAndEntityTypeAndAlgorithmVersion(u.getId(), HypeEntityType.SCHEME, config.algorithmVersion())).thenReturn(List.of(look));
        HypeScoreSnapshot older = snapshot(privatePiece.getEntityId(), LocalDate.of(2026, 9, 1), 40);
        HypeScoreSnapshot newer = snapshot(privatePiece.getEntityId(), LocalDate.of(2026, 10, 1), 81.5);
        when(hypeSnapshots.findByEntityTypeAndEntityIdInAndAlgorithmVersionAndSnapshotDateGreaterThanEqual(eq(HypeEntityType.PIECE), any(), eq(config.algorithmVersion()), any()))
                .thenReturn(List.of(newer, older));
        HypeMilestone m = new HypeMilestone();
        m.setEntityType(HypeEntityType.PIECE);
        m.setEntityId(privatePiece.getEntityId());
        m.setOwnerId(u.getId());
        m.setMilestone(HypeMilestone.Kind.TRENDING);
        m.setLevel(HypeLevel.TRENDING);
        m.setAchievedAt(Instant.parse("2026-10-01T12:00:00Z"));
        m.setNotificationId(UUID.randomUUID());
        when(hypeMilestones.findByOwnerIdOrderByAchievedAtDesc(u.getId())).thenReturn(List.of(m));

        Map<String, Object> data = account().exportData(u);
        Map<String, Object> hype = (Map<String, Object>) data.get("hype");
        assertThat(hype.get("algorithmVersion")).isEqualTo(config.algorithmVersion());
        List<Map<String, Object>> current = (List<Map<String, Object>>) hype.get("current");
        assertThat(current).hasSize(2);
        assertThat(current.get(0)).containsEntry("entityId", privatePiece.getEntityId()).containsEntry("publicEligible", false)
                .containsEntry("level", HypeLevel.TRENDING);
        assertThat((Map<String, Object>) current.get(0).get("dimensions")).containsOnlyKeys("TREND");   // ausente fica fora, nunca 0
        assertThat(current.get(1)).containsEntry("status", HypeStatus.INSUFFICIENT_DATA).containsEntry("score", null);
        List<Map<String, Object>> history = (List<Map<String, Object>>) hype.get("history");
        assertThat(history).extracting(h -> h.get("date")).containsExactly(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 10, 1));
        List<Map<String, Object>> milestones = (List<Map<String, Object>>) hype.get("milestones");
        assertThat(milestones).singleElement().satisfies(x -> {
            assertThat(x).containsEntry("milestone", HypeMilestone.Kind.TRENDING).containsEntry("notified", true);
        });
        // só o próprio dono: nenhuma consulta da população pública nem de outra pessoa
        verify(hypeScores, never()).findByEntityTypeAndAlgorithmVersionAndPublicEligibleTrueAndStatus(any(), anyString(), any());
        verify(hypeScores, never()).findByEntityTypeAndAlgorithmVersion(any(), anyString());
        // o pacote sai em JSON com o texto explicativo já no idioma da pessoa
        String json = Json.write(Msg.resolveDeep(Msg.PT_BR, data));
        assertThat(json).contains("\"hype\"").contains("HypeScore v2").contains("Hype pessoal").doesNotContain("§i18n");
    }

    static HypeScoreSnapshot snapshot(UUID id, LocalDate date, double score) {
        HypeScoreSnapshot s = new HypeScoreSnapshot();
        s.setEntityType(HypeEntityType.PIECE);
        s.setEntityId(id);
        s.setSnapshotDate(date);
        s.setStatus(HypeStatus.AVAILABLE);
        s.setScore(BigDecimal.valueOf(score));
        return s;
    }

    @Test
    void semOContextoDoHypeAExportacaoContinua() {
        AccountService legacy = new AccountService(users, mock(UserPreferencesRepository.class), mock(UserConsentRepository.class),
                mock(VerificationCodeRepository.class), mock(DataExportRequestRepository.class), pieces, schemes, mock(SchemeItemRepository.class),
                mock(CommentRepository.class), mock(ReactionRepository.class), mock(SavedItemRepository.class), mock(FollowRepository.class),
                mock(PhotoRepository.class), mock(NotificationRepository.class), mock(DnaSchemeRepository.class), mock(StyleDnaRepository.class),
                mock(AiInferenceLogRepository.class), mock(BrandProfileRepository.class), mock(CelebrityProfileRepository.class), mock(IdentityService.class),
                null, null, null, new Audit(e -> { }), mock(Avatar3dService.class));
        assertThat(legacy.exportData(user())).containsEntry("hype", null).containsKey("pieces");
    }

    @Test
    void exclusaoDaContaApagaOsMarcosDeHype() {
        User u = user();
        u.setStatus(AccountStatus.DELETION_SCHEDULED);
        u.setDeletionScheduledFor(Instant.now().minusSeconds(60));
        when(users.findByStatus(AccountStatus.DELETION_SCHEDULED)).thenReturn(List.of(u));
        assertThat(account().purgeScheduledDeletions()).isEqualTo(1);
        verify(hypeMilestones).deleteByOwnerId(u.getId());
    }

    // ------------------------------------------------------------------ ilha "Compare looks" (P3-06)
    @Test
    @SuppressWarnings("unchecked")
    void ilhaDoQuartoMostraOHypeV2PessoalSemPerderOCampoV1() {
        User u = user();
        CurrentUser me = new CurrentUser(u.getId(), "ana", "USER", ProfileType.PESSOAL, true, AccountStatus.ACTIVE, null, null);
        Scheme a = scheme(u);
        Scheme b = scheme(u);
        Guard guard = mock(Guard.class);
        FaiPointsLedgerEntryRepository ledger = mock(FaiPointsLedgerEntryRepository.class);
        when(ledger.lifetime(u.getId())).thenReturn(5_000L);   // nível ATELIER libera a ilha
        HypeQueryService query = mock(HypeQueryService.class);
        when(query.summaries(eq(me), eq(HypeEntityType.SCHEME), anyList())).thenReturn(Map.of("items",
                Map.of(a.getId().toString(), Map.of("status", "AVAILABLE", "score", 77.0, "level", "TRENDING"))));
        ObjectProvider<HypeQueryService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(query);
        RoomService room = new RoomService(null, null, pieces, schemes, mock(SchemeItemRepository.class), null, null, null, null, null, users, ledger,
                null, null, guard, null, null, null, null, null, provider);

        Map<String, Object> out = room.island(me, List.of(a.getId(), b.getId()));
        List<Map<String, Object>> looks = (List<Map<String, Object>>) out.get("looks");
        assertThat(looks.get(0)).doesNotContainKey("hypeScore");   // o v1 saiu na limpeza do v1 (P3-16)
        assertThat((Map<String, Object>) looks.get(0).get("hype")).containsEntry("level", "TRENDING").containsEntry("score", 77.0);
        // sem cálculo: "não calculado", nunca 0
        assertThat((Map<String, Object>) looks.get(1).get("hype")).containsEntry("status", "NOT_CALCULATED").doesNotContainKey("score");
        verify(query).summaries(eq(me), eq(HypeEntityType.SCHEME), eq(List.of(a.getId(), b.getId())));

        // look de outra pessoa: a guarda barra antes de qualquer leitura de Hype
        Scheme alheio = scheme(user());
        doThrow(ApiException.forbidden("não é seu")).when(guard).requireOwner(eq(me), eq(alheio.getUser().getId()), anyString());
        assertThrows(ApiException.class, () -> room.island(me, List.of(a.getId(), alheio.getId())));
        verify(query, org.mockito.Mockito.times(1)).summaries(any(), any(), anyList());
    }

    Scheme scheme(User owner) {
        Scheme s = new Scheme();
        s.assignId(UUID.randomUUID());
        s.setUser(owner);
        s.setTitle("Look");
        when(schemes.findById(s.getId())).thenReturn(Optional.of(s));
        return s;
    }
}
